# RAG Service - Internal Documentation

## Service Architecture

The RAG (Retrieval-Augmented Generation) service consists of multiple coordinated components:

```
ragService.ts (Orchestrator)
    ├── vectorSearch.ts (Pinecone queries)
    ├── graphContext.ts (Neo4j relationships)
    ├── promptTemplates.ts (Prompt engineering)
    ├── cache.ts (Redis caching)
    └── emergentLlmClient.ts (LLM integration)
```

## Component Details

### 1. Vector Search (`vectorSearch.ts`)

**Purpose:** Semantic search in Pinecone vector database

**Key Functions:**
- `generateQueryEmbedding()`: Convert query to vector using OpenAI embeddings
- `searchVectors()`: Query Pinecone with filters
- `searchByQuery()`: Combined embedding + search

**Features:**
- User-based filtering (ensures data isolation)
- Configurable top_k and min_score
- Namespace support

### 2. Graph Context (`graphContext.ts`)

**Purpose:** Enrich results with knowledge graph relationships

**Key Functions:**
- `getGraphContext()`: Traverse Neo4j graph up to N hops
- `getDocumentMetadata()`: Fetch document info for chunks
- `buildContextSummary()`: Create readable context summary

**Graph Traversal:**
```cypher
Chunk -> Document -> [Related Entities]
  ├── Person (attendees, contacts)
  ├── Event (meetings, appointments)
  ├── Task (todos, assignments)
  └── Message (emails, chats)
```

### 3. Prompt Templates (`promptTemplates.ts`)

**Purpose:** Anti-hallucination prompt engineering

**Key Components:**
- `RAG_SYSTEM_PROMPT`: Core system instructions
- `buildRAGPrompt()`: Construct complete prompt with context
- `parseCitations()`: Extract [source_id] from response
- `extractConfidence()`: Assess answer reliability

**Prompt Structure:**
```
System: Instructions + Citation rules + Confidence guidelines

Context: 
  Source 1: [content + metadata]
  Source 2: [content + metadata]
  Graph: [relationships]

User: Query + Instructions
```

### 4. Cache (`cache.ts`)

**Purpose:** Redis-based response caching

**Key Functions:**
- `generateCacheKey()`: Hash-based key generation
- `getCachedResponse()`: Retrieve from cache
- `cacheResponse()`: Store with TTL
- `invalidateUserCache()`: Clear user's cache

**Cache Strategy:**
- Query normalization (lowercase, trim)
- SHA-256 hash for key uniqueness
- 1-hour TTL (configurable)
- User-scoped invalidation

### 5. Emergent LLM Client (`emergentLlmClient.ts`)

**Purpose:** Unified LLM interface

**Supported Providers:**
- OpenAI (GPT-4, GPT-3.5-turbo)
- Anthropic (Claude 3)
- Google (Gemini Pro)

**Key Features:**
- Pluggable architecture
- Consistent interface across providers
- Token usage tracking
- Error handling

## Data Flow

### Request Processing

```typescript
// 1. Check cache
const cacheKey = generateCacheKey(userId, query, topK);
const cached = await getCachedResponse(cacheKey);
if (cached) return cached;

// 2. Vector search
const embedding = await generateQueryEmbedding(query, apiKey);
const chunks = await searchVectors(embedding, { topK, filter: { user_id: userId } });

// 3. Graph context
const chunkIds = chunks.map(c => c.id);
const graphContext = await getGraphContext(chunkIds, userId);
const docMetadata = await getDocumentMetadata(chunkIds);

// 4. Build prompt
const sources = buildSourceContexts(chunks, docMetadata);
const prompt = buildRAGPrompt({ query, sources, graphContext });

// 5. LLM call
const llm = getDefaultLLMClient();
const response = await llm.chat([
  { role: 'system', content: RAG_SYSTEM_PROMPT },
  { role: 'user', content: prompt },
]);

// 6. Parse and return
const citations = parseCitations(response.content);
const confidence = extractConfidence(response.content);

// 7. Cache result
await cacheResponse(cacheKey, { answer, citations, confidence });

return { answer, citations, confidence, latency, ... };
```

## Configuration

### Required Environment Variables

```bash
# LLM
EMERGENT_LLM_KEY=xxx
LLM_PROVIDER=openai
LLM_MODEL=gpt-4-turbo-preview

# Embeddings
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=xxx
PINECONE_INDEX_NAME=lifeos-embeddings

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Performance Optimization

### Timing Breakdown (Typical)

```
Vector Search:   200-300ms
Graph Context:   100-200ms
LLM Call:        800-1500ms
Total (no cache): 1100-2000ms
Total (cached):  < 10ms
```

### Optimization Strategies

1. **Caching** (most effective)
   - Reduces latency by 99%+
   - Hit rate typically 30-50% for common queries

2. **Parallel Processing**
   - Graph context + metadata fetched in parallel
   - Batch embeddings when possible

3. **Model Selection**
   - GPT-3.5-turbo: Faster, cheaper, good quality
   - GPT-4: Slower, expensive, better reasoning
   - Claude: Balanced performance

4. **top_k Tuning**
   - Fewer chunks = faster processing
   - Start with 5, increase if needed

## Error Handling

### Graceful Degradation

```typescript
// Graph context failure doesn't break request
try {
  graphContext = await getGraphContext(...);
} catch (error) {
  logger.error('Graph context failed:', error);
  graphContext = { nodes: [], relationships: [], contextSummary: '' };
}

// Continue without graph enrichment
```

### Retry Logic

```typescript
// LLM calls with exponential backoff
const response = await retryWithBackoff(
  () => llm.chat(messages),
  { maxRetries: 3, baseDelay: 1000 }
);
```

## Testing

See `/app/backend/src/services/rag/__tests__/` for unit tests.

### Test Coverage

- Vector search: Mock Pinecone responses
- Graph context: Mock Neo4j queries
- Prompt templates: Citation parsing, confidence extraction
- Cache: Redis operations
- LLM client: Mock API responses

## Monitoring

### Key Metrics

1. **Latency**
   - p50, p95, p99 response times
   - Cache hit rate

2. **Quality**
   - Confidence distribution
   - Citation density
   - "I don't know" rate

3. **Cost**
   - LLM token usage
   - API call counts

4. **Errors**
   - Failed queries
   - Timeout rate
   - API errors

## Future Enhancements

1. **Semantic Caching**: Cache similar queries (fuzzy matching)
2. **Streaming**: Stream LLM responses for faster TTFB
3. **Multi-turn**: Support follow-up questions with context
4. **Feedback Loop**: Learn from user feedback
5. **Query Rewriting**: Improve query quality before search
6. **Hybrid Search**: Combine keyword + semantic search
