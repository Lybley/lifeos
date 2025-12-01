-- Action Engine Database Schemas

-- ============================================================================
-- ACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  
  payload JSONB NOT NULL,
  
  requires_approval BOOLEAN DEFAULT true,
  approval_token VARCHAR(255) UNIQUE,
  approval_expires_at TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  rollback_data JSONB,
  rolled_back_at TIMESTAMP,
  rollback_reason TEXT,
  
  rate_limit_key VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions(action_type);
CREATE INDEX IF NOT EXISTS idx_actions_approval_token ON actions(approval_token);
CREATE INDEX IF NOT EXISTS idx_actions_scheduled_for ON actions(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_actions_created_at ON actions(created_at);
CREATE INDEX IF NOT EXISTS idx_actions_rate_limit_key ON actions(rate_limit_key);

-- ============================================================================
-- ACTION AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  source VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action_id ON action_audit_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON action_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON action_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON action_audit_logs(created_at);

-- ============================================================================
-- RATE LIMITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_limit_key VARCHAR(255) NOT NULL,
  count INTEGER DEFAULT 0,
  window_start TIMESTAMP DEFAULT NOW(),
  window_duration INTERVAL DEFAULT '1 day',
  limit_value INTEGER NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (rate_limit_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON action_rate_limits(rate_limit_key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON action_rate_limits(window_start);

-- ============================================================================
-- SAFETY RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_safety_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  rule_config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (action_type, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_safety_rules_type ON action_safety_rules(action_type);
CREATE INDEX IF NOT EXISTS idx_safety_rules_enabled ON action_safety_rules(enabled);

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
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollback_action_id ON action_rollback_history(action_id);
CREATE INDEX IF NOT EXISTS idx_rollback_created_at ON action_rollback_history(created_at);

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
