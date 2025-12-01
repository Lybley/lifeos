-- Gmail Connector Schema
-- Additional tables for OAuth and sync management

-- OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    gmail_email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_valid ON oauth_tokens(is_valid) WHERE is_valid = true;

-- Sync Status table (if not already exists from main schema)
-- Tracks integration sync health
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(100) NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_successful_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    sync_cursor VARCHAR(500),
    is_enabled BOOLEAN DEFAULT true,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, integration_type)
);

CREATE INDEX idx_sync_status_user_id ON sync_status(user_id);
CREATE INDEX idx_sync_status_integration ON sync_status(integration_type);
CREATE INDEX idx_sync_status_next_sync ON sync_status(next_sync_at);

-- Gmail Message Tracking (for deduplication and sync tracking)
CREATE TABLE IF NOT EXISTS gmail_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    pmg_message_id VARCHAR(255) NOT NULL, -- References nodes.neo4j_id
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    synced_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gmail_message_id)
);

CREATE INDEX idx_gmail_messages_user_id ON gmail_messages(user_id);
CREATE INDEX idx_gmail_messages_gmail_id ON gmail_messages(gmail_message_id);
CREATE INDEX idx_gmail_messages_sync_status ON gmail_messages(sync_status);
CREATE INDEX idx_gmail_messages_thread_id ON gmail_messages(thread_id);

-- Sample queries for monitoring

-- Check OAuth status for a user
-- SELECT 
--     user_id,
--     provider,
--     gmail_email,
--     is_valid,
--     created_at,
--     CASE 
--         WHEN expiry_date IS NULL THEN 'No expiry'
--         WHEN expiry_date > NOW() THEN 'Valid'
--         ELSE 'Expired'
--     END as token_status
-- FROM oauth_tokens
-- WHERE user_id = 'your-user-id';

-- Check sync health
-- SELECT 
--     user_id,
--     integration_type,
--     last_successful_sync_at,
--     error_count,
--     is_enabled,
--     CASE 
--         WHEN error_count = 0 THEN 'Healthy'
--         WHEN error_count < 3 THEN 'Warning'
--         ELSE 'Critical'
--     END as health_status
-- FROM sync_status
-- WHERE integration_type = 'gmail';

-- Check message sync progress
-- SELECT 
--     sync_status,
--     COUNT(*) as count,
--     MIN(created_at) as earliest,
--     MAX(created_at) as latest
-- FROM gmail_messages
-- WHERE user_id = 'your-user-id'
-- GROUP BY sync_status;
