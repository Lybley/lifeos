-- ============================================================================
-- Permission & Consent System - Database Schema
-- ============================================================================

-- Enum types for scopes and access levels
CREATE TYPE permission_scope AS ENUM (
  'emails.full',
  'emails.metadata',
  'files.full',
  'files.metadata',
  'calendar.read',
  'calendar.write',
  'messages.read',
  'contacts.read',
  'health.read',
  'purchases.read',
  'purchases.write'
);

CREATE TYPE permission_status AS ENUM (
  'active',
  'revoked',
  'expired',
  'pending'
);

CREATE TYPE consent_version AS ENUM (
  'v1',
  'v2'
);

-- ============================================================================
-- Permissions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scope permission_scope NOT NULL,
  status permission_status NOT NULL DEFAULT 'active',
  
  -- Access control
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  
  -- Metadata
  granted_by VARCHAR(255), -- 'user', 'system', 'admin'
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  
  -- Versioning
  consent_version consent_version NOT NULL DEFAULT 'v1',
  scope_hash VARCHAR(64) NOT NULL,
  
  -- Indexes for performance
  CONSTRAINT permissions_user_scope_unique UNIQUE (user_id, scope, status),
  CONSTRAINT permissions_check_dates CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL) OR 
    (status != 'revoked' AND revoked_at IS NULL)
  )
);

CREATE INDEX idx_permissions_user_id ON permissions(user_id);
CREATE INDEX idx_permissions_scope ON permissions(scope);
CREATE INDEX idx_permissions_status ON permissions(status);
CREATE INDEX idx_permissions_expires_at ON permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_permissions_user_scope ON permissions(user_id, scope);

-- ============================================================================
-- Consent Audit Trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  
  -- Audit details
  action VARCHAR(50) NOT NULL, -- 'granted', 'revoked', 'expired', 'used', 'modified'
  scope permission_scope,
  previous_status permission_status,
  new_status permission_status,
  
  -- Context
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_consent_audit_user_id ON consent_audit_log(user_id);
CREATE INDEX idx_consent_audit_permission_id ON consent_audit_log(permission_id);
CREATE INDEX idx_consent_audit_timestamp ON consent_audit_log(timestamp);
CREATE INDEX idx_consent_audit_action ON consent_audit_log(action);

-- ============================================================================
-- Scope Definitions (Reference Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scope_definitions (
  scope permission_scope PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  requires_explicit_consent BOOLEAN NOT NULL DEFAULT true,
  
  -- Versioning
  version consent_version NOT NULL DEFAULT 'v1',
  scope_hash VARCHAR(64) NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Populate scope definitions
INSERT INTO scope_definitions (scope, name, description, category, risk_level, default_enabled, requires_explicit_consent, scope_hash) VALUES
  ('emails.full', 'Full Email Access', 'Read and search full email content including body text', 'email', 'medium', true, false, SHA256('emails.full:v1')::text),
  ('emails.metadata', 'Email Metadata Only', 'Access only email headers (from, to, subject, date)', 'email', 'low', true, false, SHA256('emails.metadata:v1')::text),
  ('files.full', 'Full File Access', 'Read and index full file contents', 'files', 'medium', true, false, SHA256('files.full:v1')::text),
  ('files.metadata', 'File Metadata Only', 'Access only file names, sizes, and dates', 'files', 'low', true, false, SHA256('files.metadata:v1')::text),
  ('calendar.read', 'Calendar Read', 'View calendar events and schedules', 'calendar', 'low', true, false, SHA256('calendar.read:v1')::text),
  ('calendar.write', 'Calendar Write', 'Create, modify, and delete calendar events', 'calendar', 'medium', true, true, SHA256('calendar.write:v1')::text),
  ('messages.read', 'Messages Read', 'Read chat and messaging data', 'messages', 'medium', true, false, SHA256('messages.read:v1')::text),
  ('contacts.read', 'Contacts Read', 'Access contact information', 'contacts', 'low', true, false, SHA256('contacts.read:v1')::text),
  ('health.read', 'Health Data Read', 'Access health and fitness data', 'health', 'high', false, true, SHA256('health.read:v1')::text),
  ('purchases.read', 'Purchases Read', 'View purchase history and transactions', 'purchases', 'critical', false, true, SHA256('purchases.read:v1')::text),
  ('purchases.write', 'Purchases Write', 'Execute purchase and payment actions', 'purchases', 'critical', false, true, SHA256('purchases.write:v1')::text)
ON CONFLICT (scope) DO NOTHING;

-- ============================================================================
-- Permission Dependencies (which permissions require others)
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_dependencies (
  parent_scope permission_scope NOT NULL,
  required_scope permission_scope NOT NULL,
  PRIMARY KEY (parent_scope, required_scope),
  FOREIGN KEY (parent_scope) REFERENCES scope_definitions(scope),
  FOREIGN KEY (required_scope) REFERENCES scope_definitions(scope)
);

-- Define dependencies
INSERT INTO permission_dependencies (parent_scope, required_scope) VALUES
  ('emails.full', 'emails.metadata'),
  ('files.full', 'files.metadata'),
  ('calendar.write', 'calendar.read'),
  ('purchases.write', 'purchases.read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_scope permission_scope
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM permissions
    WHERE user_id = p_user_id
      AND scope = p_scope
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to grant permission
CREATE OR REPLACE FUNCTION grant_permission(
  p_user_id UUID,
  p_scope permission_scope,
  p_expires_at TIMESTAMP DEFAULT NULL,
  p_granted_by VARCHAR(255) DEFAULT 'user',
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_permission_id UUID;
  v_scope_hash VARCHAR(64);
BEGIN
  -- Get scope hash
  SELECT scope_hash INTO v_scope_hash
  FROM scope_definitions
  WHERE scope = p_scope;
  
  -- Insert or update permission
  INSERT INTO permissions (
    user_id, scope, status, expires_at, granted_by, reason,
    ip_address, user_agent, scope_hash
  ) VALUES (
    p_user_id, p_scope, 'active', p_expires_at, p_granted_by, p_reason,
    p_ip_address, p_user_agent, v_scope_hash
  )
  ON CONFLICT (user_id, scope, status) 
  DO UPDATE SET
    granted_at = CURRENT_TIMESTAMP,
    expires_at = EXCLUDED.expires_at,
    granted_by = EXCLUDED.granted_by,
    reason = EXCLUDED.reason
  RETURNING id INTO v_permission_id;
  
  -- Log to audit trail
  INSERT INTO consent_audit_log (
    user_id, permission_id, action, scope, new_status,
    ip_address, user_agent, reason
  ) VALUES (
    p_user_id, v_permission_id, 'granted', p_scope, 'active',
    p_ip_address, p_user_agent, p_reason
  );
  
  RETURN v_permission_id;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke permission
CREATE OR REPLACE FUNCTION revoke_permission(
  p_user_id UUID,
  p_scope permission_scope,
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_permission_id UUID;
  v_old_status permission_status;
BEGIN
  -- Get permission
  SELECT id, status INTO v_permission_id, v_old_status
  FROM permissions
  WHERE user_id = p_user_id
    AND scope = p_scope
    AND status = 'active';
  
  IF v_permission_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update permission
  UPDATE permissions
  SET status = 'revoked',
      revoked_at = CURRENT_TIMESTAMP
  WHERE id = v_permission_id;
  
  -- Log to audit trail
  INSERT INTO consent_audit_log (
    user_id, permission_id, action, scope,
    previous_status, new_status,
    ip_address, user_agent, reason
  ) VALUES (
    p_user_id, v_permission_id, 'revoked', p_scope,
    v_old_status, 'revoked',
    p_ip_address, p_user_agent, p_reason
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire permissions
CREATE OR REPLACE FUNCTION expire_permissions() RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE permissions
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= CURRENT_TIMESTAMP
    RETURNING id, user_id, scope
  )
  INSERT INTO consent_audit_log (
    user_id, permission_id, action, scope,
    previous_status, new_status, reason
  )
  SELECT 
    user_id, id, 'expired', scope,
    'active', 'expired', 'Automatic expiration'
  FROM expired;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log permission usage
CREATE OR REPLACE FUNCTION log_permission_usage(
  p_user_id UUID,
  p_scope permission_scope,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
  v_permission_id UUID;
BEGIN
  -- Update last used timestamp
  UPDATE permissions
  SET last_used_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id
    AND scope = p_scope
    AND status = 'active'
  RETURNING id INTO v_permission_id;
  
  -- Log usage
  IF v_permission_id IS NOT NULL THEN
    INSERT INTO consent_audit_log (
      user_id, permission_id, action, scope, metadata
    ) VALUES (
      p_user_id, v_permission_id, 'used', p_scope, p_metadata
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger to update scope_definitions updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scope_definitions_updated_at
BEFORE UPDATE ON scope_definitions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Easy Querying
-- ============================================================================

-- Active permissions with scope details
CREATE OR REPLACE VIEW active_permissions AS
SELECT 
  p.id,
  p.user_id,
  p.scope,
  sd.name AS scope_name,
  sd.description AS scope_description,
  sd.category,
  sd.risk_level,
  p.status,
  p.granted_at,
  p.expires_at,
  p.last_used_at,
  p.granted_by,
  p.consent_version
FROM permissions p
JOIN scope_definitions sd ON p.scope = sd.scope
WHERE p.status = 'active'
  AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP);

-- User permission summary
CREATE OR REPLACE VIEW user_permission_summary AS
SELECT 
  p.user_id,
  sd.category,
  COUNT(*) AS total_permissions,
  COUNT(*) FILTER (WHERE p.status = 'active') AS active_permissions,
  COUNT(*) FILTER (WHERE p.status = 'revoked') AS revoked_permissions,
  COUNT(*) FILTER (WHERE sd.risk_level = 'critical') AS critical_permissions
FROM permissions p
JOIN scope_definitions sd ON p.scope = sd.scope
GROUP BY p.user_id, sd.category;

-- ============================================================================
-- Indexes for Audit Log Performance
-- ============================================================================

CREATE INDEX idx_consent_audit_user_action ON consent_audit_log(user_id, action);
CREATE INDEX idx_consent_audit_timestamp_desc ON consent_audit_log(timestamp DESC);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE permissions IS 'Stores user permissions and consent for data access';
COMMENT ON TABLE consent_audit_log IS 'Complete audit trail of all permission changes';
COMMENT ON TABLE scope_definitions IS 'Defines all available permission scopes';
COMMENT ON COLUMN permissions.scope_hash IS 'Hash of scope definition for versioning';
COMMENT ON FUNCTION has_permission IS 'Check if user has active permission for scope';
COMMENT ON FUNCTION grant_permission IS 'Grant permission to user with audit trail';
COMMENT ON FUNCTION revoke_permission IS 'Revoke permission from user with audit trail';
COMMENT ON FUNCTION expire_permissions IS 'Expire permissions that have passed expiry date';
COMMENT ON FUNCTION log_permission_usage IS 'Log when a permission is actually used';
