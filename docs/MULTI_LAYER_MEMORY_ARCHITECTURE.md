# Multi-Layer Memory Architecture for LifeOS

## Overview

The Multi-Layer Memory Architecture extends the Personal Memory Graph (PMG) with five distinct memory types, each with unique characteristics, decay rates, and retrieval priorities. This mimics human memory systems for more intelligent and context-aware retrieval.

## Memory Types

### 1. Working Memory
- **Purpose**: Short-term, actively used information
- **Characteristics**:
  - High decay rate (0.8)
  - Short half-life (2 hours)
  - Maximum retention: 7 days
  - Highest priority in retrieval
- **Use Cases**: Current tasks, recent conversations, active projects
- **Example**: "Review Q4 budget by EOD", "Reply to Sarah's email"

### 2. Episodic Memory
- **Purpose**: Personal experiences and events
- **Characteristics**:
  - Moderate decay rate (0.3)
  - Medium half-life (7 days)
  - Maximum retention: 1 year
  - High emotional and temporal context
- **Use Cases**: Past meetings, conversations, project milestones
- **Example**: "Lunch with Sarah discussing vacation plans", "Q3 product launch event"

### 3. Semantic Memory
- **Purpose**: Facts, knowledge, and concepts
- **Characteristics**:
  - Low decay rate (0.1)
  - Long half-life (30 days)
  - Maximum retention: 5 years
  - No reinforcement required
- **Use Cases**: Technical knowledge, procedures, definitions
- **Example**: "OAuth 2.0 authentication flow", "Python async/await patterns"

### 4. Social Memory
- **Purpose**: People, relationships, and interactions
- **Characteristics**:
  - Slow decay rate (0.2)
  - Half-life: 14 days
  - Maximum retention: 2 years
  - High social score weight
- **Use Cases**: Contact information, relationship history, collaboration notes
- **Example**: "Sarah Johnson - Marketing colleague, enjoys Italian food"

### 5. Emotional Memory
- **Purpose**: Emotional states and affective experiences
- **Characteristics**:
  - Moderate-fast decay rate (0.4)
  - Half-life: 3 days
  - Maximum retention: 1 year
  - High emotional score weight
- **Use Cases**: Mood patterns, emotional reactions, sentiment
- **Example**: "Felt accomplished after presentation", "Frustration with bug #234"

## Scoring System

### Component Scores (0-1 scale)

1. **Importance Score**: Intrinsic significance of the memory
2. **Recency Score**: Time-based relevance (exponential decay)
3. **Frequency Score**: Access and reinforcement history (logarithmic)
4. **Emotional Score**: Emotional intensity or significance
5. **Social Score**: Social context and relationship weight

### Composite Score Calculation

```typescript
compositeScore = 
  (importanceScore * 0.30) +
  (recencyScore * 0.25) +
  (frequencyScore * 0.20) +
  (emotionalScore * 0.15) +
  (socialScore * 0.10)
```

### Decay Formula

```typescript
recencyScore = exp(-λ * t * decayRate)

where:
  λ = ln(2) / halfLife
  t = time since last access (hours)
  decayRate = memory type specific rate
```

## Reinforcement Rules

### Automatic Reinforcement

1. **Spaced Repetition**: Memory accessed multiple times within 24 hours
   - Boost: +15% importance
   - Schedule: Next boost in 24 hours

2. **Emotional Significance**: High emotional score + recent access
   - Boost: +20% importance
   - Schedule: Next boost in 48 hours

3. **High Frequency**: Accessed 10+ times
   - Boost: +10% frequency score
   - Schedule: Weekly boosts

### Scheduled Boosters

- **High Score (>0.8)**: Daily boosts
- **Medium Score (0.6-0.8)**: Every 3 days
- **Low Score (0.4-0.6)**: Weekly boosts
- **Very Low (<0.4)**: No scheduled boosts

## Neo4j Schema

### Node Structure

```cypher
CREATE (m:Memory:EpisodicMemory {
  id: 'mem_e_001',
  userId: 'user_123',
  memoryType: 'episodic',
  content: '...',
  summary: '...',
  
  // Scores
  importanceScore: 0.75,
  recencyScore: 0.85,
  frequencyScore: 0.40,
  emotionalScore: 0.60,
  socialScore: 0.30,
  compositeScore: 0.68,
  
  // Temporal
  createdAt: datetime(),
  lastAccessedAt: datetime(),
  expiresAt: null,
  
  // Reinforcement
  accessCount: 5,
  reinforcementCount: 2,
  lastReinforcedAt: datetime(),
  
  // Decay
  decayRate: 0.3,
  halfLife: 168,
  
  // Context
  context: ['work', 'meeting', 'planning'],
  vectorId: 'pinecone_vec_789'
})
```

### Relationship Types

- `RELATES_TO`: Generic connection (strength: 0-1)
- `PRECEDED_BY` / `FOLLOWED_BY`: Temporal sequence
- `SIMILAR_TO`: Content similarity
- `MENTIONS`: Entity references
- `REINFORCES`: Reinforcement connections
- `PROMOTED_FROM`: Layer transitions

### Key Indexes

```cypher
CREATE INDEX memory_composite_score_idx 
FOR (m:Memory) ON (m.compositeScore);

CREATE INDEX memory_type_user_idx 
FOR (m:Memory) ON (m.memoryType, m.userId);

CREATE FULLTEXT INDEX memory_content_fulltext
FOR (m:Memory) ON EACH [m.content, m.summary];
```

## Pinecone Vector Strategy

### Separate Indexes Per Memory Type

```
lifeos-{userHash}-working
lifeos-{userHash}-episodic
lifeos-{userHash}-semantic
lifeos-{userHash}-social
lifeos-{userHash}-emotional
```

### Indexed Metadata Fields

**Working Memory:**
- userId, memoryType, compositeScore, recencyScore, context, expiresAt

**Episodic Memory:**
- userId, memoryType, compositeScore, emotionalScore, source, createdAt

**Semantic Memory:**
- userId, memoryType, importanceScore, frequencyScore, category

**Social Memory:**
- userId, memoryType, socialScore, personId, relationshipType

**Emotional Memory:**
- userId, memoryType, emotionalScore, emotionType, valence, arousal

## Retrieval Strategy

### Default Priority Order

```
1. Working Memory (topK=5)
2. Episodic Memory (topK=5)  
3. Semantic Memory (topK=5)
4. Social Memory (topK=3)
```

### Context-Aware Strategies

**Recent Task Query:**
- Priority: Working (8) → Episodic (3) → Social (2)
- Boost: +25% for working memory, +10% for recency

**Factual Query:**
- Priority: Semantic (10) → Episodic (3) → Working (2)
- Boost: +20% for importance score

**Social Query:**
- Priority: Social (8) → Episodic (5) → Emotional (3)
- Boost: +15% for social score

**Emotional Query:**
- Priority: Emotional (8) → Episodic (5) → Social (3)
- Boost: +20% for emotional score

### Ranking Algorithm

```typescript
finalScore = (vectorSimilarity * 0.6) + (compositeScore * 0.4)

// Apply contextual boosts
if (hasEmotionalContent && emotionalScore > 0.5)
  finalScore *= 1.2

if (hasSocialContext && socialScore > 0.5)
  finalScore *= 1.15

if (isRecent && recencyScore > 0.7)
  finalScore *= 1.1

// Memory type priority
if (memoryType === WORKING && isRecentQuery)
  finalScore *= 1.25
```

## Memory Promotion

### Working → Episodic

**Criteria:**
- Composite score > 0.7
- Access count > 5
- Age > 1 day

**Changes:**
- Update memoryType label
- Set decayRate = 0.3
- Set halfLife = 168 hours
- Create PROMOTED_FROM relationship

### Episodic → Semantic

**Criteria:**
- Importance score > 0.8
- Emotional score < 0.3
- Access count > 10
- Age > 30 days

**Changes:**
- Update memoryType label
- Set decayRate = 0.1
- Set halfLife = 720 hours
- Remove emotional metadata

## Memory Archival

### Archive Conditions

1. Expired (expiresAt < now)
2. Beyond max retention period
3. Composite score < 0.1 AND age > 30 days
4. User-requested deletion

### Archive Process

```cypher
MATCH (m:Memory {id: $memoryId})
SET m.archived = true,
    m.archivedAt = datetime()
// Optionally delete from Pinecone
```

## Integration with RAG

### Step 1: Query Analysis

```typescript
const queryContext = analyzeQuery(userQuery);
// → { hasEmotionalContent, hasSocialContext, isFactual, isRecent }
```

### Step 2: Retrieve Memories

```typescript
const result = await memoryRanker.retrieveAndRankMemories(
  userId,
  queryEmbedding,
  userQuery,
  { queryContext }
);
```

### Step 3: Select Top Memories

```typescript
const topMemories = result.memories.slice(0, 5);
// Use in RAG prompt as context
```

### Step 4: Record Access

```typescript
for (const memory of topMemories) {
  await memoryRanker.recordMemoryAccess(
    userId,
    memory.memoryId,
    memory.memoryType,
    memory.relevanceScore
  );
}
```

## Monitoring & Analytics

### Key Metrics

1. **Memory Distribution**: Count by type
2. **Average Composite Score**: Quality indicator
3. **Retrieval Efficiency**: Used memories / total searched
4. **Layer Utilization**: Which layers contribute most
5. **Promotion Rate**: Working → Episodic transitions
6. **Archive Rate**: Memories archived per day

### Health Checks

```cypher
// Get memory health score
MATCH (m:Memory {userId: $userId})
WITH count(m) as total,
     avg(m.compositeScore) as avgScore,
     sum(CASE WHEN m.compositeScore > 0.7 THEN 1 ELSE 0 END) as highQuality
RETURN total, avgScore, 
       (highQuality * 1.0 / total) as qualityRatio
```

## Performance Considerations

### Index Maintenance

- Rebuild Pinecone indexes monthly
- Update Neo4j statistics weekly
- Clean up orphaned memories bi-weekly

### Optimization Tips

1. Use batch updates for score recalculation
2. Cache frequently accessed memories
3. Implement lazy loading for related memories
4. Use connection pooling for Neo4j
5. Implement query result caching

## Testing Strategy

### Unit Tests
- Score calculations
- Decay formulas
- Promotion/archival logic
- Reinforcement rules

### Integration Tests
- Multi-layer retrieval
- Context-aware ranking
- Memory promotion workflows
- Neo4j + Pinecone sync

### Performance Tests
- Retrieval latency (<500ms)
- Concurrent access handling
- Large memory graph scaling
- Vector index query speed

## Example Queries

See `/app/backend/src/services/memory/exampleRetrievalTraces.ts` for:
- Recent task query trace
- Factual query trace  
- Social query trace
- Mixed context query trace
- Detailed scoring breakdown

## Future Enhancements

1. **Adaptive Decay**: Learn optimal decay rates per user
2. **Memory Consolidation**: Merge similar memories automatically
3. **Predictive Boosting**: Boost memories likely to be needed
4. **Cross-User Patterns**: Learn from aggregate memory patterns
5. **Hierarchical Memories**: Parent-child memory relationships
6. **Time-Travel Queries**: "What did I know about X on date Y?"
