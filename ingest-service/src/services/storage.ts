/**
 * Storage Service
 * 
 * Handles storing document chunks and embeddings across:
 * - PostgreSQL: Metadata, chunks table
 * - Pinecone: Vector embeddings
 * - Neo4j: Document and Chunk nodes with relationships
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { postgresClient } from '../config/postgres';
import { neo4jDriver } from '../config/neo4j';
import { pineconeClient } from '../config/pinecone';
import { DocumentChunk } from './chunker';
import { EmbeddingVector } from './embeddings';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface StorageResult {
  documentId: string;
  nodeId: string;
  chunksStored: number;
  vectorsStored: number;
  neo4jNodesCreated: number;
}

interface ChunkMetadata {
  chunkIndex: number;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Calculate SHA256 hash of content for deduplication
 */
function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Store chunk metadata in PostgreSQL
 */
async function storeChunkInPostgres(
  nodeId: string,
  chunk: DocumentChunk,
  userId: string,
  documentTitle: string
): Promise<string> {
  const chunkId = uuidv4();
  const neo4jId = `chunk-${chunkId}`;

  const query = `
    INSERT INTO nodes (
      id, neo4j_id, node_type, user_id, title,
      created_at, updated_at, is_deleted, metadata
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), false, $6)
    RETURNING id
  `;

  const metadata = {
    chunk_index: chunk.chunkIndex,
    token_count: chunk.tokenCount,
    start_offset: chunk.startOffset,
    end_offset: chunk.endOffset,
    content_preview: chunk.content.substring(0, 200),
  };

  try {
    await postgresClient.query(query, [
      chunkId,
      neo4jId,
      'Chunk',
      userId,
      `${documentTitle} - Chunk ${chunk.chunkIndex}`,
      JSON.stringify(metadata),
    ]);

    return neo4jId;
  } catch (error) {
    logger.error('Failed to store chunk in PostgreSQL:', error);
    throw new AppError('Database storage failed', 500);
  }
}

/**
 * Store vector embedding in Pinecone and reference in PostgreSQL
 */
async function storeVectorEmbedding(
  nodeId: string,
  chunkId: string,
  embedding: EmbeddingVector,
  chunk: DocumentChunk,
  indexName: string
): Promise<void> {
  if (!pineconeClient) {
    logger.warn('Pinecone not configured, skipping vector storage');
    return;
  }

  try {
    const pineconeId = `${chunkId}-${chunk.chunkIndex}`;
    const contentHash = calculateContentHash(chunk.content);

    // Store in Pinecone
    const index = pineconeClient.index(indexName);
    await index.upsert([{
      id: pineconeId,
      values: embedding.vector,
      metadata: {
        node_id: nodeId,
        chunk_id: chunkId,
        chunk_index: chunk.chunkIndex,
        token_count: chunk.tokenCount,
        content_preview: chunk.content.substring(0, 500),
      },
    }]);

    // Store reference in PostgreSQL
    const query = `
      INSERT INTO vector_embeddings (
        id, node_id, pinecone_id, embedding_model, embedding_dimension,
        chunk_index, total_chunks, content_hash, created_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
    `;

    // Get node UUID from neo4j_id
    const nodeQuery = 'SELECT id FROM nodes WHERE neo4j_id = $1';
    const nodeResult = await postgresClient.query(nodeQuery, [chunkId]);
    const nodeUuid = nodeResult.rows[0]?.id;

    if (!nodeUuid) {
      throw new Error(`Node not found for neo4j_id: ${chunkId}`);
    }

    await postgresClient.query(query, [
      uuidv4(),
      nodeUuid,
      pineconeId,
      embedding.model,
      embedding.dimensions,
      chunk.chunkIndex,
      1, // Will be updated later with total count
      contentHash,
      JSON.stringify({ token_count: chunk.tokenCount }),
    ]);

    logger.info(`Stored vector embedding: ${pineconeId}`);
  } catch (error) {
    logger.error('Failed to store vector embedding:', error);
    throw new AppError('Vector storage failed', 500);
  }
}

/**
 * Create Document and Chunk nodes in Neo4j with relationships
 */
export async function storeInNeo4j(
  documentId: string,
  documentTitle: string,
  documentContent: string,
  chunks: Array<{ chunkId: string; content: string; chunkIndex: number; tokenCount: number }>,
  userId: string,
  metadata: Record<string, any>
): Promise<number> {
  const session = neo4jDriver.session();

  try {
    // Create Document node
    const createDocQuery = `
      CREATE (d:Document {
        id: $documentId,
        title: $title,
        content: $content,
        doc_type: $docType,
        file_size: $fileSize,
        created_at: datetime(),
        updated_at: datetime(),
        status: 'published',
        tags: $tags
      })
      RETURN d
    `;

    await session.run(createDocQuery, {
      documentId,
      title: documentTitle,
      content: documentContent.substring(0, 10000), // Store preview
      docType: metadata.fileType || 'unknown',
      fileSize: metadata.fileSize || 0,
      tags: metadata.tags || [],
    });

    logger.info(`Created Document node: ${documentId}`);

    // Create Chunk nodes and relationships
    for (const chunk of chunks) {
      const createChunkQuery = `
        MATCH (d:Document {id: $documentId})
        CREATE (c:Chunk {
          id: $chunkId,
          content: $content,
          chunk_index: $chunkIndex,
          token_count: $tokenCount,
          created_at: datetime()
        })
        CREATE (d)-[r:HAS_CHUNK {chunk_index: $chunkIndex}]->(c)
        RETURN c
      `;

      await session.run(createChunkQuery, {
        documentId,
        chunkId: chunk.chunkId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
      });
    }

    logger.info(`Created ${chunks.length} Chunk nodes for document ${documentId}`);

    // Create ownership relationship
    const ownershipQuery = `
      MATCH (u:User {id: $userId})
      MATCH (d:Document {id: $documentId})
      CREATE (u)-[r:OWNS {created_at: datetime()}]->(d)
      RETURN r
    `;

    await session.run(ownershipQuery, { userId, documentId });

    return chunks.length + 1; // Document + chunks
  } catch (error) {
    logger.error('Neo4j storage failed:', error);
    throw new AppError('Graph storage failed', 500);
  } finally {
    await session.close();
  }
}

/**
 * Store document with chunks and embeddings across all databases
 */
export async function storeDocument(
  userId: string,
  documentTitle: string,
  documentContent: string,
  chunks: DocumentChunk[],
  embeddings: EmbeddingVector[],
  metadata: Record<string, any>
): Promise<StorageResult> {
  const documentId = `doc-${uuidv4()}`;
  const indexName = process.env.PINECONE_INDEX || 'lifeos-vectors';

  try {
    // Start transaction for PostgreSQL
    await postgresClient.query('BEGIN');

    // 1. Create document node in PostgreSQL
    const docQuery = `
      INSERT INTO nodes (
        id, neo4j_id, node_type, user_id, title,
        created_at, updated_at, is_deleted, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), false, $6)
      RETURNING id
    `;

    await postgresClient.query(docQuery, [
      uuidv4(),
      documentId,
      'Document',
      userId,
      documentTitle,
      JSON.stringify(metadata),
    ]);

    // 2. Store chunks in PostgreSQL
    const chunkIds: string[] = [];
    for (const chunk of chunks) {
      const chunkId = await storeChunkInPostgres(
        documentId,
        chunk,
        userId,
        documentTitle
      );
      chunkIds.push(chunkId);
    }

    // 3. Store embeddings in Pinecone and PostgreSQL
    for (let i = 0; i < chunks.length; i++) {
      await storeVectorEmbedding(
        documentId,
        chunkIds[i],
        embeddings[i],
        chunks[i],
        indexName
      );
    }

    // Commit PostgreSQL transaction
    await postgresClient.query('COMMIT');

    // 4. Store in Neo4j (separate transaction)
    const neo4jChunks = chunks.map((chunk, i) => ({
      chunkId: chunkIds[i],
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
    }));

    const neo4jNodesCreated = await storeInNeo4j(
      documentId,
      documentTitle,
      documentContent,
      neo4jChunks,
      userId,
      metadata
    );

    // 5. Log ingestion event
    const logQuery = `
      INSERT INTO ingestion_logs (
        id, user_id, node_id, ingestion_type, source_system,
        status, processing_time_ms, created_at, completed_at, metadata
      )
      SELECT $1, $2, id, $3, $4, $5, $6, NOW(), NOW(), $7
      FROM nodes WHERE neo4j_id = $8
    `;

    await postgresClient.query(logQuery, [
      uuidv4(),
      userId,
      'create',
      'upload',
      'completed',
      0, // Will be calculated by caller
      JSON.stringify({ chunks_created: chunks.length }),
      documentId,
    ]);

    logger.info(`Successfully stored document ${documentId} with ${chunks.length} chunks`);

    return {
      documentId,
      nodeId: documentId,
      chunksStored: chunks.length,
      vectorsStored: pineconeClient ? chunks.length : 0,
      neo4jNodesCreated,
    };
  } catch (error) {
    // Rollback on error
    await postgresClient.query('ROLLBACK').catch(() => {});
    logger.error('Document storage failed:', error);
    throw error;
  }
}
