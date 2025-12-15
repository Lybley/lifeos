#!/usr/bin/env node

/**
 * Initialize Pinecone Index for LifeOS
 * Creates the vector index if it doesn't exist
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const dotenv = require('dotenv');
const path = require('path');

// Load backend environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'lifeos-embeddings';
const DIMENSION = 1536; // text-embedding-3-small dimension

async function initializePinecone() {
  console.log('========================================');
  console.log('🚀 Initializing Pinecone Index');
  console.log('========================================\n');

  if (!PINECONE_API_KEY) {
    console.error('❌ Error: PINECONE_API_KEY not found in backend/.env');
    process.exit(1);
  }

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });
    console.log('✅ Pinecone client initialized');

    // Check if index exists
    console.log(`\n📊 Checking if index "${INDEX_NAME}" exists...`);
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === INDEX_NAME);

    if (indexExists) {
      console.log(`✅ Index "${INDEX_NAME}" already exists`);
      
      // Get index stats
      const index = pinecone.index(INDEX_NAME);
      const stats = await index.describeIndexStats();
      console.log('\n📈 Index Stats:');
      console.log(`  • Total vectors: ${stats.totalRecordCount || 0}`);
      console.log(`  • Dimensions: ${stats.dimension || DIMENSION}`);
      console.log(`  • Namespaces: ${Object.keys(stats.namespaces || {}).length || 0}`);
    } else {
      console.log(`⚙️  Creating index "${INDEX_NAME}"...`);
      
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      console.log('✅ Index created successfully!');
      console.log('\n⏳ Waiting for index to be ready (this may take a minute)...');
      
      // Wait for index to be ready
      let ready = false;
      let attempts = 0;
      while (!ready && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const index = pinecone.index(INDEX_NAME);
          const stats = await index.describeIndexStats();
          ready = true;
          console.log('✅ Index is ready!');
          console.log(`  • Dimensions: ${stats.dimension}`);
        } catch (e) {
          attempts++;
          process.stdout.write('.');
        }
      }
      
      if (!ready) {
        console.log('\n⚠️  Index creation may still be in progress. Check Pinecone dashboard.');
      }
    }

    console.log('\n========================================');
    console.log('🎉 Pinecone Initialization Complete!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('  1. Ingest documents using the ingest-service');
    console.log('  2. Test RAG queries via /api/v1/rag/query');
    console.log('  3. Monitor vector count in Pinecone dashboard\n');

  } catch (error) {
    console.error('\n❌ Error initializing Pinecone:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

initializePinecone();
