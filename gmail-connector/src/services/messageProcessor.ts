/**
 * Message Processor
 * 
 * Maps Gmail messages to PMG schema and stores in:
 * - Neo4j (Message nodes)
 * - Pinecone (Vector embeddings)
 * - PostgreSQL (Metadata)
 */

import { gmail_v1 } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { convert } from 'html-to-text';
import { postgresClient, neo4jDriver, pineconeClient } from '../config/databases';
import logger from '../utils/logger';
import axios from 'axios';

export interface ProcessedMessage {
  messageId: string;
  gmailId: string;
  subject: string;
  body: string;
  from: string;
  to: string[];
  cc?: string[];
  date: Date;
  threadId: string;
  labels: string[];
}

/**
 * Extract email addresses from header
 */
function extractEmails(header?: string): string[] {
  if (!header) return [];

  const emailRegex = /<([^>]+)>|([^\s,]+@[^\s,]+)/g;
  const emails: string[] = [];
  let match;

  while ((match = emailRegex.exec(header)) !== null) {
    const email = match[1] || match[2];
    if (email) {
      emails.push(email.toLowerCase());
    }
  }

  return emails;
}

/**
 * Get header value from Gmail message
 */
function getHeader(message: gmail_v1.Schema$Message, name: string): string | undefined {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value;
}

/**
 * Extract plain text from message body
 */
function extractBody(message: gmail_v1.Schema$Message): string {
  const parts: gmail_v1.Schema$MessagePart[] = [];

  // Collect all parts
  function collectParts(part: gmail_v1.Schema$MessagePart) {
    if (part.parts) {
      part.parts.forEach(collectParts);
    } else {
      parts.push(part);
    }
  }

  if (message.payload) {
    collectParts(message.payload);
  }

  // Find text/plain part first
  const textPart = parts.find((p) => p.mimeType === 'text/plain');
  if (textPart?.body?.data) {
    const decoded = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    return decoded;
  }

  // Fallback to text/html
  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  if (htmlPart?.body?.data) {
    const decoded = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
    return convert(decoded, {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
      ],
    });
  }

  // Last resort: use snippet
  return message.snippet || '';
}

/**
 * Map Gmail message to PMG Message schema
 */
export function mapGmailToPMG(message: gmail_v1.Schema$Message): ProcessedMessage {
  const subject = getHeader(message, 'Subject') || '(no subject)';
  const from = getHeader(message, 'From') || '';
  const to = extractEmails(getHeader(message, 'To'));
  const cc = extractEmails(getHeader(message, 'Cc'));
  const dateStr = getHeader(message, 'Date');
  const date = dateStr ? new Date(dateStr) : new Date(parseInt(message.internalDate || '0'));

  const body = extractBody(message);

  return {
    messageId: `msg-${uuidv4()}`,
    gmailId: message.id!,
    subject,
    body,
    from,
    to,
    cc,
    date,
    threadId: message.threadId!,
    labels: message.labelIds || [],
  };
}

/**
 * Generate embedding for message
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL;

  if (!embeddingServiceUrl) {
    logger.warn('Embedding service not configured, using mock embedding');
    // Return mock embedding for testing
    return Array(1536).fill(0).map(() => Math.random());
  }

  try {
    // Call embedding service (or OpenAI directly)
    const response = await axios.post(`${embeddingServiceUrl}/embed`, {
      text,
      provider: process.env.EMBEDDING_PROVIDER || 'openai',
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    });

    return response.data.vector;
  } catch (error) {
    logger.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Store message in PostgreSQL
 */
async function storeInPostgres(
  userId: string,
  message: ProcessedMessage
): Promise<void> {
  // Store in nodes table
  const nodeQuery = `
    INSERT INTO nodes (
      id, neo4j_id, node_type, user_id, title,
      created_at, updated_at, is_deleted, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
    ON CONFLICT (neo4j_id) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = EXCLUDED.updated_at,
      metadata = EXCLUDED.metadata
  `;

  const metadata = {
    gmail_id: message.gmailId,
    thread_id: message.threadId,
    from: message.from,
    to: message.to,
    cc: message.cc,
    labels: message.labels,
    body_preview: message.body.substring(0, 500),
  };

  await postgresClient.query(nodeQuery, [
    uuidv4(),
    message.messageId,
    'Message',
    userId,
    message.subject,
    message.date,
    new Date(),
    JSON.stringify(metadata),
  ]);

  logger.info(`Stored message metadata in PostgreSQL: ${message.messageId}`);
}

/**
 * Store message in Neo4j
 */
async function storeInNeo4j(
  userId: string,
  message: ProcessedMessage
): Promise<void> {
  const session = neo4jDriver.session();

  try {
    // Create Message node
    const createMessageQuery = `
      MERGE (m:Message {id: $messageId})
      ON CREATE SET
        m.subject = $subject,
        m.body = $body,
        m.message_type = 'email',
        m.direction = $direction,
        m.thread_id = $threadId,
        m.sent_at = datetime($sentAt),
        m.created_at = datetime(),
        m.platform = 'gmail',
        m.metadata = $metadata
      ON MATCH SET
        m.updated_at = datetime()
      RETURN m
    `;

    await session.run(createMessageQuery, {
      messageId: message.messageId,
      subject: message.subject,
      body: message.body.substring(0, 10000), // Limit body size
      direction: 'received', // We'll determine this based on user's email
      threadId: message.threadId,
      sentAt: message.date.toISOString(),
      metadata: JSON.stringify({
        gmail_id: message.gmailId,
        from: message.from,
        to: message.to,
        cc: message.cc,
        labels: message.labels,
      }),
    });

    // Create ownership relationship
    const ownershipQuery = `
      MATCH (u:User {id: $userId})
      MATCH (m:Message {id: $messageId})
      MERGE (u)-[r:OWNS]->(m)
      ON CREATE SET r.created_at = datetime()
    `;

    await session.run(ownershipQuery, {
      userId,
      messageId: message.messageId,
    });

    logger.info(`Stored message in Neo4j: ${message.messageId}`);
  } finally {
    await session.close();
  }
}

/**
 * Store vector embedding in Pinecone
 */
async function storeInPinecone(
  userId: string,
  message: ProcessedMessage,
  embedding: number[]
): Promise<void> {
  if (!pineconeClient) {
    logger.warn('Pinecone not configured, skipping vector storage');
    return;
  }

  const indexName = process.env.PINECONE_INDEX || 'lifeos-vectors';
  const index = pineconeClient.index(indexName);

  const pineconeId = `${message.messageId}-body`;

  await index.upsert([
    {
      id: pineconeId,
      values: embedding,
      metadata: {
        user_id: userId,
        node_id: message.messageId,
        gmail_id: message.gmailId,
        node_type: 'Message',
        subject: message.subject,
        from: message.from,
        date: message.date.toISOString(),
        content_preview: message.body.substring(0, 500),
      },
    },
  ]);

  // Store vector reference in PostgreSQL
  const vectorQuery = `
    INSERT INTO vector_embeddings (
      id, node_id, pinecone_id, embedding_model, embedding_dimension,
      chunk_index, total_chunks, content_hash, created_at, updated_at, metadata
    )
    SELECT $1, n.id, $2, $3, $4, 0, 1, $5, NOW(), NOW(), $6
    FROM nodes n
    WHERE n.neo4j_id = $7
    ON CONFLICT (pinecone_id) DO UPDATE SET
      updated_at = NOW()
  `;

  const contentHash = crypto
    .createHash('sha256')
    .update(message.body)
    .digest('hex');

  await postgresClient.query(vectorQuery, [
    uuidv4(),
    pineconeId,
    process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    embedding.length,
    contentHash,
    JSON.stringify({ message_type: 'email' }),
    message.messageId,
  ]);

  logger.info(`Stored vector in Pinecone: ${pineconeId}`);
}

/**
 * Process and store a single message
 */
export async function processMessage(
  userId: string,
  gmailMessage: gmail_v1.Schema$Message
): Promise<void> {
  try {
    // Map Gmail message to PMG format
    const message = mapGmailToPMG(gmailMessage);

    logger.info(`Processing message: ${message.subject} (${message.gmailId})`);

    // Generate embedding for message body
    const combinedText = `${message.subject}\n\n${message.body}`;
    const embedding = await generateEmbedding(combinedText);

    // Store in PostgreSQL (metadata)
    await storeInPostgres(userId, message);

    // Store in Neo4j (graph node)
    await storeInNeo4j(userId, message);

    // Store in Pinecone (vector)
    await storeInPinecone(userId, message, embedding);

    logger.info(`Successfully processed message: ${message.messageId}`);
  } catch (error) {
    logger.error(`Failed to process message ${gmailMessage.id}:`, error);
    throw error;
  }
}

/**
 * Process messages in batch
 */
export async function processBatch(
  userId: string,
  gmailMessages: gmail_v1.Schema$Message[]
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const message of gmailMessages) {
    try {
      await processMessage(userId, message);
      processed++;
    } catch (error) {
      logger.error(`Failed to process message:`, error);
      failed++;
    }
  }

  return { processed, failed };
}
