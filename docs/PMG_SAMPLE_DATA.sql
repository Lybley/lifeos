-- ============================================
-- SAMPLE DATA FOR POSTGRESQL TABLES
-- Personal Memory Graph (PMG) Metadata
-- ============================================

-- ============================================
-- 1. INSERT USERS
-- ============================================

INSERT INTO users (id, auth0_id, email, name, neo4j_node_id, created_at, updated_at, last_login_at, is_active, subscription_tier, storage_used_bytes, metadata)
VALUES 
(
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'auth0|507f1f77bcf86cd799439011',
    'john.doe@example.com',
    'John Doe',
    'user-001',
    '2024-01-15 09:00:00+00',
    '2024-01-15 09:00:00+00',
    '2024-01-27 08:30:00+00',
    true,
    'premium',
    125000000, -- ~125 MB
    '{"timezone": "America/New_York", "preferences": {"theme": "dark", "notifications": true}}'::jsonb
);

-- ============================================
-- 2. INSERT NODES (Registry)
-- ============================================

-- Document node
INSERT INTO nodes (id, neo4j_id, node_type, user_id, title, created_at, updated_at, deleted_at, is_deleted, metadata)
VALUES 
(
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'doc-001',
    'Document',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'Q1 2024 Strategy Document',
    '2024-01-20 10:30:00+00',
    '2024-01-25 14:20:00+00',
    NULL,
    false,
    '{"doc_type": "markdown", "file_size": 15420, "tags": ["strategy", "q1", "2024"]}'::jsonb
);

-- Message node
INSERT INTO nodes (id, neo4j_id, node_type, user_id, title, created_at, updated_at, deleted_at, is_deleted, metadata)
VALUES 
(
    'msg-22222222-2222-2222-2222-222222222222'::uuid,
    'msg-001',
    'Message',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'Follow-up on Strategy Meeting',
    '2024-01-26 09:15:00+00',
    '2024-01-26 09:15:00+00',
    NULL,
    false,
    '{"message_type": "email", "platform": "gmail", "thread_id": "thread-abc-123"}'::jsonb
);

-- Person node
INSERT INTO nodes (id, neo4j_id, node_type, user_id, title, created_at, updated_at, deleted_at, is_deleted, metadata)
VALUES 
(
    'per-33333333-3333-3333-3333-333333333333'::uuid,
    'person-001',
    'Person',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'Alice Johnson',
    '2024-01-10 08:00:00+00',
    '2024-01-10 08:00:00+00',
    NULL,
    false,
    '{"email": "alice@example.com", "company": "TechCorp Inc.", "role": "Product Manager"}'::jsonb
);

-- Task node
INSERT INTO nodes (id, neo4j_id, node_type, user_id, title, created_at, updated_at, deleted_at, is_deleted, metadata)
VALUES 
(
    'tsk-44444444-4444-4444-4444-444444444444'::uuid,
    'task-001',
    'Task',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'Review Q1 Strategy Document',
    '2024-01-26 09:30:00+00',
    '2024-01-27 11:00:00+00',
    NULL,
    false,
    '{"status": "in_progress", "priority": "high", "due_date": "2024-01-31T17:00:00Z"}'::jsonb
);

-- Event node
INSERT INTO nodes (id, neo4j_id, node_type, user_id, title, created_at, updated_at, deleted_at, is_deleted, metadata)
VALUES 
(
    'evt-55555555-5555-5555-5555-555555555555'::uuid,
    'event-001',
    'Event',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'Q1 Strategy Review Meeting',
    '2024-01-20 10:00:00+00',
    '2024-01-20 10:00:00+00',
    NULL,
    false,
    '{"event_type": "meeting", "start_time": "2024-02-01T14:00:00Z", "location": "Conference Room A"}'::jsonb
);

-- ============================================
-- 3. INSERT VECTOR EMBEDDINGS
-- ============================================

-- Embedding for Document
INSERT INTO vector_embeddings (id, node_id, pinecone_id, embedding_model, embedding_dimension, chunk_index, total_chunks, content_hash, created_at, updated_at, metadata)
VALUES 
(
    'vec-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'doc-001-chunk-0',
    'text-embedding-ada-002',
    1536,
    0,
    1,
    'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    '2024-01-20 10:35:00+00',
    '2024-01-20 10:35:00+00',
    '{"content_length": 156, "language": "en"}'::jsonb
);

-- Embedding for Message
INSERT INTO vector_embeddings (id, node_id, pinecone_id, embedding_model, embedding_dimension, chunk_index, total_chunks, content_hash, created_at, updated_at, metadata)
VALUES 
(
    'vec-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'msg-22222222-2222-2222-2222-222222222222'::uuid,
    'msg-001-chunk-0',
    'text-embedding-ada-002',
    1536,
    0,
    1,
    'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    '2024-01-26 09:20:00+00',
    '2024-01-26 09:20:00+00',
    '{"content_length": 124, "language": "en"}'::jsonb
);

-- ============================================
-- 4. INSERT INGESTION LOGS
-- ============================================

-- Document creation log
INSERT INTO ingestion_logs (id, user_id, node_id, ingestion_type, source_system, status, error_message, processing_time_ms, created_at, completed_at, metadata)
VALUES 
(
    'log-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'create',
    'manual',
    'completed',
    NULL,
    342,
    '2024-01-20 10:30:00+00',
    '2024-01-20 10:30:00+00',
    '{"file_type": "markdown", "file_size": 15420}'::jsonb
);

-- Message sync log
INSERT INTO ingestion_logs (id, user_id, node_id, ingestion_type, source_system, status, error_message, processing_time_ms, created_at, completed_at, metadata)
VALUES 
(
    'log-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'msg-22222222-2222-2222-2222-222222222222'::uuid,
    'sync',
    'gmail',
    'completed',
    NULL,
    1247,
    '2024-01-26 09:15:00+00',
    '2024-01-26 09:15:01+00',
    '{"message_id": "17d4a1b2c3d4e5f6", "thread_id": "thread-abc-123"}'::jsonb
);

-- Vector embedding log
INSERT INTO ingestion_logs (id, user_id, node_id, ingestion_type, source_system, status, error_message, processing_time_ms, created_at, completed_at, metadata)
VALUES 
(
    'log-33333333-aaaa-bbbb-cccc-333333333333'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'update',
    'pinecone',
    'completed',
    NULL,
    2456,
    '2024-01-20 10:35:00+00',
    '2024-01-20 10:35:02+00',
    '{"embedding_model": "text-embedding-ada-002", "chunks_created": 1}'::jsonb
);

-- Failed ingestion example
INSERT INTO ingestion_logs (id, user_id, node_id, ingestion_type, source_system, status, error_message, processing_time_ms, created_at, completed_at, metadata)
VALUES 
(
    'log-44444444-aaaa-bbbb-cccc-444444444444'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    NULL,
    'sync',
    'slack',
    'failed',
    'Authentication failed: Invalid API token',
    523,
    '2024-01-27 10:00:00+00',
    '2024-01-27 10:00:00+00',
    '{"error_code": "AUTH_001", "retry_count": 3}'::jsonb
);

-- ============================================
-- 5. INSERT PERMISSIONS
-- ============================================

-- Owner has full access
INSERT INTO permissions (id, node_id, user_id, permission_type, granted_by, granted_at, expires_at, is_active, metadata)
VALUES 
(
    'perm-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'read',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    '2024-01-20 10:30:00+00',
    NULL,
    true,
    '{"reason": "owner"}'::jsonb
),
(
    'perm-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'write',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    '2024-01-20 10:30:00+00',
    NULL,
    true,
    '{"reason": "owner"}'::jsonb
),
(
    'perm-33333333-aaaa-bbbb-cccc-333333333333'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'delete',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    '2024-01-20 10:30:00+00',
    NULL,
    true,
    '{"reason": "owner"}'::jsonb
);

-- Example: Shared access (time-limited)
-- INSERT INTO permissions (id, node_id, user_id, permission_type, granted_by, granted_at, expires_at, is_active, metadata)
-- VALUES 
-- (
--     'perm-44444444-aaaa-bbbb-cccc-444444444444'::uuid,
--     'doc-11111111-1111-1111-1111-111111111111'::uuid,
--     'shared-user-uuid'::uuid,
--     'read',
--     'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
--     '2024-01-26 10:00:00+00',
--     '2024-02-26 10:00:00+00', -- Expires in 30 days
--     true,
--     '{"shared_via": "email", "recipient_email": "alice@example.com"}'::jsonb
-- );

-- ============================================
-- 6. INSERT SYNC STATUS
-- ============================================

-- Gmail sync
INSERT INTO sync_status (id, user_id, integration_type, last_sync_at, last_successful_sync_at, next_sync_at, sync_cursor, is_enabled, error_count, last_error, created_at, updated_at, metadata)
VALUES 
(
    'sync-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'gmail',
    '2024-01-27 08:00:00+00',
    '2024-01-27 08:00:00+00',
    '2024-01-27 10:00:00+00',
    'cursor-17d4a1b2c3d4e5f6',
    true,
    0,
    NULL,
    '2024-01-15 09:30:00+00',
    '2024-01-27 08:00:00+00',
    '{"messages_synced": 247, "sync_interval_minutes": 120}'::jsonb
);

-- Google Calendar sync
INSERT INTO sync_status (id, user_id, integration_type, last_sync_at, last_successful_sync_at, next_sync_at, sync_cursor, is_enabled, error_count, last_error, created_at, updated_at, metadata)
VALUES 
(
    'sync-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'google_calendar',
    '2024-01-27 07:30:00+00',
    '2024-01-27 07:30:00+00',
    '2024-01-27 11:30:00+00',
    'cursor-gcal-xyz789',
    true,
    0,
    NULL,
    '2024-01-15 09:35:00+00',
    '2024-01-27 07:30:00+00',
    '{"events_synced": 42, "sync_interval_minutes": 240}'::jsonb
);

-- Slack sync (failed)
INSERT INTO sync_status (id, user_id, integration_type, last_sync_at, last_successful_sync_at, next_sync_at, sync_cursor, is_enabled, error_count, last_error, created_at, updated_at, metadata)
VALUES 
(
    'sync-33333333-aaaa-bbbb-cccc-333333333333'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'slack',
    '2024-01-27 10:00:00+00',
    '2024-01-26 14:00:00+00',
    '2024-01-27 12:00:00+00',
    'cursor-slack-abc123',
    true,
    3,
    'Authentication failed: Invalid API token',
    '2024-01-15 09:40:00+00',
    '2024-01-27 10:00:00+00',
    '{"error_code": "AUTH_001", "requires_reauth": true}'::jsonb
);

-- ============================================
-- 7. INSERT SEARCH INDEX
-- ============================================

-- Document search index
INSERT INTO search_index (id, node_id, content_text, created_at, updated_at)
VALUES 
(
    'search-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'Q1 2024 Strategy Document. Our strategic priorities for Q1 2024 include expanding market reach, improving customer satisfaction, and launching new product features.',
    '2024-01-20 10:30:00+00',
    '2024-01-25 14:20:00+00'
);

-- Message search index
INSERT INTO search_index (id, node_id, content_text, created_at, updated_at)
VALUES 
(
    'search-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'msg-22222222-2222-2222-2222-222222222222'::uuid,
    'Follow-up on Strategy Meeting. Hi team, following up on our strategy meeting from last week. Please review the attached document and provide feedback by Friday.',
    '2024-01-26 09:15:00+00',
    '2024-01-26 09:15:00+00'
);

-- ============================================
-- 8. INSERT RELATIONSHIPS
-- ============================================

-- User OWNS Document
INSERT INTO relationships (id, from_node_id, to_node_id, relationship_type, neo4j_relationship_id, strength, created_at, updated_at, metadata)
VALUES 
(
    'rel-11111111-aaaa-bbbb-cccc-111111111111'::uuid,
    'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'OWNS',
    'neo4j-rel-001',
    1.0,
    '2024-01-20 10:30:00+00',
    '2024-01-20 10:30:00+00',
    '{"ownership_type": "creator"}'::jsonb
);

-- Task REFERENCES Document
INSERT INTO relationships (id, from_node_id, to_node_id, relationship_type, neo4j_relationship_id, strength, created_at, updated_at, metadata)
VALUES 
(
    'rel-22222222-aaaa-bbbb-cccc-222222222222'::uuid,
    'tsk-44444444-4444-4444-4444-444444444444'::uuid,
    'doc-11111111-1111-1111-1111-111111111111'::uuid,
    'REFERENCES',
    'neo4j-rel-002',
    0.95,
    '2024-01-26 09:30:00+00',
    '2024-01-26 09:30:00+00',
    '{"reference_type": "review", "context": "action item"}'::jsonb
);

-- Message MENTIONS Person
INSERT INTO relationships (id, from_node_id, to_node_id, relationship_type, neo4j_relationship_id, strength, created_at, updated_at, metadata)
VALUES 
(
    'rel-33333333-aaaa-bbbb-cccc-333333333333'::uuid,
    'msg-22222222-2222-2222-2222-222222222222'::uuid,
    'per-33333333-3333-3333-3333-333333333333'::uuid,
    'MENTIONS',
    'neo4j-rel-003',
    0.85,
    '2024-01-26 09:15:00+00',
    '2024-01-26 09:15:00+00',
    '{"mention_context": "recipient", "mention_type": "to"}'::jsonb
);

-- Event ATTENDED_BY Person
INSERT INTO relationships (id, from_node_id, to_node_id, relationship_type, neo4j_relationship_id, strength, created_at, updated_at, metadata)
VALUES 
(
    'rel-44444444-aaaa-bbbb-cccc-444444444444'::uuid,
    'evt-55555555-5555-5555-5555-555555555555'::uuid,
    'per-33333333-3333-3333-3333-333333333333'::uuid,
    'ATTENDED_BY',
    'neo4j-rel-004',
    0.9,
    '2024-01-20 10:05:00+00',
    '2024-01-20 10:05:00+00',
    '{"attendance_status": "accepted", "role": "participant"}'::jsonb
);

-- Task RELATED_TO Event
INSERT INTO relationships (id, from_node_id, to_node_id, relationship_type, neo4j_relationship_id, strength, created_at, updated_at, metadata)
VALUES 
(
    'rel-55555555-aaaa-bbbb-cccc-555555555555'::uuid,
    'tsk-44444444-4444-4444-4444-444444444444'::uuid,
    'evt-55555555-5555-5555-5555-555555555555'::uuid,
    'RELATED_TO',
    'neo4j-rel-005',
    0.88,
    '2024-01-26 09:30:00+00',
    '2024-01-26 09:30:00+00',
    '{"relationship_type": "preparation", "context": "pre-meeting task"}'::jsonb
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Count nodes by type
SELECT 
    node_type,
    COUNT(*) as count,
    COUNT(CASE WHEN is_deleted THEN 1 END) as deleted_count
FROM nodes
GROUP BY node_type;

-- Recent activity
SELECT 
    il.ingestion_type,
    il.source_system,
    il.status,
    COUNT(*) as count,
    AVG(il.processing_time_ms) as avg_processing_time_ms
FROM ingestion_logs il
WHERE il.created_at > NOW() - INTERVAL '7 days'
GROUP BY il.ingestion_type, il.source_system, il.status
ORDER BY count DESC;

-- Vector embeddings coverage
SELECT 
    n.node_type,
    COUNT(DISTINCT n.id) as total_nodes,
    COUNT(DISTINCT ve.node_id) as nodes_with_embeddings,
    ROUND(100.0 * COUNT(DISTINCT ve.node_id) / COUNT(DISTINCT n.id), 2) as coverage_percentage
FROM nodes n
LEFT JOIN vector_embeddings ve ON n.id = ve.node_id
WHERE n.is_deleted = false
GROUP BY n.node_type;

-- Relationship summary
SELECT 
    relationship_type,
    COUNT(*) as count,
    AVG(strength) as avg_strength,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM relationships
GROUP BY relationship_type
ORDER BY count DESC;

-- Sync health check
SELECT 
    integration_type,
    is_enabled,
    last_sync_at,
    next_sync_at,
    error_count,
    CASE 
        WHEN error_count = 0 THEN 'healthy'
        WHEN error_count < 3 THEN 'warning'
        ELSE 'critical'
    END as health_status
FROM sync_status
ORDER BY error_count DESC, integration_type;

-- Storage usage by user
SELECT 
    u.email,
    u.name,
    u.storage_used_bytes / (1024.0 * 1024.0) as storage_mb,
    COUNT(n.id) as node_count,
    COUNT(ve.id) as embedding_count
FROM users u
LEFT JOIN nodes n ON u.id = n.user_id AND n.is_deleted = false
LEFT JOIN vector_embeddings ve ON n.id = ve.node_id
GROUP BY u.id, u.email, u.name, u.storage_used_bytes;
