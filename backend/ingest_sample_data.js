#!/usr/bin/env node

/**
 * Ingest Sample LifeOS Documents
 * Populates Pinecone with sample documents for testing
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'lifeos-embeddings';

// Sample documents about LifeOS
const SAMPLE_DOCUMENTS = [
  {
    id: 'doc_1',
    text: 'LifeOS is a personal memory and productivity application that helps users organize their life, track memories, and manage tasks efficiently.',
    metadata: { type: 'overview', category: 'general' }
  },
  {
    id: 'doc_2',
    text: 'LifeOS features include real-time event tracking, granular permissions, multi-layer memory system, and people intelligence for relationship management.',
    metadata: { type: 'features', category: 'core' }
  },
  {
    id: 'doc_3',
    text: 'The platform supports multi-modal ingestion, allowing users to capture information through text, voice, images, and other formats.',
    metadata: { type: 'features', category: 'ingestion' }
  },
  {
    id: 'doc_4',
    text: 'LifeOS includes a sophisticated planner engine that helps with auto-scheduling, conflict resolution, and intelligent task planning.',
    metadata: { type: 'features', category: 'planning' }
  },
  {
    id: 'doc_5',
    text: 'The application uses advanced AI with RAG (Retrieval Augmented Generation) to provide contextual answers based on your personal data.',
    metadata: { type: 'technology', category: 'ai' }
  },
  {
    id: 'doc_6',
    text: 'LifeOS offers client-side encryption vault for secure storage of sensitive information and credentials.',
    metadata: { type: 'features', category: 'security' }
  },
  {
    id: 'doc_7',
    text: 'The platform includes a knowledge expansion layer that continuously learns and improves based on user interactions.',
    metadata: { type: 'features', category: 'ai' }
  },
  {
    id: 'doc_8',
    text: 'LifeOS subscription plans include Free (basic features), Pro ($9.99/month), and Team ($24.99/month) tiers.',
    metadata: { type: 'pricing', category: 'billing' }
  }
];

async function generateEmbedding(text) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  return response.data[0].embedding;
}

async function ingestDocuments() {
  console.log('========================================');
  console.log('📚 Ingesting Sample LifeOS Documents');
  console.log('========================================\n');

  if (!PINECONE_API_KEY || !OPENAI_API_KEY) {
    console.error('❌ Error: Missing API keys in .env file');
    process.exit(1);
  }

  try {
    // Initialize clients
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME);
    
    console.log('✅ Connected to Pinecone index:', INDEX_NAME);
    console.log(`📊 Ingesting ${SAMPLE_DOCUMENTS.length} sample documents...\n`);

    // Process documents
    const vectors = [];
    
    for (let i = 0; i < SAMPLE_DOCUMENTS.length; i++) {
      const doc = SAMPLE_DOCUMENTS[i];
      console.log(`[${i + 1}/${SAMPLE_DOCUMENTS.length}] Processing: ${doc.id}`);
      
      // Generate embedding
      const embedding = await generateEmbedding(doc.text);
      
      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          text: doc.text,
          user_id: 'test-user-123', // Default test user
          ...doc.metadata,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`  ✅ Generated embedding (${embedding.length} dims)`);
    }

    // Upsert to Pinecone
    console.log('\n📤 Uploading vectors to Pinecone...');
    await index.upsert(vectors);
    
    console.log('✅ Upload complete!');

    // Verify ingestion
    console.log('\n📊 Verifying ingestion...');
    const stats = await index.describeIndexStats();
    console.log(`  • Total vectors in index: ${stats.totalRecordCount}`);
    console.log(`  • Dimensions: ${stats.dimension}`);

    console.log('\n========================================');
    console.log('🎉 Sample Data Ingestion Complete!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('  1. Test RAG queries: bash test_rag_pipeline.sh');
    console.log('  2. Try frontend chat interface');
    console.log('  3. Ingest your own documents\n');

  } catch (error) {
    console.error('\n❌ Error during ingestion:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if OpenAI SDK is available
try {
  require.resolve('openai');
  ingestDocuments();
} catch (e) {
  console.error('❌ Error: OpenAI SDK not installed');
  console.error('Run: cd /app/backend && yarn add openai');
  process.exit(1);
}
