-- Action Engine Database Schemas

-- ============================================================================
-- ACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- create_calendar_event, send_email, move_file, create_document
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, executing, completed, failed, rolled_back
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  -- Action payload
  payload JSONB NOT NULL,
  
  -- Approval workflow
  requires_approval BOOLEAN DEFAULT true,
  approval_token VARCHAR(255) UNIQUE,
  approval_expires_at TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Execution metadata
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Rollback metadata
  rollback_data JSONB, -- Data needed to undo the action
  rolled_back_at TIMESTAMP,
  rollback_reason TEXT,
  
  -- Rate limiting
  rate_limit_key VARCHAR(255), -- e.g., 'send_email:user_123'
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_actions_user_id (user_id),
  INDEX idx_actions_status (status),
  INDEX idx_actions_action_type (action_type),
  INDEX idx_actions_approval_token (approval_token),
  INDEX idx_actions_scheduled_for (scheduled_for),
  INDEX idx_actions_created_at (created_at),
  INDEX idx_actions_rate_limit_key (rate_limit_key)
);

-- ============================================================================
-- ACTION AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- created, approved, rejected, started, completed, failed, rolled_back
  event_data JSONB,
  
  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,
  source VARCHAR(50), -- api, webhook, email_link, ui
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_audit_action_id (action_id),
  INDEX idx_audit_user_id (user_id),
  INDEX idx_audit_event_type (event_type),
  INDEX idx_audit_created_at (created_at)
);

-- ============================================================================
-- RATE LIMITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_limit_key VARCHAR(255) NOT NULL, -- e.g., 'send_email:user_123:daily'
  count INTEGER DEFAULT 0,
  window_start TIMESTAMP DEFAULT NOW(),
  window_duration INTERVAL DEFAULT '1 day',
  limit_value INTEGER NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (rate_limit_key, window_start),
  INDEX idx_rate_limits_key (rate_limit_key),
  INDEX idx_rate_limits_window (window_start)
);

-- ============================================================================
-- SAFETY RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_safety_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- blocked, requires_approval, requires_kyc, rate_limit
  rule_config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (action_type, rule_name),
  INDEX idx_safety_rules_type (action_type),
  INDEX idx_safety_rules_enabled (enabled)
);

-- ============================================================================
-- ROLLBACK HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_rollback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id),
  rolled_back_by VARCHAR(255),
  rollback_reason TEXT,
  rollback_data JSONB,
  success BOOLEAN,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_rollback_action_id (action_id),
  INDEX idx_rollback_created_at (created_at)
);

-- ============================================================================
-- DEFAULT SAFETY RULES
-- ============================================================================

-- Insert default safety rules
INSERT INTO action_safety_rules (action_type, rule_name, rule_type, rule_config) VALUES
  -- Email rate limits
  ('send_email', 'hourly_limit', 'rate_limit', '{"limit": 50, "window": "1 hour"}'),
  ('send_email', 'daily_limit', 'rate_limit', '{"limit": 500, "window": "1 day"}'),
  
  -- Calendar limits
  ('create_calendar_event', 'daily_limit', 'rate_limit', '{"limit": 100, "window": "1 day"}'),
  
  -- File operations
  ('move_file', 'requires_approval', 'requires_approval', '{"auto_approve_threshold": 10}'),
  
  -- Document creation
  ('create_document', 'daily_limit', 'rate_limit', '{"limit": 200, "window": "1 day"}'),
  
  -- Blocked actions (examples)
  ('make_payment', 'blocked', 'blocked', '{"reason": "Payment actions are disabled"}'),
  ('make_purchase', 'kyc_required', 'requires_kyc', '{"reason": "Manual KYC verification required"}')
ON CONFLICT (action_type, rule_name) DO NOTHING;
