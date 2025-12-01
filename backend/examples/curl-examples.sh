#!/bin/bash

# RAG API cURL Examples
# Make sure the backend is running on port 8000

API_URL="http://localhost:8000/api/v1/rag"

echo "=== RAG API cURL Examples ==="
echo ""

# Example 1: Basic Query
echo "1. Basic Query"
echo "---"
curl -X POST "$API_URL/query" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What meetings did I have this week?",
    "top_k": 5
  }' | jq '.'

echo ""
echo ""

# Example 2: Query with Custom Parameters
echo "2. Advanced Query with Custom Parameters"
echo "---"
curl -X POST "$API_URL/query" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "Find all documents about machine learning",
    "top_k": 10,
    "min_score": 0.65,
    "use_cache": false
  }' | jq '.'

echo ""
echo ""

# Example 3: Batch Queries
echo "3. Batch Queries"
echo "---"
curl -X POST "$API_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "queries": [
      "What are my tasks for today?",
      "Who did I meet yesterday?",
      "What projects am I working on?"
    ]
  }' | jq '.'

echo ""
echo ""

# Example 4: Get Cache Statistics
echo "4. Cache Statistics"
echo "---"
curl -X GET "$API_URL/cache/stats?user_id=user_123" | jq '.'

echo ""
echo ""

# Example 5: Invalidate User Cache
echo "5. Invalidate User Cache"
echo "---"
curl -X DELETE "$API_URL/cache/user_123" | jq '.'

echo ""
echo ""

# Example 6: Health Check
echo "6. RAG Service Health Check"
echo "---"
curl -X GET "$API_URL/health" | jq '.'

echo ""
echo ""

echo "=== Examples Complete ==="
