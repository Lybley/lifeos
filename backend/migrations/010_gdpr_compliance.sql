-- Migration: GDPR Compliance Tables
-- Created: 2025-12-15

-- Deletion Requests Table
CREATE TABLE IF NOT EXISTS deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    cancelled_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, cancelled, completed
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'cancelled', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_requested_at ON deletion_requests(requested_at DESC);

-- Data Export Requests Table (audit trail)
CREATE TABLE IF NOT EXISTS data_export_requests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    file_size_bytes BIGINT,
    download_url TEXT,
    expires_at TIMESTAMP,
    
    CONSTRAINT valid_export_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON data_export_requests(status);

-- Add deletion tracking columns to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'deletion_requested_at') THEN
        ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

COMMENT ON TABLE deletion_requests IS 'Tracks user account deletion requests (GDPR Article 17)';
COMMENT ON TABLE data_export_requests IS 'Audit trail for data export requests (GDPR Article 20)';
