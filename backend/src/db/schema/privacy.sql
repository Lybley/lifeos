-- ============================================================================
-- PRIVACY & ENCRYPTION SCHEMA
-- ============================================================================

-- User encryption settings
CREATE TABLE IF NOT EXISTS user_encryption_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  encryption_tier VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, zero-knowledge, vault
  master_key_encrypted TEXT, -- encrypted with user passphrase (for zero-knowledge)
  vault_enabled BOOLEAN DEFAULT false,
  vault_key_encrypted TEXT, -- encrypted DEK for vault nodes
  kms_key_id VARCHAR(255), -- KMS key ID for standard encryption
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encrypted data storage (for vault nodes and zero-knowledge)
CREATE TABLE IF NOT EXISTS encrypted_data (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  node_id VARCHAR(255), -- reference to memory graph node
  data_type VARCHAR(50) NOT NULL, -- vault_node, zk_data, etc
  encrypted_content TEXT NOT NULL, -- base64 encoded encrypted data
  encryption_metadata JSONB, -- nonce, algorithm, version, etc
  is_vault BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_encrypted_data_user ON encrypted_data(user_id);
CREATE INDEX idx_encrypted_data_node ON encrypted_data(node_id);
CREATE INDEX idx_encrypted_data_vault ON encrypted_data(is_vault);

-- User consent management
CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  consent_type VARCHAR(100) NOT NULL, -- analytics, marketing, data_processing
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX idx_user_consents_user ON user_consents(user_id);

-- Account deletion requests
CREATE TABLE IF NOT EXISTS user_deletion_requests (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletion_scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, cancelled, completed
  cancellation_token VARCHAR(255) UNIQUE,
  completed_at TIMESTAMP
);

-- Privacy audit logs (immutable)
CREATE TABLE IF NOT EXISTS privacy_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- data_export, vault_access, consent_change, deletion_request
  event_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_privacy_audit_user ON privacy_audit_logs(user_id);
CREATE INDEX idx_privacy_audit_type ON privacy_audit_logs(event_type);
CREATE INDEX idx_privacy_audit_created ON privacy_audit_logs(created_at);

-- Key rotation history
CREATE TABLE IF NOT EXISTS key_rotation_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  old_key_id VARCHAR(255),
  new_key_id VARCHAR(255),
  rotation_reason VARCHAR(100), -- scheduled, security_incident, user_requested
  rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recovery codes (for zero-knowledge tier)
CREATE TABLE IF NOT EXISTS recovery_codes (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL, -- hashed recovery code
  encrypted_master_key TEXT NOT NULL, -- master key encrypted with recovery code
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recovery_codes_user ON recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_hash ON recovery_codes(code_hash);
