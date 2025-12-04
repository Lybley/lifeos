-- Admin Dashboard Schema
-- Multi-tenant management, metrics, billing, and security

-- ============================================================================
-- ADMIN ROLES & PERMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Permissions (bitwise or JSON)
  permissions JSONB NOT NULL DEFAULT '{}',
  
  -- Hierarchy
  level INTEGER DEFAULT 0, -- 0=super_admin, 1=admin, 2=support, 3=viewer
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON admin_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_admin_roles_level ON admin_roles(level);

-- Insert default roles
INSERT INTO admin_roles (role_name, description, level, permissions) VALUES
  ('super_admin', 'Full system access', 0, '{"users": ["read", "write", "delete"], "billing": ["read", "write"], "metrics": ["read"], "support": ["read", "write"], "admin": ["read", "write", "delete"], "system": ["read", "write"]}'),
  ('admin', 'Admin access without user deletion', 1, '{"users": ["read", "write"], "billing": ["read", "write"], "metrics": ["read"], "support": ["read", "write"], "admin": ["read"]}'),
  ('support', 'User support and read access', 2, '{"users": ["read"], "billing": ["read"], "metrics": ["read"], "support": ["read", "write"]}'),
  ('viewer', 'Read-only access to metrics', 3, '{"metrics": ["read"], "billing": ["read"]}');

-- ============================================================================
-- ADMIN USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Role
  role_id UUID REFERENCES admin_roles(id),
  role_name VARCHAR(50) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, deactivated
  
  -- MFA
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(100),
  
  -- Session
  last_login TIMESTAMP,
  last_activity TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role_name);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- ============================================================================
-- ADMIN AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Admin action
  admin_user_id VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255),
  
  -- Action details
  action VARCHAR(100) NOT NULL, -- view_user, edit_user, impersonate, revoke_integration, etc.
  resource_type VARCHAR(100), -- user, integration, billing, system
  resource_id VARCHAR(255),
  
  -- Context
  description TEXT,
  changes JSONB, -- Before/after for edits
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- ============================================================================
-- USER ACTIVITY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id VARCHAR(255) NOT NULL,
  
  -- Activity
  activity_type VARCHAR(100) NOT NULL, -- login, api_call, task_created, etc.
  activity_details JSONB,
  
  -- Context
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  duration_ms INTEGER,
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created ON user_activity_logs(created_at DESC);

-- Partition by month for performance
-- CREATE TABLE user_activity_logs_2025_01 PARTITION OF user_activity_logs
--   FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ============================================================================
-- SYSTEM METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metric details
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- counter, gauge, histogram
  value FLOAT NOT NULL,
  
  -- Dimensions
  dimensions JSONB DEFAULT '{}',
  
  -- Aggregation period
  period VARCHAR(20), -- hour, day, week, month
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_period ON system_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);

-- ============================================================================
-- USER CONSENTS (Enhanced for admin view)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_consents_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id VARCHAR(255) NOT NULL,
  
  -- Consent details
  consent_type VARCHAR(100) NOT NULL,
  consent_status BOOLEAN NOT NULL,
  version VARCHAR(20),
  
  -- Metadata
  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address INET,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_snapshot_user ON user_consents_snapshot(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_snapshot_type ON user_consents_snapshot(consent_type);

-- ============================================================================
-- IMPERSONATION SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  session_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Admin and target user
  admin_user_id VARCHAR(255) NOT NULL,
  target_user_id VARCHAR(255) NOT NULL,
  
  -- Session details
  mode VARCHAR(20) DEFAULT 'read_only', -- read_only, debug
  reason TEXT NOT NULL,
  
  -- Duration
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  
  -- Activity tracking
  actions_performed JSONB DEFAULT '[]',
  pages_viewed TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin ON impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON impersonation_sessions(started_at, expires_at) WHERE ended_at IS NULL;

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  ticket_id VARCHAR(50) UNIQUE NOT NULL,
  
  user_id VARCHAR(255) NOT NULL,
  
  -- Ticket details
  subject VARCHAR(500) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
  category VARCHAR(100),
  
  -- Assignment
  assigned_to VARCHAR(255),
  
  -- Resolution
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id ON support_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);

-- ============================================================================
-- IN-APP MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS in_app_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  message_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Target
  target_type VARCHAR(50) NOT NULL, -- user, segment, all
  target_user_id VARCHAR(255),
  target_segment VARCHAR(100),
  
  -- Message
  message_type VARCHAR(50) NOT NULL, -- announcement, alert, support
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  
  -- Display
  display_type VARCHAR(50) DEFAULT 'banner', -- banner, modal, toast
  dismissible BOOLEAN DEFAULT true,
  
  -- Scheduling
  scheduled_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Delivery tracking
  sent_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  
  -- Creator
  created_by VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_messages_target ON in_app_messages(target_type, target_user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_messages_scheduled ON in_app_messages(scheduled_at);

-- ============================================================================
-- BILLING SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  snapshot_date DATE NOT NULL,
  
  -- Revenue metrics
  mrr DECIMAL(10, 2), -- Monthly Recurring Revenue
  arr DECIMAL(10, 2), -- Annual Recurring Revenue
  total_revenue DECIMAL(10, 2),
  
  -- User metrics
  total_users INTEGER,
  paying_users INTEGER,
  trial_users INTEGER,
  churned_users INTEGER,
  
  -- Plan breakdown
  plan_distribution JSONB,
  
  -- Churn metrics
  churn_rate FLOAT,
  revenue_churn_rate FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_billing_snapshots_date ON billing_snapshots(snapshot_date DESC);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Create sample admin user
INSERT INTO admin_users (user_id, email, name, role_id, role_name) 
VALUES (
  'admin-001',
  'admin@lifeos.com',
  'System Admin',
  (SELECT id FROM admin_roles WHERE role_name = 'super_admin'),
  'super_admin'
) ON CONFLICT (user_id) DO NOTHING;

-- Sample metrics
INSERT INTO system_metrics (metric_name, metric_type, value, period, period_start, period_end) VALUES
  ('signups', 'counter', 45, 'day', NOW() - INTERVAL '1 day', NOW()),
  ('dau', 'gauge', 1250, 'day', NOW() - INTERVAL '1 day', NOW()),
  ('rag_latency_p95', 'histogram', 245.5, 'hour', NOW() - INTERVAL '1 hour', NOW()),
  ('agent_suggestions_avg', 'gauge', 8.3, 'day', NOW() - INTERVAL '1 day', NOW());

COMMENT ON TABLE admin_roles IS 'Role-based access control for admin users';
COMMENT ON TABLE admin_users IS 'Admin user accounts with role assignments';
COMMENT ON TABLE admin_audit_logs IS 'Complete audit trail of all admin actions';
COMMENT ON TABLE user_activity_logs IS 'User activity tracking for support and analytics';
COMMENT ON TABLE system_metrics IS 'System-wide metrics aggregated over time';
COMMENT ON TABLE impersonation_sessions IS 'Read-only user session impersonation for support';
COMMENT ON TABLE support_tickets IS 'User support ticket management';
COMMENT ON TABLE in_app_messages IS 'Admin-created messages to users';
COMMENT ON TABLE billing_snapshots IS 'Daily snapshots of billing and revenue metrics';
