// ============================================================================
// MULTI-LAYER MEMORY GRAPH - NEO4J SCHEMA
// ============================================================================

// ----------------------------------------------------------------------------
// NODE CONSTRAINTS & INDEXES
// ----------------------------------------------------------------------------

// Memory Node Constraint
CREATE CONSTRAINT memory_id_unique IF NOT EXISTS
FOR (m:Memory) REQUIRE m.id IS UNIQUE;

// User Node Constraint
CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.id IS UNIQUE;

// Indexes for Memory Properties
CREATE INDEX memory_type_idx IF NOT EXISTS
FOR (m:Memory) ON (m.memoryType);

CREATE INDEX memory_user_idx IF NOT EXISTS
FOR (m:Memory) ON (m.userId);

CREATE INDEX memory_created_idx IF NOT EXISTS
FOR (m:Memory) ON (m.createdAt);

CREATE INDEX memory_accessed_idx IF NOT EXISTS
FOR (m:Memory) ON (m.lastAccessedAt);

CREATE INDEX memory_composite_score_idx IF NOT EXISTS
FOR (m:Memory) ON (m.compositeScore);

CREATE INDEX memory_importance_idx IF NOT EXISTS
FOR (m:Memory) ON (m.importanceScore);

// Full-text search index for memory content
CREATE FULLTEXT INDEX memory_content_fulltext IF NOT EXISTS
FOR (m:Memory) ON EACH [m.content, m.summary];

// ----------------------------------------------------------------------------
// MEMORY TYPE LABELS
// ----------------------------------------------------------------------------

// Apply specific labels for each memory type for efficient filtering
// Example: (:Memory:Working), (:Memory:Episodic), etc.

// Working Memory Constraint
CREATE INDEX working_memory_idx IF NOT EXISTS
FOR (m:WorkingMemory) ON (m.id);

// Episodic Memory Constraint
CREATE INDEX episodic_memory_idx IF NOT EXISTS
FOR (m:EpisodicMemory) ON (m.id);

// Semantic Memory Constraint
CREATE INDEX semantic_memory_idx IF NOT EXISTS
FOR (m:SemanticMemory) ON (m.id);

// Social Memory Constraint
CREATE INDEX social_memory_idx IF NOT EXISTS
FOR (m:SocialMemory) ON (m.id);

// Emotional Memory Constraint
CREATE INDEX emotional_memory_idx IF NOT EXISTS
FOR (m:EmotionalMemory) ON (m.id);

// ----------------------------------------------------------------------------
// SAMPLE MEMORY NODE STRUCTURE
// ----------------------------------------------------------------------------

/*
CREATE (m:Memory:EpisodicMemory {
  id: 'mem_123',
  userId: 'user_456',
  memoryType: 'episodic',
  
  // Content
  content: 'Had a great meeting with Sarah about the new product launch',
  summary: 'Product launch meeting with Sarah',
  vectorId: 'pinecone_vec_789',
  
  // Temporal
  createdAt: datetime('2025-01-15T10:30:00Z'),
  lastAccessedAt: datetime('2025-01-15T10:30:00Z'),
  expiresAt: null,
  
  // Scores (0-1)
  importanceScore: 0.75,
  recencyScore: 1.0,
  frequencyScore: 0.0,
  emotionalScore: 0.6,
  socialScore: 0.8,
  compositeScore: 0.75,
  
  // Reinforcement
  accessCount: 0,
  reinforcementCount: 0,
  lastReinforcedAt: null,
  
  // Decay
  decayRate: 0.3,
  halfLife: 168,
  
  // Context
  context: ['work', 'product', 'meeting'],
  source: 'calendar'
})
*/

// ----------------------------------------------------------------------------
// RELATIONSHIP TYPES
// ----------------------------------------------------------------------------

// RELATES_TO: Generic memory connection
// Properties: strength (0-1), type (string), createdAt

// PRECEDED_BY / FOLLOWED_BY: Temporal sequence
// Properties: timeDelta (hours)

// CAUSED_BY / CAUSED: Causal relationships
// Properties: confidence (0-1)

// SIMILAR_TO: Content similarity
// Properties: similarityScore (0-1), basis (string)

// INCLUDES / PART_OF: Hierarchical containment
// Properties: none

// MENTIONS: References to entities (people, places, concepts)
// Properties: entityType (string), entityId (string)

// REINFORCES: Reinforcement connections
// Properties: reinforcementType (string), boostedAt (datetime)

// PROMOTED_FROM / DEMOTED_FROM: Layer transitions
// Properties: promotedAt (datetime), reason (string)

// ----------------------------------------------------------------------------
// RELATIONSHIP INDEXES
// ----------------------------------------------------------------------------

CREATE INDEX relates_to_strength_idx IF NOT EXISTS
FOR ()-[r:RELATES_TO]-() ON (r.strength);

CREATE INDEX preceded_by_time_idx IF NOT EXISTS
FOR ()-[r:PRECEDED_BY]-() ON (r.timeDelta);

CREATE INDEX similar_to_score_idx IF NOT EXISTS
FOR ()-[r:SIMILAR_TO]-() ON (r.similarityScore);

// ----------------------------------------------------------------------------
// SAMPLE MEMORY GRAPH CREATION
// ----------------------------------------------------------------------------

/*
// Create a user
CREATE (u:User {
  id: 'user_123',
  name: 'John Doe',
  createdAt: datetime()
})

// Create working memory
CREATE (w:Memory:WorkingMemory {
  id: 'mem_w_001',
  userId: 'user_123',
  memoryType: 'working',
  content: 'Need to review Q4 budget by end of day',
  summary: 'Q4 budget review task',
  importanceScore: 0.9,
  recencyScore: 1.0,
  frequencyScore: 0.0,
  emotionalScore: 0.3,
  socialScore: 0.0,
  compositeScore: 0.8,
  createdAt: datetime(),
  lastAccessedAt: datetime(),
  accessCount: 0,
  reinforcementCount: 0,
  decayRate: 0.8,
  halfLife: 2,
  context: ['work', 'finance', 'urgent'],
  source: 'manual'
})

// Create episodic memory
CREATE (e:Memory:EpisodicMemory {
  id: 'mem_e_001',
  userId: 'user_123',
  memoryType: 'episodic',
  content: 'Had lunch with Sarah at the Italian restaurant downtown. Discussed vacation plans.',
  summary: 'Lunch with Sarah, discussed vacation',
  importanceScore: 0.6,
  recencyScore: 0.8,
  frequencyScore: 0.2,
  emotionalScore: 0.7,
  socialScore: 0.9,
  compositeScore: 0.7,
  createdAt: datetime('2025-01-10T12:30:00Z'),
  lastAccessedAt: datetime('2025-01-12T15:00:00Z'),
  accessCount: 3,
  reinforcementCount: 1,
  decayRate: 0.3,
  halfLife: 168,
  context: ['personal', 'social', 'food'],
  source: 'calendar'
})

// Create semantic memory
CREATE (s:Memory:SemanticMemory {
  id: 'mem_s_001',
  userId: 'user_123',
  memoryType: 'semantic',
  content: 'Python is a high-level programming language known for readability and versatility',
  summary: 'Python programming language characteristics',
  importanceScore: 0.8,
  recencyScore: 0.5,
  frequencyScore: 0.6,
  emotionalScore: 0.0,
  socialScore: 0.0,
  compositeScore: 0.65,
  createdAt: datetime('2024-06-15T10:00:00Z'),
  lastAccessedAt: datetime('2025-01-05T14:20:00Z'),
  accessCount: 15,
  reinforcementCount: 3,
  decayRate: 0.1,
  halfLife: 720,
  context: ['knowledge', 'programming', 'technology'],
  source: 'manual'
})

// Create social memory
CREATE (so:Memory:SocialMemory {
  id: 'mem_so_001',
  userId: 'user_123',
  memoryType: 'social',
  content: 'Sarah Johnson, colleague from marketing department. Enjoys Italian food and traveling.',
  summary: 'Sarah Johnson profile',
  importanceScore: 0.75,
  recencyScore: 0.7,
  frequencyScore: 0.5,
  emotionalScore: 0.4,
  socialScore: 1.0,
  compositeScore: 0.72,
  createdAt: datetime('2024-09-01T09:00:00Z'),
  lastAccessedAt: datetime('2025-01-12T15:00:00Z'),
  accessCount: 8,
  reinforcementCount: 2,
  decayRate: 0.2,
  halfLife: 336,
  context: ['people', 'work', 'colleague'],
  source: 'contacts'
})

// Create relationships
MATCH (e:EpisodicMemory {id: 'mem_e_001'})
MATCH (so:SocialMemory {id: 'mem_so_001'})
CREATE (e)-[:MENTIONS {
  entityType: 'person',
  entityId: 'sarah_johnson',
  confidence: 1.0
}]->(so)

MATCH (w:WorkingMemory {id: 'mem_w_001'})
MATCH (e:EpisodicMemory {id: 'mem_e_001'})
CREATE (w)-[:RELATES_TO {
  strength: 0.3,
  type: 'contextual',
  createdAt: datetime()
}]->(e)
*/

// ----------------------------------------------------------------------------
// MEMORY RETRIEVAL QUERIES
// ----------------------------------------------------------------------------

// Query 1: Get all working memories for a user, ordered by composite score
/*
MATCH (m:Memory:WorkingMemory {userId: $userId})
WHERE m.compositeScore > 0.5
RETURN m
ORDER BY m.compositeScore DESC, m.lastAccessedAt DESC
LIMIT 10
*/

// Query 2: Get episodic memories related to a topic with context
/*
MATCH (m:Memory:EpisodicMemory {userId: $userId})
WHERE ANY(tag IN $searchTags WHERE tag IN m.context)
  AND m.recencyScore > 0.3
OPTIONAL MATCH (m)-[r:RELATES_TO]->(related:Memory)
WHERE r.strength > 0.5
RETURN m, collect(related) as relatedMemories
ORDER BY m.compositeScore DESC
LIMIT 20
*/

// Query 3: Get memory graph with relationships
/*
MATCH (m:Memory {userId: $userId})
WHERE m.id IN $memoryIds
OPTIONAL MATCH (m)-[r:RELATES_TO|SIMILAR_TO|MENTIONS]-(connected:Memory)
WHERE connected.compositeScore > 0.4
RETURN m, collect({rel: r, node: connected}) as connections
*/

// Query 4: Find memories by full-text search
/*
CALL db.index.fulltext.queryNodes('memory_content_fulltext', $searchQuery)
YIELD node, score
MATCH (node)-[:BELONGS_TO]->(u:User {id: $userId})
WHERE node.compositeScore > 0.3
RETURN node, score
ORDER BY score DESC, node.compositeScore DESC
LIMIT 15
*/

// Query 5: Get memories due for reinforcement
/*
MATCH (m:Memory {userId: $userId})
WHERE m.memoryType IN ['working', 'episodic', 'social', 'emotional']
  AND m.lastReinforcedAt < datetime() - duration({hours: m.halfLife})
  AND m.importanceScore > 0.6
RETURN m
ORDER BY m.importanceScore DESC
LIMIT 50
*/

// Query 6: Promote working memory to episodic
/*
MATCH (m:Memory:WorkingMemory {id: $memoryId})
WHERE m.compositeScore > 0.7 AND m.accessCount > 5
SET m:EpisodicMemory,
    m.memoryType = 'episodic',
    m.decayRate = 0.3,
    m.halfLife = 168
REMOVE m:WorkingMemory
WITH m
CREATE (m)-[:PROMOTED_FROM {
  previousType: 'working',
  promotedAt: datetime(),
  reason: 'high_engagement'
}]->(m)
RETURN m
*/

// Query 7: Archive old low-score memories
/*
MATCH (m:Memory {userId: $userId})
WHERE m.compositeScore < 0.1
  AND duration.between(m.createdAt, datetime()).days > 30
SET m.archived = true,
    m.archivedAt = datetime()
RETURN count(m) as archivedCount
*/

// Query 8: Get memory timeline (episodic memories in chronological order)
/*
MATCH (m:Memory:EpisodicMemory {userId: $userId})
WHERE m.createdAt >= datetime($startDate)
  AND m.createdAt <= datetime($endDate)
OPTIONAL MATCH (m)-[:PRECEDED_BY]->(prev:Memory)
OPTIONAL MATCH (m)-[:FOLLOWED_BY]->(next:Memory)
RETURN m, prev, next
ORDER BY m.createdAt ASC
*/

// ----------------------------------------------------------------------------
// MAINTENANCE & ANALYTICS QUERIES
// ----------------------------------------------------------------------------

// Get memory distribution by type
/*
MATCH (m:Memory {userId: $userId})
RETURN m.memoryType as type,
       count(m) as count,
       avg(m.compositeScore) as avgScore,
       avg(m.accessCount) as avgAccess
ORDER BY count DESC
*/

// Get memory health score
/*
MATCH (m:Memory {userId: $userId})
WITH count(m) as totalMemories,
     avg(m.compositeScore) as avgScore,
     sum(CASE WHEN m.compositeScore > 0.7 THEN 1 ELSE 0 END) as highQuality,
     sum(CASE WHEN m.compositeScore < 0.3 THEN 1 ELSE 0 END) as lowQuality
RETURN totalMemories,
       avgScore,
       highQuality,
       lowQuality,
       (highQuality * 1.0 / totalMemories) as qualityRatio
*/

// Find orphaned memories (no relationships)
/*
MATCH (m:Memory {userId: $userId})
WHERE NOT (m)-[:RELATES_TO|SIMILAR_TO|MENTIONS]-()
  AND duration.between(m.createdAt, datetime()).days > 7
RETURN m
ORDER BY m.compositeScore DESC
*/
