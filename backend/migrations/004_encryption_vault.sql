-- Client-Side Encryption Vault Schema
-- Stores encrypted data with metadata, key derivation params, and recovery options

-- ============================================================================
-- VAULT CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Vault status
  vault_enabled BOOLEAN DEFAULT false,
  vault_created_at TIMESTAMP,
  last_unlocked_at TIMESTAMP,
  
  -- Key derivation parameters (for PBKDF2)
  kdf_algorithm VARCHAR(50) DEFAULT 'PBKDF2', -- PBKDF2, scrypt
  kdf_iterations INTEGER DEFAULT 100000,
  kdf_salt_hex VARCHAR(64), -- Hex-encoded salt
  kdf_hash VARCHAR(20) DEFAULT 'SHA-256',
  
  -- Encryption parameters
  encryption_algorithm VARCHAR(50) DEFAULT 'AES-GCM',
  key_length INTEGER DEFAULT 256,
  
  -- Recovery options
  passphrase_hint TEXT,
  recovery_enabled BOOLEAN DEFAULT false,
  recovery_email VARCHAR(255),
  recovery_phone VARCHAR(50),
  
  -- Security settings
  require_2fa BOOLEAN DEFAULT false,
  auto_lock_minutes INTEGER DEFAULT 15,
  max_unlock_attempts INTEGER DEFAULT 5,
  failed_unlock_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_config_user_id ON vault_config(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_config_enabled ON vault_config(vault_enabled);

-- ============================================================================
-- ENCRYPTED NODES (Vault Items)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Node identification
  node_type VARCHAR(100) NOT NULL, -- credential, note, file, api_key, etc.
  node_label VARCHAR(255), -- User-friendly label (encrypted)
  
  -- Encrypted data
  encrypted_data TEXT NOT NULL, -- Base64-encoded ciphertext
  encryption_iv VARCHAR(64) NOT NULL, -- Base64-encoded initialization vector
  encryption_algorithm VARCHAR(50) DEFAULT 'AES-GCM',
  
  -- Authentication tag (for AES-GCM)
  auth_tag VARCHAR(64),
  
  -- Metadata (NOT encrypted - for searching/filtering)
  metadata JSONB, -- {category, tags, custom_fields}
  
  -- Access tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  
  -- Soft delete
  deleted_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES vault_config(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_nodes_user_id ON vault_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_nodes_type ON vault_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_vault_nodes_deleted ON vault_nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vault_nodes_metadata ON vault_nodes USING GIN (metadata);

-- ============================================================================
-- KEY ROTATION HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_key_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Old key parameters (for migration)
  old_kdf_salt_hex VARCHAR(64),
  old_kdf_iterations INTEGER,
  
  -- New key parameters
  new_kdf_salt_hex VARCHAR(64),
  new_kdf_iterations INTEGER,
  
  -- Rotation info
  rotation_reason VARCHAR(100), -- scheduled, compromised, user_request
  nodes_migrated INTEGER DEFAULT 0,
  nodes_failed INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES vault_config(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_key_rotations_user_id ON vault_key_rotations(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_key_rotations_status ON vault_key_rotations(status);

-- ============================================================================
-- RECOVERY KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_recovery_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Recovery key (encrypted with server-side key)
  encrypted_recovery_key TEXT NOT NULL,
  recovery_key_hint VARCHAR(255),
  
  -- Key wrapping info
  wrapping_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
  wrapping_iv VARCHAR(64),
  
  -- Usage tracking
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP,
  used_count INTEGER DEFAULT 0,
  
  -- Expiration
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES vault_config(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_recovery_keys_user_id ON vault_recovery_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_recovery_keys_revoked ON vault_recovery_keys(revoked_at);

-- ============================================================================
-- VAULT AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Action details
  action VARCHAR(100) NOT NULL, -- unlock, lock, create_node, access_node, delete_node, etc.
  node_id UUID, -- Reference to vault_nodes if applicable
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  
  -- 2FA
  required_2fa BOOLEAN DEFAULT false,
  passed_2fa BOOLEAN,
  
  -- Result
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_audit_log_user_id ON vault_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_log_action ON vault_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_vault_audit_log_created ON vault_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_vault_audit_log_node_id ON vault_audit_log(node_id);

-- ============================================================================
-- ADMIN CONTROLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Global vault settings
  vault_feature_enabled BOOLEAN DEFAULT true,
  allow_new_vaults BOOLEAN DEFAULT true,
  
  -- Security requirements
  require_2fa_for_vault BOOLEAN DEFAULT false,
  min_passphrase_length INTEGER DEFAULT 12,
  min_kdf_iterations INTEGER DEFAULT 100000,
  
  -- Rate limiting
  max_unlock_attempts_per_hour INTEGER DEFAULT 10,
  lockout_duration_minutes INTEGER DEFAULT 30,
  
  -- Compliance
  max_vault_items INTEGER DEFAULT 1000,
  data_retention_days INTEGER DEFAULT 2555, -- ~7 years
  
  -- Audit
  log_all_vault_access BOOLEAN DEFAULT true,
  alert_on_suspicious_activity BOOLEAN DEFAULT true,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Insert default admin settings
INSERT INTO vault_admin_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VAULT SHARE PERMISSIONS (Optional - for shared vaults)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES vault_nodes(id) ON DELETE CASCADE,
  
  -- Sharing
  shared_with_user_id VARCHAR(255) NOT NULL,
  shared_by_user_id VARCHAR(255) NOT NULL,
  
  -- Encrypted key for recipient (recipient's public key used)
  encrypted_node_key TEXT NOT NULL,
  
  -- Permissions
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_reshare BOOLEAN DEFAULT false,
  
  -- Expiration
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_shares_node_id ON vault_shares(node_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_shared_with ON vault_shares(shared_with_user_id);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Create test vault config
INSERT INTO vault_config (
  user_id, vault_enabled, kdf_salt_hex, vault_created_at, passphrase_hint
) VALUES (
  'test-user-1',
  true,
  encode(gen_random_bytes(32), 'hex'),
  NOW(),
  'First pet name + birth year'
) ON CONFLICT (user_id) DO NOTHING;

-- Create sample encrypted node
INSERT INTO vault_nodes (
  user_id, node_type, node_label, encrypted_data, encryption_iv, metadata
) VALUES (
  'test-user-1',
  'credential',
  'Sample Password',
  'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=', -- Base64 dummy data
  encode(gen_random_bytes(12), 'hex'),
  '{"category": "work", "tags": ["important"], "url": "https://example.com"}'
);

COMMENT ON TABLE vault_config IS 'User vault configuration and key derivation parameters';
COMMENT ON TABLE vault_nodes IS 'Encrypted vault items - only ciphertext stored on server';
COMMENT ON TABLE vault_key_rotations IS 'History of key rotation operations';
COMMENT ON TABLE vault_recovery_keys IS 'Encrypted recovery keys for vault access restoration';
COMMENT ON TABLE vault_audit_log IS 'Complete audit trail of all vault operations';
COMMENT ON TABLE vault_admin_settings IS 'Global admin controls for vault feature';
