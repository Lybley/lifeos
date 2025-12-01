/**
 * RAG Query Examples
 * Demonstrates how to use the RAG API from TypeScript/JavaScript
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

// Example 1: Basic RAG Query
async function basicQuery() {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/rag/query`, {
      user_id: 'user_123',
      query: 'What meetings did I have last week?',
      top_k: 5,
    });

    console.log('\n=== Basic Query ===');
    console.log('Answer:', response.data.answer);
    console.log('\nCitations:', response.data.citations);
    console.log('\nConfidence:', response.data.confidence);
    console.log('Latency:', response.data.latency, 'ms');
    console.log('Cached:', response.data.cached);
  } catch (error) {
    console.error('Query failed:', error.response?.data || error.message);
  }
}

// Example 2: Query with Custom Parameters
async function advancedQuery() {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/rag/query`, {
      user_id: 'user_123',
      query: 'Find all documents about the Q4 budget proposal',
      top_k: 10,
      min_score: 0.6, // Lower threshold for broader results
      use_cache: false, // Force fresh results
      llm_provider: 'openai',
      llm_model: 'gpt-4-turbo-preview',
    });

    console.log('\n=== Advanced Query ===');
    console.log('Found', response.data.used_chunks, 'relevant chunks');
    console.log('\nAnswer with citations:');
    console.log(response.data.answer);
    
    if (response.data.metadata) {
      console.log('\n=== Performance Metrics ===');
      console.log('Vector Search:', response.data.metadata.vector_search_time, 'ms');
      console.log('Graph Context:', response.data.metadata.graph_context_time, 'ms');
      console.log('LLM Processing:', response.data.metadata.llm_time, 'ms');
      console.log('Total Tokens:', response.data.metadata.total_tokens);
    }
  } catch (error) {
    console.error('Query failed:', error.response?.data || error.message);
  }
}

// Example 3: Batch Queries
async function batchQueries() {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/rag/batch`, {
      user_id: 'user_123',
      queries: [
        'What are my tasks for today?',
        'Who is attending the team meeting?',
        'What was decided in the last sprint planning?',
      ],
      top_k: 5,
    });

    console.log('\n=== Batch Queries ===');
    console.log(`Processed ${response.data.total} queries`);
    console.log(`Successful: ${response.data.successful}`);
    console.log(`Failed: ${response.data.failed}`);

    response.data.results.forEach((result: any, index: number) => {
      console.log(`\n--- Query ${index + 1}: ${result.query} ---`);
      if (result.success) {
        console.log('Answer:', result.data.answer.substring(0, 200) + '...');
        console.log('Confidence:', result.data.confidence);
      } else {
        console.log('Error:', result.error);
      }
    });
  } catch (error) {
    console.error('Batch query failed:', error.response?.data || error.message);
  }
}

// Example 4: Cache Management
async function cacheManagement() {
  const userId = 'user_123';

  try {
    // Get cache stats
    const stats = await axios.get(
      `${API_BASE_URL}/api/v1/rag/cache/stats?user_id=${userId}`
    );
    console.log('\n=== Cache Statistics ===');
    console.log('Cached queries:', stats.data.stats.totalKeys);

    // Invalidate user cache
    const invalidate = await axios.delete(
      `${API_BASE_URL}/api/v1/rag/cache/${userId}`
    );
    console.log('\nCache invalidated:', invalidate.data.entries_deleted, 'entries');
  } catch (error) {
    console.error('Cache operation failed:', error.response?.data || error.message);
  }
}

// Example 5: Error Handling
async function errorHandlingExample() {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/rag/query`,
      {
        user_id: 'user_123',
        query: 'Find information about XYZ project',
      },
      {
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data.confidence === 'none') {
      console.log('\n⚠️  No relevant information found');
      console.log('Suggestion:', response.data.answer);
    } else {
      console.log('\n✓ Answer found');
      console.log(response.data.answer);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        console.error('⏱️  Request timeout - try again');
      } else if (error.response?.status === 400) {
        console.error('❌ Invalid request:', error.response.data.details);
      } else if (error.response?.status === 500) {
        console.error('💥 Server error:', error.response.data.message);
      } else {
        console.error('❓ Unknown error:', error.message);
      }
    }
  }
}

// Example 6: Streaming Query (Future feature)
// This would be implemented with Server-Sent Events or WebSocket
async function streamingQueryExample() {
  console.log('\n=== Streaming (Future Feature) ===');
  console.log('Streaming responses will be available in a future update.');
  console.log('This will allow for real-time answer generation.');
}

// Run all examples
async function runExamples() {
  console.log('\n🚀 RAG API Examples\n');

  await basicQuery();
  await advancedQuery();
  await batchQueries();
  await cacheManagement();
  await errorHandlingExample();

  console.log('\n✅ All examples completed\n');
}

// Run if called directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicQuery,
  advancedQuery,
  batchQueries,
  cacheManagement,
  errorHandlingExample,
};
