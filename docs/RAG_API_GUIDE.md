# RAG API Guide - LifeOS

## Overview

The RAG (Retrieval-Augmented Generation) API provides intelligent question-answering over your Personal Memory Graph. It combines:

1. **Vector Search** (Pinecone) - Semantic search for relevant information
2. **Graph Context** (Neo4j) - Relationship and context enrichment
3. **LLM Synthesis** (OpenAI/Anthropic/Gemini) - Natural language answer generation
4. **Redis Caching** - Fast responses for repeated queries

## Architecture

```
User Query
    ↓
[Check Cache]
    ↓ (miss)
[Vector Search] → Find top_k relevant chunks
    ↓
[Graph Context] → Enrich with relationships (2-hop)
    ↓
[Build Prompt] → System + Context + Query
    ↓
[LLM Call] → Generate answer with citations
    ↓
[Cache Result] → Store for 1 hour
    ↓
Return Response
```

## API Endpoints

### 1. Query RAG

**Endpoint:** `POST /api/v1/rag/query`

**Description:** Ask a question and get an AI-generated answer with citations from your Personal Memory Graph.

**Request Body:**
```json
{
  "user_id": "string (required)",
  "query": "string (required) - Your question",
  "top_k": "integer (optional, 1-20, default: 5) - Number of chunks to retrieve",
  "min_score": "float (optional, 0-1, default: 0.7) - Minimum similarity score",
  "use_cache": "boolean (optional, default: true) - Whether to use cached results",
  "llm_provider": "string (optional) - 'openai', 'anthropic', or 'gemini'",
  "llm_model": "string (optional) - Specific model to use"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What meetings did I have with John last month?",
    "top_k": 5
  }'
```

**Response:**
```json
{
  "answer": "According to your calendar, you had two meetings with John last month [src_1][src_2]:\n\n1. **Project Kickoff** on March 15th at 2:00 PM [src_1]\n   - Location: Conference Room A\n   - Duration: 1 hour\n   - Also attended by Sarah and Mike\n\n2. **Quarterly Review** on March 28th at 10:00 AM [src_2]\n   - Location: Virtual (Zoom)\n   - Duration: 45 minutes\n\nBoth meetings were marked as completed in your calendar.",
  "citations": [
    {
      "source_id": "src_1",
      "score": 0.89,
      "title": "Calendar Event: Project Kickoff",
      "document_id": "doc_cal_123"
    },
    {
      "source_id": "src_2",
      "score": 0.85,
      "title": "Calendar Event: Quarterly Review",
      "document_id": "doc_cal_124"
    }
  ],
  "used_chunks": 5,
  "confidence": "high",
  "latency": 1247,
  "cached": false,
  "metadata": {
    "vector_search_time": 234,
    "graph_context_time": 156,
    "llm_time": 847,
    "total_tokens": 1523
  }
}
```

**Response Fields:**
- `answer`: Natural language answer with inline citations [source_id]
- `citations`: Array of sources used, with relevance scores
- `used_chunks`: Number of document chunks retrieved
- `confidence`: `high`, `medium`, `low`, or `none`
- `latency`: Total response time in milliseconds
- `cached`: Whether result came from cache
- `metadata`: Detailed timing and token usage

---

### 2. Batch Query

**Endpoint:** `POST /api/v1/rag/batch`

**Description:** Process multiple queries in parallel.

**Request Body:**
```json
{
  "user_id": "string (required)",
  "queries": ["string", "string", ...], // 1-10 queries
  "top_k": "integer (optional)",
  "min_score": "float (optional)",
  "use_cache": "boolean (optional)"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/v1/rag/batch \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "queries": [
      "What are my tasks for today?",
      "Who did I meet yesterday?",
      "What was discussed in the last team meeting?"
    ]
  }'
```

**Response:**
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "query": "What are my tasks for today?",
      "success": true,
      "data": { /* RAG response */ }
    },
    // ... more results
  ]
}
```

---

### 3. Cache Management

#### Invalidate User Cache

**Endpoint:** `DELETE /api/v1/rag/cache/:userId`

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/v1/rag/cache/user_123
```

**Response:**
```json
{
  "success": true,
  "message": "Cache invalidated for user user_123",
  "entries_deleted": 15
}
```

#### Get Cache Statistics

**Endpoint:** `GET /api/v1/rag/cache/stats?user_id=USER_ID`

**Example:**
```bash
curl http://localhost:8000/api/v1/rag/cache/stats?user_id=user_123
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalKeys": 23,
    "pattern": "rag:query:user_123:*"
  }
}
```

#### Clear All Cache (Admin)

**Endpoint:** `DELETE /api/v1/rag/cache/all`

⚠️ **Use with caution** - Clears all RAG cache for all users.

---

### 4. Health Check

**Endpoint:** `GET /api/v1/rag/health`

**Example:**
```bash
curl http://localhost:8000/api/v1/rag/health
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "pinecone": true,
    "llm": true,
    "redis": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Prompt Engineering

### System Prompt

The RAG system uses a carefully crafted system prompt that:

1. **Prevents hallucination** - Only allows information from provided sources
2. **Enforces citations** - Requires [source_id] after each fact
3. **Encourages honesty** - Explicitly states "I don't know" when uncertain
4. **Provides confidence levels** - Indicates reliability of information

### Citation Format

All answers include inline citations:

```
The meeting was on March 15th [src_1] and attended by John, Sarah, and Mike [src_1][src_2].
```

### Confidence Scoring

Automatic confidence assessment based on:
- Number of sources
- Citation density
- Presence of uncertainty phrases

**Levels:**
- `high`: 5+ citations, multiple confirming sources
- `medium`: 3-4 citations, single or partial sources
- `low`: 1-2 citations, limited information
- `none`: Cannot answer from sources

---

## Caching Strategy

### Cache Key Generation

```typescript
Key = sha256(userId + normalizedQuery + topK)
```

**Normalization:**
- Lowercase
- Trim whitespace
- Remove extra spaces
- Case-insensitive matching

### Cache Behavior

- **TTL**: 1 hour (3600 seconds)
- **Invalidation**: Automatic on new document ingestion (optional)
- **Pattern**: `rag:query:{userId}:{hash}`

### When to Invalidate

1. User explicitly requests (`DELETE /cache/:userId`)
2. After ingesting new documents
3. After significant PMG updates
4. Manual admin action

---

## Configuration

### Environment Variables

```bash
# LLM Configuration
EMERGENT_LLM_KEY=your-universal-key  # Preferred
OPENAI_API_KEY=your-openai-key       # Fallback
LLM_PROVIDER=openai                  # openai|anthropic|gemini
LLM_MODEL=gpt-4-turbo-preview        # Specific model

# Embedding Configuration  
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=lifeos-embeddings

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Best Practices

### Query Optimization

1. **Be Specific**: "What did John say about the Q1 budget?" > "What did John say?"
2. **Include Context**: "In last week's team meeting" adds temporal context
3. **Use Natural Language**: Write queries as you would ask a person

### Performance

1. **Adjust top_k**: Start with 5, increase if answers are incomplete
2. **Use min_score**: Filter out low-relevance results (0.7 is good default)
3. **Enable Caching**: Significantly speeds up repeated queries

### Error Handling

```javascript
try {
  const response = await fetch('/api/v1/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: 'user_123',
      query: 'What are my tasks?',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  
  if (data.confidence === 'none') {
    console.log('No relevant information found');
  } else {
    console.log('Answer:', data.answer);
    console.log('Citations:', data.citations);
  }
} catch (error) {
  console.error('RAG query failed:', error);
}
```

---

## Troubleshooting

### "No relevant documents found"

**Causes:**
- Information not yet ingested
- Query too specific or uses different terminology
- min_score threshold too high

**Solutions:**
- Check if documents are synced
- Rephrase query
- Lower min_score to 0.6
- Increase top_k

### "RAG query failed: Embedding generation failed"

**Causes:**
- Missing or invalid API key
- OpenAI API rate limit
- Network issues

**Solutions:**
- Verify `EMERGENT_LLM_KEY` or `OPENAI_API_KEY`
- Check API key quotas
- Retry with exponential backoff

### "Vector search failed"

**Causes:**
- Pinecone API issues
- Index doesn't exist
- Missing PINECONE_API_KEY

**Solutions:**
- Verify Pinecone credentials
- Check index name in env vars
- Verify index is populated with embeddings

### High Latency

**Optimization:**
- Enable caching (`use_cache: true`)
- Reduce top_k (try 3-5)
- Use faster LLM model (e.g., gpt-3.5-turbo)
- Pre-warm cache with common queries

---

## Examples

### Example 1: Task Management

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What are my high-priority tasks this week?"
  }'
```

### Example 2: Meeting Insights

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "Summarize the key decisions from yesterday's product meeting"
  }'
```

### Example 3: Document Search

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "Find all documents mentioning the new API design",
    "top_k": 10
  }'
```

### Example 4: Contact Information

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What is Sarah's email address?"
  }'
```

---

## Advanced Usage

### Custom LLM Provider

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What meetings do I have today?",
    "llm_provider": "anthropic",
    "llm_model": "claude-3-opus-20240229"
  }'
```

### Disable Caching

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "Latest project status",
    "use_cache": false
  }'
```

### Lower Similarity Threshold

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "Something about budget",
    "min_score": 0.5,
    "top_k": 10
  }'
```

---

## License

MIT
