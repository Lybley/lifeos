# Personal Memory Graph (PMG) - Query Examples

This document provides practical query examples for common operations in the PMG system, demonstrating how to use both Neo4j and PostgreSQL together.

---

## Table of Contents

1. [Basic Node Queries (Neo4j)](#basic-node-queries-neo4j)
2. [Relationship Traversal (Neo4j)](#relationship-traversal-neo4j)
3. [Pattern Matching (Neo4j)](#pattern-matching-neo4j)
4. [Metadata Queries (PostgreSQL)](#metadata-queries-postgresql)
5. [Hybrid Queries (Neo4j + PostgreSQL)](#hybrid-queries-neo4j--postgresql)
6. [Search Queries](#search-queries)
7. [Analytics Queries](#analytics-queries)
8. [Performance Optimization](#performance-optimization)

---

## Basic Node Queries (Neo4j)

### 1. Find all nodes owned by a user

```cypher
MATCH (u:User {email: 'john.doe@example.com'})-[:OWNS]->(node)
RETURN 
    labels(node) as node_type,
    node.id as id,
    node.title as title,
    node.created_at as created_at
ORDER BY node.created_at DESC
LIMIT 50;
```

### 2. Get all tasks with status and priority

```cypher
MATCH (t:Task)
WHERE t.status IN ['todo', 'in_progress']
RETURN 
    t.id,
    t.title,
    t.status,
    t.priority,
    t.due_date,
    t.tags
ORDER BY 
    CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    t.due_date ASC;
```

### 3. Find documents by tag

```cypher
MATCH (d:Document)
WHERE 'strategy' IN d.tags
RETURN 
    d.id,
    d.title,
    d.doc_type,
    d.created_at,
    d.tags
ORDER BY d.created_at DESC;
```

### 4. Get all messages in a thread

```cypher
MATCH (m:Message)
WHERE m.thread_id = 'thread-abc-123'
RETURN 
    m.id,
    m.subject,
    m.body,
    m.direction,
    m.sent_at
ORDER BY m.sent_at ASC;
```

### 5. Find upcoming events

```cypher
MATCH (e:Event)
WHERE e.start_time > datetime()
  AND e.start_time < datetime() + duration('P7D') // Next 7 days
RETURN 
    e.id,
    e.title,
    e.event_type,
    e.start_time,
    e.end_time,
    e.location
ORDER BY e.start_time ASC;
```

---

## Relationship Traversal (Neo4j)

### 6. Find all people mentioned in documents

```cypher
MATCH (d:Document)-[:MENTIONS]->(p:Person)
RETURN 
    p.name,
    p.email,
    COUNT(d) as mentions_count,
    COLLECT(d.title)[..5] as sample_documents
ORDER BY mentions_count DESC;
```

### 7. Get all tasks assigned to a person

```cypher
MATCH (t:Task)-[r:ASSIGNED_TO]->(p:Person {email: 'alice@example.com'})
RETURN 
    t.id,
    t.title,
    t.status,
    t.priority,
    t.due_date,
    r.assigned_at,
    r.role
ORDER BY t.due_date ASC;
```

### 8. Find what events a person attended

```cypher
MATCH (e:Event)-[r:ATTENDED_BY]->(p:Person {name: 'Alice Johnson'})
RETURN 
    e.title,
    e.event_type,
    e.start_time,
    r.attendance_status
ORDER BY e.start_time DESC
LIMIT 10;
```

### 9. Get all documents referenced by tasks

```cypher
MATCH (t:Task)-[r:REFERENCES]->(d:Document)
WHERE t.status <> 'completed'
RETURN 
    t.title as task,
    t.status,
    d.title as document,
    r.reference_type
ORDER BY t.priority, t.due_date;
```

---

## Pattern Matching (Neo4j)

### 10. Find collaboration networks (who works with whom)

```cypher
MATCH (u:User)-[:KNOWS]->(p1:Person),
      (p1)<-[:ATTENDED_BY]-(e:Event)-[:ATTENDED_BY]->(p2:Person)
WHERE p1 <> p2
RETURN 
    p1.name as person1,
    p2.name as person2,
    COUNT(DISTINCT e) as meetings_together,
    COLLECT(DISTINCT e.title)[..3] as sample_meetings
ORDER BY meetings_together DESC
LIMIT 20;
```

### 11. Find documents related to upcoming events

```cypher
MATCH (e:Event)-[:RELATED_TO]->(d:Document)
WHERE e.start_time > datetime()
  AND e.start_time < datetime() + duration('P14D')
RETURN 
    e.title as event,
    e.start_time,
    d.title as document,
    d.doc_type
ORDER BY e.start_time ASC;
```

### 12. Discover task dependencies (blocking chains)

```cypher
MATCH path = (t1:Task)-[:BLOCKS*1..3]->(t2:Task)
WHERE t1.status <> 'completed'
RETURN 
    [node IN nodes(path) | node.title] as task_chain,
    length(path) as chain_length
ORDER BY chain_length DESC;
```

### 13. Find "forgotten" tasks (no recent activity)

```cypher
MATCH (t:Task)
WHERE t.status IN ['todo', 'in_progress']
  AND t.updated_at < datetime() - duration('P30D')
  AND NOT (t)<-[:MENTIONS]-(:Message {sent_at: t.updated_at})
RETURN 
    t.id,
    t.title,
    t.status,
    t.updated_at,
    duration.between(t.updated_at, datetime()).days as days_stale
ORDER BY days_stale DESC;
```

### 14. Find your strongest connections (social graph)

```cypher
MATCH (u:User {email: 'john.doe@example.com'})-[k:KNOWS]->(p:Person)
OPTIONAL MATCH (p)<-[:MENTIONS]-(m:Message)
OPTIONAL MATCH (p)<-[:ATTENDED_BY]-(e:Event)
WITH 
    p,
    k.strength as connection_strength,
    COUNT(DISTINCT m) as message_mentions,
    COUNT(DISTINCT e) as events_attended
RETURN 
    p.name,
    p.email,
    p.company,
    connection_strength,
    message_mentions + events_attended as interaction_count
ORDER BY interaction_count DESC, connection_strength DESC
LIMIT 20;
```

### 15. Find related content (semantic links)

```cypher
MATCH (d:Document {id: 'doc-001'})-[:RELATED_TO]-(related)
WHERE related:Document OR related:Message OR related:Task
RETURN 
    labels(related)[0] as type,
    related.id,
    related.title,
    related.created_at
ORDER BY related.created_at DESC;
```

---

## Metadata Queries (PostgreSQL)

### 16. Get user activity summary

```sql
SELECT 
    u.email,
    u.name,
    COUNT(n.id) as total_nodes,
    COUNT(CASE WHEN n.node_type = 'Document' THEN 1 END) as documents,
    COUNT(CASE WHEN n.node_type = 'Task' THEN 1 END) as tasks,
    COUNT(CASE WHEN n.node_type = 'Event' THEN 1 END) as events,
    COUNT(ve.id) as embeddings,
    u.storage_used_bytes / (1024.0 * 1024.0) as storage_mb
FROM users u
LEFT JOIN nodes n ON u.id = n.user_id AND n.is_deleted = false
LEFT JOIN vector_embeddings ve ON n.id = ve.node_id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.name, u.storage_used_bytes;
```

### 17. Check ingestion pipeline health

```sql
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    source_system,
    status,
    COUNT(*) as count,
    AVG(processing_time_ms) as avg_time_ms,
    MAX(processing_time_ms) as max_time_ms
FROM ingestion_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), source_system, status
ORDER BY hour DESC, source_system;
```

### 18. Find nodes without vector embeddings

```sql
SELECT 
    n.id,
    n.node_type,
    n.title,
    n.created_at
FROM nodes n
LEFT JOIN vector_embeddings ve ON n.id = ve.node_id
WHERE n.is_deleted = false
  AND n.node_type IN ('Document', 'Message')
  AND ve.id IS NULL
ORDER BY n.created_at ASC
LIMIT 100;
```

### 19. Audit recent permission changes

```sql
SELECT 
    p.granted_at,
    u_owner.email as granted_by_email,
    u_grantee.email as granted_to_email,
    n.node_type,
    n.title as node_title,
    p.permission_type,
    p.expires_at
FROM permissions p
JOIN users u_owner ON p.granted_by = u_owner.id
LEFT JOIN users u_grantee ON p.user_id = u_grantee.id
JOIN nodes n ON p.node_id = n.id
WHERE p.granted_at > NOW() - INTERVAL '7 days'
ORDER BY p.granted_at DESC;
```

### 20. Check sync status for all integrations

```sql
SELECT 
    integration_type,
    last_sync_at,
    last_successful_sync_at,
    next_sync_at,
    error_count,
    CASE 
        WHEN error_count = 0 THEN 'Healthy'
        WHEN error_count < 3 THEN 'Warning'
        ELSE 'Critical'
    END as status,
    CASE 
        WHEN is_enabled THEN 'Enabled'
        ELSE 'Disabled'
    END as state,
    last_error
FROM sync_status
WHERE user_id = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid
ORDER BY error_count DESC, integration_type;
```

---

## Hybrid Queries (Neo4j + PostgreSQL)

### 21. Get enriched node data

**Step 1: Query Neo4j for graph relationships**
```cypher
MATCH (d:Document {id: 'doc-001'})-[r]-(related)
RETURN 
    d.id as document_id,
    type(r) as relationship_type,
    related.id as related_id,
    labels(related)[0] as related_type;
```

**Step 2: Query PostgreSQL for metadata**
```sql
SELECT 
    n.id,
    n.node_type,
    n.title,
    n.created_at,
    n.metadata,
    ve.pinecone_id,
    ve.embedding_model,
    u.email as owner_email
FROM nodes n
JOIN users u ON n.user_id = u.id
LEFT JOIN vector_embeddings ve ON n.id = ve.node_id
WHERE n.neo4j_id = 'doc-001';
```

### 22. Track content evolution (version history via logs)

**PostgreSQL query:**
```sql
SELECT 
    il.created_at,
    il.ingestion_type,
    il.source_system,
    il.status,
    il.metadata->>'file_size' as file_size,
    il.metadata->>'content_hash' as content_hash
FROM ingestion_logs il
WHERE il.node_id = 'doc-11111111-1111-1111-1111-111111111111'::uuid
ORDER BY il.created_at DESC;
```

**Neo4j query to see current state:**
```cypher
MATCH (d:Document {id: 'doc-001'})
RETURN 
    d.title,
    d.content,
    d.updated_at,
    d.file_size,
    d.tags;
```

---

## Search Queries

### 23. Full-text search in PostgreSQL

```sql
SELECT 
    n.id,
    n.node_type,
    n.title,
    si.content_text,
    ts_rank(si.search_vector, plainto_tsquery('english', 'strategy meeting')) as rank
FROM search_index si
JOIN nodes n ON si.node_id = n.id
WHERE si.search_vector @@ plainto_tsquery('english', 'strategy meeting')
  AND n.is_deleted = false
ORDER BY rank DESC, n.created_at DESC
LIMIT 20;
```

### 24. Full-text search in Neo4j

```cypher
CALL db.index.fulltext.queryNodes('document_content_fulltext', 'strategy OR planning')
YIELD node, score
RETURN 
    node.id,
    node.title,
    node.doc_type,
    node.created_at,
    score
ORDER BY score DESC
LIMIT 20;
```

### 25. Fuzzy name search (PostgreSQL with trigrams)

```sql
SELECT 
    p.name,
    p.email,
    p.company,
    similarity(p.name, 'Alise Jonson') as similarity_score
FROM nodes n
JOIN LATERAL (
    SELECT 
        n.metadata->>'name' as name,
        n.metadata->>'email' as email,
        n.metadata->>'company' as company
) p ON true
WHERE n.node_type = 'Person'
  AND n.is_deleted = false
  AND similarity(p.name, 'Alise Jonson') > 0.3
ORDER BY similarity_score DESC
LIMIT 10;
```

### 26. Semantic search workflow (conceptual)

**Step 1: Generate embedding for query (application code)**
```javascript
const queryEmbedding = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: 'What are our Q1 priorities?'
});
```

**Step 2: Query Pinecone for similar vectors**
```javascript
const queryResponse = await pineconeIndex.query({
  vector: queryEmbedding.data[0].embedding,
  topK: 10,
  includeMetadata: true
});
```

**Step 3: Get node details from PostgreSQL**
```sql
SELECT 
    n.id,
    n.node_type,
    n.title,
    n.created_at,
    n.metadata
FROM nodes n
JOIN vector_embeddings ve ON n.id = ve.node_id
WHERE ve.pinecone_id = ANY($1::text[]) -- IDs from Pinecone
  AND n.is_deleted = false;
```

**Step 4: Get relationships from Neo4j**
```cypher
MATCH (n)-[r]-(related)
WHERE n.id IN $nodeIds
RETURN n, r, related;
```

---

## Analytics Queries

### 27. Content creation trends (PostgreSQL)

```sql
SELECT 
    DATE_TRUNC('day', n.created_at) as date,
    n.node_type,
    COUNT(*) as count
FROM nodes n
WHERE n.created_at > NOW() - INTERVAL '90 days'
  AND n.is_deleted = false
GROUP BY DATE_TRUNC('day', n.created_at), n.node_type
ORDER BY date DESC, node_type;
```

### 28. Task completion rate (Neo4j)

```cypher
MATCH (t:Task)
WHERE t.created_at > datetime() - duration('P30D')
WITH 
    COUNT(t) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
RETURN 
    total_tasks,
    completed_tasks,
    ROUND(100.0 * completed_tasks / total_tasks, 2) as completion_rate;
```

### 29. Most connected nodes (centrality analysis)

```cypher
MATCH (n)-[r]-()
WHERE n:Document OR n:Person OR n:Task
WITH n, COUNT(r) as connection_count, labels(n)[0] as node_type
ORDER BY connection_count DESC
LIMIT 20
RETURN 
    node_type,
    n.id,
    n.title as title,
    connection_count;
```

### 30. Meeting efficiency analysis

```cypher
MATCH (e:Event {event_type: 'meeting'})-[:ATTENDED_BY]->(p:Person)
WHERE e.start_time > datetime() - duration('P30D')
WITH 
    e,
    COUNT(p) as attendee_count,
    duration.between(e.start_time, e.end_time).minutes as duration_minutes
RETURN 
    e.title,
    e.start_time,
    attendee_count,
    duration_minutes,
    attendee_count * duration_minutes as person_minutes
ORDER BY person_minutes DESC;
```

---

## Performance Optimization

### 31. Create query profile (Neo4j)

```cypher
PROFILE
MATCH (u:User {email: 'john.doe@example.com'})-[:OWNS]->(d:Document)
WHERE d.created_at > datetime() - duration('P7D')
RETURN d.title, d.created_at
ORDER BY d.created_at DESC
LIMIT 10;
```

### 32. Check index usage (PostgreSQL)

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 33. Batch operations (Neo4j)

```cypher
// Instead of multiple single creates:
UNWIND $batch AS item
MERGE (d:Document {id: item.id})
ON CREATE SET 
    d.title = item.title,
    d.content = item.content,
    d.created_at = datetime(item.created_at)
ON MATCH SET 
    d.updated_at = datetime();
```

### 34. Efficient relationship creation

```cypher
// Load nodes first
MATCH (u:User {id: $userId})
WITH u
UNWIND $documentIds AS docId
MATCH (d:Document {id: docId})
MERGE (u)-[r:OWNS]->(d)
ON CREATE SET r.created_at = datetime();
```

### 35. Pagination with cursor (PostgreSQL)

```sql
-- First page
SELECT id, title, created_at
FROM nodes
WHERE node_type = 'Document'
  AND is_deleted = false
ORDER BY created_at DESC, id
LIMIT 20;

-- Next page (using last id and created_at from previous result)
SELECT id, title, created_at
FROM nodes
WHERE node_type = 'Document'
  AND is_deleted = false
  AND (created_at, id) < ('2024-01-20 10:30:00+00', 'doc-previous-id'::uuid)
ORDER BY created_at DESC, id
LIMIT 20;
```

---

## Best Practices Summary

### Neo4j Queries:
1. **Use parameters** instead of string concatenation
2. **Create indexes** on frequently queried properties
3. **Use PROFILE/EXPLAIN** to analyze query performance
4. **Limit traversal depth** (avoid unbounded relationships like `[:REL*]`)
5. **Batch operations** for bulk inserts/updates

### PostgreSQL Queries:
1. **Use prepared statements** to prevent SQL injection
2. **Create appropriate indexes** (B-tree, GIN, trigram)
3. **Use EXPLAIN ANALYZE** to check query plans
4. **Partition large tables** by user_id or date
5. **Use connection pooling** for better performance

### Hybrid Approach:
1. **Query Neo4j for relationships** and traversals
2. **Query PostgreSQL for metadata** and transactional data
3. **Use application layer** to combine results efficiently
4. **Cache frequently accessed data** in Redis
5. **Async processing** for expensive operations (embeddings, sync)

---

This query collection provides a solid foundation for working with the Personal Memory Graph system!
