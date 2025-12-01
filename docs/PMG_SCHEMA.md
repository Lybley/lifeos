# Personal Memory Graph (PMG) Schema Design for LifeOS

## Overview

The PMG schema uses a hybrid database approach:
- **Neo4j**: Graph relationships, semantic connections, knowledge discovery
- **PostgreSQL**: Transactional metadata, audit logs, permissions, vector references

---

## Part 1: Neo4j Graph Schema

### Node Types

#### 1. User
Primary actor in the system, owns the personal memory graph.

**Properties:**
- `id` (UUID, required, unique)
- `email` (String, required, unique)
- `name` (String, required)
- `auth0_id` (String, unique)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `timezone` (String)
- `preferences` (JSON)

#### 2. Document
Any file, note, or written content.

**Properties:**
- `id` (UUID, required, unique)
- `title` (String, required)
- `content` (Text)
- `doc_type` (String: 'note', 'pdf', 'markdown', 'text')
- `file_path` (String)
- `file_size` (Integer)
- `mime_type` (String)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `tags` (Array of Strings)
- `status` (String: 'draft', 'published', 'archived')

#### 3. Message
Communication records (email, chat, SMS).

**Properties:**
- `id` (UUID, required, unique)
- `subject` (String)
- `body` (Text, required)
- `message_type` (String: 'email', 'chat', 'sms')
- `direction` (String: 'sent', 'received')
- `thread_id` (String)
- `sent_at` (DateTime, required)
- `created_at` (DateTime)
- `platform` (String: 'gmail', 'slack', 'whatsapp')
- `metadata` (JSON)

#### 4. Person
People in the user's network.

**Properties:**
- `id` (UUID, required, unique)
- `name` (String, required)
- `email` (String)
- `phone` (String)
- `company` (String)
- `role` (String)
- `relationship_type` (String: 'family', 'friend', 'colleague', 'client')
- `first_met_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `social_profiles` (JSON)
- `notes` (Text)

#### 5. Task
Action items, todos, and goals.

**Properties:**
- `id` (UUID, required, unique)
- `title` (String, required)
- `description` (Text)
- `status` (String: 'todo', 'in_progress', 'completed', 'cancelled')
- `priority` (String: 'low', 'medium', 'high', 'urgent')
- `due_date` (DateTime)
- `completed_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `estimated_hours` (Float)
- `tags` (Array of Strings)

#### 6. Event
Calendar events, meetings, appointments.

**Properties:**
- `id` (UUID, required, unique)
- `title` (String, required)
- `description` (Text)
- `event_type` (String: 'meeting', 'appointment', 'deadline', 'reminder')
- `location` (String)
- `start_time` (DateTime, required)
- `end_time` (DateTime, required)
- `all_day` (Boolean)
- `created_at` (DateTime)
- `updated_at` (DateTime)
- `recurrence_rule` (String)
- `metadata` (JSON)

---

### Relationship Types

#### Core Relationships

1. **OWNS**
   - From: User → To: [All node types]
   - Properties: `created_at`
   - Purpose: Ownership tracking

2. **CREATED**
   - From: User → To: [Document, Message, Task, Event]
   - Properties: `created_at`
   - Purpose: Authorship tracking

3. **KNOWS**
   - From: User → To: Person
   - Properties: `since` (DateTime), `strength` (Integer 1-10), `context` (String)
   - Purpose: Social network

4. **MENTIONS**
   - From: [Document, Message] → To: Person
   - Properties: `mentioned_at` (DateTime), `context` (String)
   - Purpose: Reference tracking

5. **REFERENCES**
   - From: [Any node] → To: [Any node]
   - Properties: `reference_type` (String), `created_at` (DateTime)
   - Purpose: Generic linking

6. **RELATED_TO**
   - From: [Any node] → To: [Any node]
   - Properties: `relationship_type` (String), `strength` (Float), `created_at` (DateTime)
   - Purpose: Semantic similarity

7. **ASSIGNED_TO**
   - From: Task → To: Person
   - Properties: `assigned_at` (DateTime), `role` (String)
   - Purpose: Task delegation

8. **ATTENDED_BY**
   - From: Event → To: Person
   - Properties: `attendance_status` (String: 'accepted', 'declined', 'maybe')
   - Purpose: Event participation

9. **BLOCKS**
   - From: Task → To: Task
   - Properties: `created_at` (DateTime)
   - Purpose: Task dependencies

10. **PART_OF**
    - From: [Document, Task, Event] → To: [Document, Task, Event]
    - Properties: `hierarchy_level` (Integer)
    - Purpose: Hierarchical organization

11. **SENT_TO** / **RECEIVED_FROM**
    - From: Message → To: Person
    - Properties: `sent_at` (DateTime)
    - Purpose: Communication tracking

12. **TAGGED_WITH**
    - From: [Any node] → To: Tag (if using tag nodes)
    - Properties: `created_at` (DateTime)
    - Purpose: Categorization

---

## Part 2: Cypher DDL Statements

### Constraints and Indexes

```cypher
// ============================================
// CONSTRAINTS (Uniqueness + Existence)
// ============================================

// User constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.id IS UNIQUE;

CREATE CONSTRAINT user_email_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.email IS UNIQUE;

CREATE CONSTRAINT user_id_exists IF NOT EXISTS
FOR (u:User) REQUIRE u.id IS NOT NULL;

// Document constraints
CREATE CONSTRAINT document_id_unique IF NOT EXISTS
FOR (d:Document) REQUIRE d.id IS UNIQUE;

CREATE CONSTRAINT document_id_exists IF NOT EXISTS
FOR (d:Document) REQUIRE d.id IS NOT NULL;

// Message constraints
CREATE CONSTRAINT message_id_unique IF NOT EXISTS
FOR (m:Message) REQUIRE m.id IS UNIQUE;

CREATE CONSTRAINT message_id_exists IF NOT EXISTS
FOR (m:Message) REQUIRE m.id IS NOT NULL;

// Person constraints
CREATE CONSTRAINT person_id_unique IF NOT EXISTS
FOR (p:Person) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT person_id_exists IF NOT EXISTS
FOR (p:Person) REQUIRE p.id IS NOT NULL;

// Task constraints
CREATE CONSTRAINT task_id_unique IF NOT EXISTS
FOR (t:Task) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT task_id_exists IF NOT EXISTS
FOR (t:Task) REQUIRE t.id IS NOT NULL;

// Event constraints
CREATE CONSTRAINT event_id_unique IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT event_id_exists IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS NOT NULL;

// ============================================
// INDEXES (Performance)
// ============================================

// User indexes
CREATE INDEX user_email_idx IF NOT EXISTS
FOR (u:User) ON (u.email);

CREATE INDEX user_created_at_idx IF NOT EXISTS
FOR (u:User) ON (u.created_at);

// Document indexes
CREATE INDEX document_title_idx IF NOT EXISTS
FOR (d:Document) ON (d.title);

CREATE INDEX document_type_idx IF NOT EXISTS
FOR (d:Document) ON (d.doc_type);

CREATE INDEX document_created_at_idx IF NOT EXISTS
FOR (d:Document) ON (d.created_at);

CREATE INDEX document_status_idx IF NOT EXISTS
FOR (d:Document) ON (d.status);

// Full-text search index for documents
CREATE FULLTEXT INDEX document_content_fulltext IF NOT EXISTS
FOR (d:Document) ON EACH [d.title, d.content];

// Message indexes
CREATE INDEX message_sent_at_idx IF NOT EXISTS
FOR (m:Message) ON (m.sent_at);

CREATE INDEX message_type_idx IF NOT EXISTS
FOR (m:Message) ON (m.message_type);

CREATE INDEX message_thread_idx IF NOT EXISTS
FOR (m:Message) ON (m.thread_id);

// Full-text search index for messages
CREATE FULLTEXT INDEX message_content_fulltext IF NOT EXISTS
FOR (m:Message) ON EACH [m.subject, m.body];

// Person indexes
CREATE INDEX person_name_idx IF NOT EXISTS
FOR (p:Person) ON (p.name);

CREATE INDEX person_email_idx IF NOT EXISTS
FOR (p:Person) ON (p.email);

CREATE INDEX person_company_idx IF NOT EXISTS
FOR (p:Person) ON (p.company);

CREATE INDEX person_relationship_type_idx IF NOT EXISTS
FOR (p:Person) ON (p.relationship_type);

// Task indexes
CREATE INDEX task_status_idx IF NOT EXISTS
FOR (t:Task) ON (t.status);

CREATE INDEX task_priority_idx IF NOT EXISTS
FOR (t:Task) ON (t.priority);

CREATE INDEX task_due_date_idx IF NOT EXISTS
FOR (t:Task) ON (t.due_date);

CREATE INDEX task_created_at_idx IF NOT EXISTS
FOR (t:Task) ON (t.created_at);

// Event indexes
CREATE INDEX event_start_time_idx IF NOT EXISTS
FOR (e:Event) ON (e.start_time);

CREATE INDEX event_type_idx IF NOT EXISTS
FOR (e:Event) ON (e.event_type);

CREATE INDEX event_created_at_idx IF NOT EXISTS
FOR (e:Event) ON (e.created_at);

// ============================================
// Relationship indexes
// ============================================

CREATE INDEX rel_created_at_idx IF NOT EXISTS
FOR ()-[r:OWNS]-() ON (r.created_at);

CREATE INDEX rel_strength_idx IF NOT EXISTS
FOR ()-[r:KNOWS]-() ON (r.strength);

CREATE INDEX rel_reference_type_idx IF NOT EXISTS
FOR ()-[r:REFERENCES]-() ON (r.reference_type);
```

### Sample Data Creation (6 Example Nodes)

```cypher
// ============================================
// SAMPLE DATA: Create 6 Example Nodes
// ============================================

// 1. Create User node
CREATE (u:User {
  id: 'user-001',
  email: 'john.doe@example.com',
  name: 'John Doe',
  auth0_id: 'auth0|507f1f77bcf86cd799439011',
  created_at: datetime('2024-01-15T09:00:00Z'),
  updated_at: datetime('2024-01-15T09:00:00Z'),
  timezone: 'America/New_York',
  preferences: '{
    "theme": "dark",
    "notifications": true,
    "language": "en"
  }'
})
RETURN u;

// 2. Create Document node
CREATE (d:Document {
  id: 'doc-001',
  title: 'Q1 2024 Strategy Document',
  content: 'Our strategic priorities for Q1 2024 include expanding market reach, improving customer satisfaction, and launching new product features.',
  doc_type: 'markdown',
  file_path: '/documents/q1-2024-strategy.md',
  file_size: 15420,
  mime_type: 'text/markdown',
  created_at: datetime('2024-01-20T10:30:00Z'),
  updated_at: datetime('2024-01-25T14:20:00Z'),
  tags: ['strategy', 'q1', '2024', 'planning'],
  status: 'published'
})
RETURN d;

// 3. Create Message node
CREATE (m:Message {
  id: 'msg-001',
  subject: 'Follow-up on Strategy Meeting',
  body: 'Hi team, following up on our strategy meeting from last week. Please review the attached document and provide feedback by Friday.',
  message_type: 'email',
  direction: 'sent',
  thread_id: 'thread-abc-123',
  sent_at: datetime('2024-01-26T09:15:00Z'),
  created_at: datetime('2024-01-26T09:15:00Z'),
  platform: 'gmail',
  metadata: '{
    "recipients": ["alice@example.com", "bob@example.com"],
    "cc": ["manager@example.com"],
    "has_attachments": true
  }'
})
RETURN m;

// 4. Create Person node
CREATE (p:Person {
  id: 'person-001',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  phone: '+1-555-0123',
  company: 'TechCorp Inc.',
  role: 'Product Manager',
  relationship_type: 'colleague',
  first_met_at: datetime('2023-06-15T00:00:00Z'),
  created_at: datetime('2024-01-10T08:00:00Z'),
  updated_at: datetime('2024-01-10T08:00:00Z'),
  social_profiles: '{
    "linkedin": "linkedin.com/in/alicejohnson",
    "twitter": "@alicejohnson"
  }',
  notes: 'Met at company onboarding. Very collaborative and detail-oriented.'
})
RETURN p;

// 5. Create Task node
CREATE (t:Task {
  id: 'task-001',
  title: 'Review Q1 Strategy Document',
  description: 'Read through the Q1 strategy document and provide detailed feedback on proposed initiatives.',
  status: 'in_progress',
  priority: 'high',
  due_date: datetime('2024-01-31T17:00:00Z'),
  completed_at: null,
  created_at: datetime('2024-01-26T09:30:00Z'),
  updated_at: datetime('2024-01-27T11:00:00Z'),
  estimated_hours: 2.5,
  tags: ['review', 'strategy', 'urgent']
})
RETURN t;

// 6. Create Event node
CREATE (e:Event {
  id: 'event-001',
  title: 'Q1 Strategy Review Meeting',
  description: 'Quarterly strategy review with leadership team to discuss priorities and resource allocation.',
  event_type: 'meeting',
  location: 'Conference Room A / Zoom',
  start_time: datetime('2024-02-01T14:00:00Z'),
  end_time: datetime('2024-02-01T15:30:00Z'),
  all_day: false,
  created_at: datetime('2024-01-20T10:00:00Z'),
  updated_at: datetime('2024-01-20T10:00:00Z'),
  recurrence_rule: null,
  metadata: '{
    "zoom_link": "https://zoom.us/j/123456789",
    "organizer": "john.doe@example.com",
    "calendar_id": "cal-primary"
  }'
})
RETURN e;

// ============================================
// Create Relationships Between Nodes
// ============================================

// User OWNS all nodes
MATCH (u:User {id: 'user-001'})
MATCH (d:Document {id: 'doc-001'})
MATCH (m:Message {id: 'msg-001'})
MATCH (p:Person {id: 'person-001'})
MATCH (t:Task {id: 'task-001'})
MATCH (e:Event {id: 'event-001'})
CREATE (u)-[:OWNS {created_at: datetime()}]->(d)
CREATE (u)-[:OWNS {created_at: datetime()}]->(m)
CREATE (u)-[:OWNS {created_at: datetime()}]->(p)
CREATE (u)-[:OWNS {created_at: datetime()}]->(t)
CREATE (u)-[:OWNS {created_at: datetime()}]->(e);

// User CREATED content
MATCH (u:User {id: 'user-001'})
MATCH (d:Document {id: 'doc-001'})
MATCH (m:Message {id: 'msg-001'})
MATCH (t:Task {id: 'task-001'})
CREATE (u)-[:CREATED {created_at: datetime()}]->(d)
CREATE (u)-[:CREATED {created_at: datetime()}]->(m)
CREATE (u)-[:CREATED {created_at: datetime()}]->(t);

// User KNOWS Person
MATCH (u:User {id: 'user-001'})
MATCH (p:Person {id: 'person-001'})
CREATE (u)-[:KNOWS {
  since: datetime('2023-06-15T00:00:00Z'),
  strength: 8,
  context: 'colleague'
}]->(p);

// Message MENTIONS Person
MATCH (m:Message {id: 'msg-001'})
MATCH (p:Person {id: 'person-001'})
CREATE (m)-[:MENTIONS {
  mentioned_at: datetime('2024-01-26T09:15:00Z'),
  context: 'email recipient'
}]->(p);

// Task REFERENCES Document
MATCH (t:Task {id: 'task-001'})
MATCH (d:Document {id: 'doc-001'})
CREATE (t)-[:REFERENCES {
  reference_type: 'review',
  created_at: datetime()
}]->(d);

// Message REFERENCES Document
MATCH (m:Message {id: 'msg-001'})
MATCH (d:Document {id: 'doc-001'})
CREATE (m)-[:REFERENCES {
  reference_type: 'attachment',
  created_at: datetime()
}]->(d);

// Task ASSIGNED_TO Person
MATCH (t:Task {id: 'task-001'})
MATCH (p:Person {id: 'person-001'})
CREATE (t)-[:ASSIGNED_TO {
  assigned_at: datetime(),
  role: 'reviewer'
}]->(p);

// Event ATTENDED_BY Person
MATCH (e:Event {id: 'event-001'})
MATCH (p:Person {id: 'person-001'})
CREATE (e)-[:ATTENDED_BY {
  attendance_status: 'accepted'
}]->(p);

// Event RELATED_TO Document
MATCH (e:Event {id: 'event-001'})
MATCH (d:Document {id: 'doc-001'})
CREATE (e)-[:RELATED_TO {
  relationship_type: 'agenda_item',
  strength: 0.9,
  created_at: datetime()
}]->(d);

// Task RELATED_TO Event
MATCH (t:Task {id: 'task-001'})
MATCH (e:Event {id: 'event-001'})
CREATE (t)-[:RELATED_TO {
  relationship_type: 'preparation',
  strength: 0.85,
  created_at: datetime()
}]->(e);
```

---

## Part 3: PostgreSQL Schema

### Metadata Tables

```sql
-- ============================================
-- POSTGRESQL SCHEMA
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- 1. USERS TABLE (Transactional metadata)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    neo4j_node_id VARCHAR(100) UNIQUE NOT NULL, -- Maps to Neo4j node ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    storage_used_bytes BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_neo4j_node_id ON users(neo4j_node_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- 2. NODES TABLE (Registry of all graph nodes)
-- ============================================
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    neo4j_id VARCHAR(100) UNIQUE NOT NULL, -- Neo4j internal ID or custom ID
    node_type VARCHAR(50) NOT NULL, -- User, Document, Message, Person, Task, Event
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500), -- For searchability
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_nodes_neo4j_id ON nodes(neo4j_id);
CREATE INDEX idx_nodes_user_id ON nodes(user_id);
CREATE INDEX idx_nodes_node_type ON nodes(node_type);
CREATE INDEX idx_nodes_created_at ON nodes(created_at);
CREATE INDEX idx_nodes_deleted_at ON nodes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_nodes_title_trgm ON nodes USING gin(title gin_trgm_ops);

-- ============================================
-- 3. VECTOR_EMBEDDINGS TABLE (Pinecone pointers)
-- ============================================
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    pinecone_id VARCHAR(255) UNIQUE NOT NULL, -- ID in Pinecone
    embedding_model VARCHAR(100) NOT NULL, -- e.g., 'text-embedding-ada-002'
    embedding_dimension INTEGER NOT NULL, -- e.g., 1536
    chunk_index INTEGER DEFAULT 0, -- For documents split into chunks
    total_chunks INTEGER DEFAULT 1,
    content_hash VARCHAR(64), -- SHA256 of content for cache invalidation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_vector_embeddings_node_id ON vector_embeddings(node_id);
CREATE INDEX idx_vector_embeddings_pinecone_id ON vector_embeddings(pinecone_id);
CREATE INDEX idx_vector_embeddings_content_hash ON vector_embeddings(content_hash);
CREATE INDEX idx_vector_embeddings_created_at ON vector_embeddings(created_at);

-- ============================================
-- 4. INGESTION_LOGS TABLE (Audit trail)
-- ============================================
CREATE TABLE ingestion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    ingestion_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'sync'
    source_system VARCHAR(100), -- 'gmail', 'slack', 'notion', 'manual'
    status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ingestion_logs_user_id ON ingestion_logs(user_id);
CREATE INDEX idx_ingestion_logs_node_id ON ingestion_logs(node_id);
CREATE INDEX idx_ingestion_logs_status ON ingestion_logs(status);
CREATE INDEX idx_ingestion_logs_created_at ON ingestion_logs(created_at);
CREATE INDEX idx_ingestion_logs_ingestion_type ON ingestion_logs(ingestion_type);

-- ============================================
-- 5. PERMISSIONS TABLE (Access control)
-- ============================================
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means public
    permission_type VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete', 'share'
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(node_id, user_id, permission_type)
);

CREATE INDEX idx_permissions_node_id ON permissions(node_id);
CREATE INDEX idx_permissions_user_id ON permissions(user_id);
CREATE INDEX idx_permissions_permission_type ON permissions(permission_type);
CREATE INDEX idx_permissions_granted_at ON permissions(granted_at);

-- ============================================
-- 6. SYNC_STATUS TABLE (External integrations)
-- ============================================
CREATE TABLE sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(100) NOT NULL, -- 'gmail', 'slack', 'notion', 'google_calendar'
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_successful_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    sync_cursor VARCHAR(500), -- For incremental syncs
    is_enabled BOOLEAN DEFAULT true,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, integration_type)
);

CREATE INDEX idx_sync_status_user_id ON sync_status(user_id);
CREATE INDEX idx_sync_status_integration_type ON sync_status(integration_type);
CREATE INDEX idx_sync_status_next_sync_at ON sync_status(next_sync_at);

-- ============================================
-- 7. SEARCH_INDEX TABLE (Full-text search cache)
-- ============================================
CREATE TABLE search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    search_vector tsvector,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_index_node_id ON search_index(node_id);
CREATE INDEX idx_search_index_search_vector ON search_index USING gin(search_vector);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION search_index_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.content_text, '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update BEFORE INSERT OR UPDATE
ON search_index FOR EACH ROW EXECUTE FUNCTION search_index_trigger();

-- ============================================
-- 8. RELATIONSHIPS TABLE (Relationship metadata)
-- ============================================
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    neo4j_relationship_id VARCHAR(100), -- Neo4j relationship ID
    strength FLOAT, -- Relationship strength (0.0 to 1.0)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_relationships_from_node_id ON relationships(from_node_id);
CREATE INDEX idx_relationships_to_node_id ON relationships(to_node_id);
CREATE INDEX idx_relationships_type ON relationships(relationship_type);
CREATE INDEX idx_relationships_strength ON relationships(strength);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active nodes with user info
CREATE VIEW v_active_nodes AS
SELECT 
    n.id,
    n.neo4j_id,
    n.node_type,
    n.title,
    n.created_at,
    n.updated_at,
    u.email as user_email,
    u.name as user_name,
    n.metadata
FROM nodes n
JOIN users u ON n.user_id = u.id
WHERE n.is_deleted = false;

-- Recent ingestion activities
CREATE VIEW v_recent_ingestions AS
SELECT 
    il.id,
    il.ingestion_type,
    il.source_system,
    il.status,
    il.created_at,
    u.email as user_email,
    n.title as node_title,
    n.node_type
FROM ingestion_logs il
JOIN users u ON il.user_id = u.id
LEFT JOIN nodes n ON il.node_id = n.id
ORDER BY il.created_at DESC;
```

---

## Part 4: Example Records (JSON Format)

### 1. User Node Example
```json
{
  "id": "user-001",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "auth0_id": "auth0|507f1f77bcf86cd799439011",
  "created_at": "2024-01-15T09:00:00Z",
  "updated_at": "2024-01-15T09:00:00Z",
  "timezone": "America/New_York",
  "preferences": {
    "theme": "dark",
    "notifications": true,
    "language": "en"
  }
}
```

### 2. Document Node Example
```json
{
  "id": "doc-001",
  "title": "Q1 2024 Strategy Document",
  "content": "Our strategic priorities for Q1 2024 include expanding market reach, improving customer satisfaction, and launching new product features.",
  "doc_type": "markdown",
  "file_path": "/documents/q1-2024-strategy.md",
  "file_size": 15420,
  "mime_type": "text/markdown",
  "created_at": "2024-01-20T10:30:00Z",
  "updated_at": "2024-01-25T14:20:00Z",
  "tags": ["strategy", "q1", "2024", "planning"],
  "status": "published"
}
```

### 3. Message Node Example
```json
{
  "id": "msg-001",
  "subject": "Follow-up on Strategy Meeting",
  "body": "Hi team, following up on our strategy meeting from last week. Please review the attached document and provide feedback by Friday.",
  "message_type": "email",
  "direction": "sent",
  "thread_id": "thread-abc-123",
  "sent_at": "2024-01-26T09:15:00Z",
  "created_at": "2024-01-26T09:15:00Z",
  "platform": "gmail",
  "metadata": {
    "recipients": ["alice@example.com", "bob@example.com"],
    "cc": ["manager@example.com"],
    "has_attachments": true
  }
}
```

### 4. Person Node Example
```json
{
  "id": "person-001",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "+1-555-0123",
  "company": "TechCorp Inc.",
  "role": "Product Manager",
  "relationship_type": "colleague",
  "first_met_at": "2023-06-15T00:00:00Z",
  "created_at": "2024-01-10T08:00:00Z",
  "updated_at": "2024-01-10T08:00:00Z",
  "social_profiles": {
    "linkedin": "linkedin.com/in/alicejohnson",
    "twitter": "@alicejohnson"
  },
  "notes": "Met at company onboarding. Very collaborative and detail-oriented."
}
```

### 5. Task Node Example
```json
{
  "id": "task-001",
  "title": "Review Q1 Strategy Document",
  "description": "Read through the Q1 strategy document and provide detailed feedback on proposed initiatives.",
  "status": "in_progress",
  "priority": "high",
  "due_date": "2024-01-31T17:00:00Z",
  "completed_at": null,
  "created_at": "2024-01-26T09:30:00Z",
  "updated_at": "2024-01-27T11:00:00Z",
  "estimated_hours": 2.5,
  "tags": ["review", "strategy", "urgent"]
}
```

### 6. Event Node Example
```json
{
  "id": "event-001",
  "title": "Q1 Strategy Review Meeting",
  "description": "Quarterly strategy review with leadership team to discuss priorities and resource allocation.",
  "event_type": "meeting",
  "location": "Conference Room A / Zoom",
  "start_time": "2024-02-01T14:00:00Z",
  "end_time": "2024-02-01T15:30:00Z",
  "all_day": false,
  "created_at": "2024-01-20T10:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z",
  "recurrence_rule": null,
  "metadata": {
    "zoom_link": "https://zoom.us/j/123456789",
    "organizer": "john.doe@example.com",
    "calendar_id": "cal-primary"
  }
}
```

---

## Part 5: Design Rationale

### Why This Hybrid Architecture?

#### 1. **Neo4j for Graph Relationships**
- **Natural fit**: Personal memories are inherently interconnected
- **Traversal queries**: Finding connections between people, documents, and events
- **Pattern matching**: Discovering implicit relationships (e.g., who attended meetings about specific topics)
- **Flexibility**: Easy to add new relationship types without schema migrations
- **Performance**: Graph queries (3+ hops) are exponentially faster than joins in relational DBs

#### 2. **PostgreSQL for Transactional Metadata**
- **ACID guarantees**: Critical for permissions, billing, and audit logs
- **Structured queries**: Efficient for filtering, sorting, and aggregating metadata
- **Mature ecosystem**: Battle-tested for production workloads
- **Full-text search**: Native support with GIN indexes and tsvector
- **JSONB support**: Flexible metadata without schema changes

### Key Design Decisions

#### 1. **UUID for Primary Keys**
- **Global uniqueness**: Works across distributed systems
- **Security**: Non-sequential IDs prevent enumeration attacks
- **Mergeable**: Can combine graphs from multiple sources without conflicts

#### 2. **Soft Deletes**
- **Data recovery**: Users can restore accidentally deleted items
- **Audit trail**: Maintain history of what was deleted and when
- **Relationship integrity**: Deleted nodes can still be referenced in logs

#### 3. **Separate Vector Embeddings Table**
- **Scalability**: Vector operations are separate from transactional queries
- **Cost optimization**: Only embed content that needs semantic search
- **Cache invalidation**: Content hash tracks when embeddings need regeneration
- **Chunking support**: Large documents split into multiple vectors

#### 4. **Ingestion Logs**
- **Debugging**: Track integration failures and processing times
- **Compliance**: Audit trail for data sources
- **Retry logic**: Identify and reprocess failed ingestions
- **Analytics**: Understand data flow and bottlenecks

#### 5. **Permissions Table**
- **Sharing**: Enable collaborative features (share documents, tasks)
- **Expiration**: Time-limited access for security
- **Granular control**: Different permissions (read, write, delete, share)
- **Performance**: Indexed for fast authorization checks

#### 6. **Search Index Table**
- **Performance**: Pre-computed tsvector for fast full-text search
- **Hybrid search**: Combine with Pinecone vector search for best results
- **Postgres strengths**: Leverage native full-text search capabilities

#### 7. **Relationship Metadata in PostgreSQL**
- **Analytics**: Aggregate relationship statistics (most connected people)
- **Reporting**: Generate insights without querying Neo4j
- **Caching**: Frequently accessed relationship data
- **Dual storage**: Graph in Neo4j, metadata in PostgreSQL

### Indexing Strategy

#### Neo4j Indexes:
- **Node properties**: Fast lookups by ID, email, title, dates
- **Relationship properties**: Query by relationship type, strength
- **Full-text**: Content search across documents and messages
- **Composite**: Multi-property queries (e.g., tasks by status + priority)

#### PostgreSQL Indexes:
- **B-tree**: Standard lookups (IDs, foreign keys, dates)
- **GIN**: Full-text search (tsvector), JSONB queries, trigram fuzzy search
- **Partial**: Only index active/non-deleted records for space efficiency
- **Covering**: Include frequently accessed columns to avoid table lookups

### Performance Considerations

1. **Read-heavy workload**: Most queries are searches and traversals
2. **Write consistency**: PostgreSQL ensures atomic operations
3. **Cache strategy**: Frequently accessed nodes cached in Redis
4. **Batch processing**: Ingestion jobs process in batches via BullMQ
5. **Denormalization**: Store commonly accessed data in both databases

### Scalability

1. **Horizontal scaling**: Neo4j supports clustering, PostgreSQL supports read replicas
2. **Sharding strategy**: Partition by user_id for multi-tenant isolation
3. **Archive strategy**: Move old data to cold storage (S3) with references in PostgreSQL
4. **Vector database**: Pinecone handles millions of embeddings efficiently

### Security

1. **Row-level security**: PostgreSQL RLS policies by user_id
2. **Encrypted at rest**: Both databases support encryption
3. **Access control**: Permissions table enforces authorization
4. **Audit logging**: All mutations logged in ingestion_logs

---

## Summary

This PMG schema provides:
- ✅ **Rich graph model** in Neo4j for discovering connections
- ✅ **Robust metadata** in PostgreSQL for transactional integrity
- ✅ **Vector embeddings** for semantic search via Pinecone
- ✅ **Audit trails** for compliance and debugging
- ✅ **Flexible permissions** for collaboration
- ✅ **Scalable architecture** for growth
- ✅ **Performance optimized** with strategic indexing

The hybrid approach leverages the strengths of each database while maintaining consistency and performance.
