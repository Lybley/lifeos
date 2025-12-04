-- Inter-Agent Communication Bus & Orchestration Schema

-- ============================================================================
-- AGENTS REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Agent identification
  agent_id VARCHAR(100) UNIQUE NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL, -- scheduling, proposal, analysis, etc.
  
  -- Capabilities
  capabilities TEXT[], -- What this agent can do
  supported_message_types TEXT[], -- REQUEST, RESPONSE, EVENT
  
  -- Connection
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
  last_heartbeat TIMESTAMP,
  
  -- Configuration
  config JSONB DEFAULT '{}',
  
  -- Metrics
  total_messages_processed INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  average_response_time_ms FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_registry_agent_id ON agents_registry(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_registry_status ON agents_registry(status);
CREATE INDEX IF NOT EXISTS idx_agents_registry_type ON agents_registry(agent_type);

-- ============================================================================
-- MESSAGE LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Message identification
  message_id VARCHAR(100) UNIQUE NOT NULL,
  correlation_id VARCHAR(100), -- Links related messages
  conversation_id VARCHAR(100), -- Groups messages in a conversation
  
  -- Message details
  message_type VARCHAR(50) NOT NULL, -- REQUEST, RESPONSE, EVENT, ESCALATION
  topic VARCHAR(255) NOT NULL, -- Pub/Sub topic
  
  -- Sender/Receiver
  from_agent_id VARCHAR(100) NOT NULL,
  to_agent_id VARCHAR(100), -- Null for broadcast events
  
  -- Payload
  payload JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, processed, failed
  error_message TEXT,
  
  -- Timing
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  processed_at TIMESTAMP,
  
  -- Tracing
  trace_id VARCHAR(100), -- For distributed tracing
  span_id VARCHAR(100),
  parent_span_id VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_message_id ON agent_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_correlation_id ON agent_messages(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_from_agent ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_trace_id ON agent_messages(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at);

-- ============================================================================
-- WORKFLOWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Workflow definition
  workflow_id VARCHAR(100) UNIQUE NOT NULL,
  workflow_name VARCHAR(255) NOT NULL,
  workflow_version VARCHAR(20) DEFAULT 'v1.0',
  
  -- Definition
  steps JSONB NOT NULL, -- Array of workflow steps
  transitions JSONB, -- State transition rules
  
  -- Metadata
  description TEXT,
  tags TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_workflow_id ON workflows(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);

-- ============================================================================
-- WORKFLOW EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Execution identification
  execution_id VARCHAR(100) UNIQUE NOT NULL,
  workflow_id VARCHAR(100) NOT NULL REFERENCES workflows(workflow_id),
  
  -- Context
  trigger_event JSONB, -- What triggered this workflow
  user_id VARCHAR(255),
  
  -- State
  current_step VARCHAR(100),
  status VARCHAR(50) DEFAULT 'running', -- running, completed, failed, paused
  
  -- Progress
  completed_steps TEXT[] DEFAULT '{}',
  pending_steps TEXT[] DEFAULT '{}',
  failed_steps TEXT[] DEFAULT '{}',
  
  -- Data
  context_data JSONB DEFAULT '{}', -- Workflow variables
  result JSONB,
  
  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_id ON workflow_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);

-- ============================================================================
-- WORKFLOW STEP EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  execution_id VARCHAR(100) NOT NULL REFERENCES workflow_executions(execution_id),
  
  -- Step details
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  agent_id VARCHAR(100), -- Which agent executed this step
  
  -- Input/Output
  input_data JSONB,
  output_data JSONB,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_step_id ON workflow_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);

-- ============================================================================
-- ESCALATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Escalation details
  escalation_id VARCHAR(100) UNIQUE NOT NULL,
  execution_id VARCHAR(100) REFERENCES workflow_executions(execution_id),
  
  -- Context
  from_agent_id VARCHAR(100) NOT NULL,
  escalation_type VARCHAR(100) NOT NULL, -- timeout, error, conflict, human_needed
  
  -- Details
  reason TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  
  -- Resolution
  status VARCHAR(50) DEFAULT 'open', -- open, assigned, resolved, dismissed
  assigned_to VARCHAR(255), -- Human or supervisor agent
  resolution TEXT,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_escalations_escalation_id ON agent_escalations(escalation_id);
CREATE INDEX IF NOT EXISTS idx_agent_escalations_status ON agent_escalations(status);
CREATE INDEX IF NOT EXISTS idx_agent_escalations_severity ON agent_escalations(severity);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Register sample agents
INSERT INTO agents_registry (
  agent_id, agent_name, agent_type, capabilities, supported_message_types, status
) VALUES
  (
    'scheduling-agent',
    'Meeting Scheduler',
    'scheduling',
    ARRAY['schedule_meeting', 'find_availability', 'send_invites'],
    ARRAY['REQUEST', 'RESPONSE', 'EVENT'],
    'active'
  ),
  (
    'proposal-agent',
    'Proposal Generator',
    'proposal',
    ARRAY['generate_proposal', 'customize_template', 'review_content'],
    ARRAY['REQUEST', 'RESPONSE'],
    'active'
  ),
  (
    'followup-agent',
    'Follow-up Manager',
    'followup',
    ARRAY['schedule_followup', 'send_reminder', 'track_engagement'],
    ARRAY['REQUEST', 'RESPONSE', 'EVENT'],
    'active'
  );

-- Create sample workflow: Lead to Proposal to Follow-up
INSERT INTO workflows (
  workflow_id, workflow_name, workflow_version, steps, description
) VALUES (
  'lead-to-proposal',
  'Lead to Proposal Workflow',
  'v1.0',
  '[
    {
      "id": "schedule_meeting",
      "name": "Schedule Discovery Call",
      "agent": "scheduling-agent",
      "action": "schedule_meeting",
      "timeout_seconds": 300,
      "retry": 2
    },
    {
      "id": "generate_proposal",
      "name": "Generate Proposal",
      "agent": "proposal-agent",
      "action": "generate_proposal",
      "depends_on": ["schedule_meeting"],
      "timeout_seconds": 600,
      "retry": 1
    },
    {
      "id": "schedule_followup",
      "name": "Schedule Follow-up",
      "agent": "followup-agent",
      "action": "schedule_followup",
      "depends_on": ["generate_proposal"],
      "timeout_seconds": 180,
      "retry": 2
    }
  ]',
  'Complete workflow from lead capture to proposal delivery with follow-up'
);

COMMENT ON TABLE agents_registry IS 'Registry of all agents in the system';
COMMENT ON TABLE agent_messages IS 'Complete log of all inter-agent messages';
COMMENT ON TABLE workflows IS 'Workflow definitions with steps and transitions';
COMMENT ON TABLE workflow_executions IS 'Runtime instances of workflow executions';
COMMENT ON TABLE workflow_step_executions IS 'Individual step execution logs';
COMMENT ON TABLE agent_escalations IS 'Escalations requiring human intervention';
