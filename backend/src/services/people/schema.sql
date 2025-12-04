-- ============================================================================
-- PEOPLE INTELLIGENCE ENGINE - POSTGRESQL SCHEMA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PEOPLE TABLE (Core person data with intelligence features)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Core identity
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Relationship metrics (0-1 normalized)
  relationship_strength DECIMAL(3,2) DEFAULT 0.50,
  conversation_frequency DECIMAL(3,2) DEFAULT 0.00,
  sentiment_trend DECIMAL(4,3) DEFAULT 0.000, -- -1 to 1
  trust_score DECIMAL(3,2) DEFAULT 0.50,
  
  -- Communication patterns
  comm_style VARCHAR(20) DEFAULT 'casual',
  response_time_avg DECIMAL(8,2) DEFAULT 0, -- hours
  initiation_ratio DECIMAL(3,2) DEFAULT 0.50, -- 0-1
  
  -- Temporal tracking
  last_contact TIMESTAMP,
  first_contact TIMESTAMP DEFAULT NOW(),
  total_interactions INTEGER DEFAULT 0,
  
  -- Derived insights
  relationship_health VARCHAR(20) DEFAULT 'fair',
  risk_level VARCHAR(20) DEFAULT 'none',
  engagement_trend VARCHAR(20) DEFAULT 'stable',
  
  -- Context
  relationship_type VARCHAR(20) DEFAULT 'acquaintance',
  tags TEXT[], -- Array of tags
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  next_suggested_contact TIMESTAMP,
  
  CONSTRAINT unique_person_per_user UNIQUE (user_id, email)
);

-- Indexes for people table
CREATE INDEX idx_people_user_id ON people(user_id);
CREATE INDEX idx_people_relationship_health ON people(relationship_health);
CREATE INDEX idx_people_risk_level ON people(risk_level);
CREATE INDEX idx_people_last_contact ON people(last_contact);
CREATE INDEX idx_people_relationship_strength ON people(relationship_strength);

-- ----------------------------------------------------------------------------
-- CONVERSATIONS TABLE (Conversation metadata)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  -- Temporal
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  duration INTEGER, -- minutes
  
  -- Participants
  initiated_by VARCHAR(10) NOT NULL CHECK (initiated_by IN ('user', 'person')),
  
  -- Content analysis
  message_count INTEGER DEFAULT 1,
  word_count INTEGER DEFAULT 0,
  topics TEXT[],
  
  -- Sentiment
  sentiment_overall DECIMAL(4,3) DEFAULT 0, -- -1 to 1
  sentiment_compound DECIMAL(4,3) DEFAULT 0,
  sentiment_positive DECIMAL(3,2) DEFAULT 0,
  sentiment_negative DECIMAL(3,2) DEFAULT 0,
  sentiment_neutral DECIMAL(3,2) DEFAULT 0,
  sentiment_confidence DECIMAL(3,2) DEFAULT 0,
  
  -- Response patterns
  response_time DECIMAL(8,2), -- hours
  user_engagement DECIMAL(3,2) DEFAULT 0.5, -- 0-1
  person_engagement DECIMAL(3,2) DEFAULT 0.5, -- 0-1
  
  -- Channel
  channel VARCHAR(20) NOT NULL,
  
  -- Quality indicators
  had_conflict BOOLEAN DEFAULT FALSE,
  was_positive BOOLEAN DEFAULT FALSE,
  was_productive BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_engagement CHECK (
    user_engagement >= 0 AND user_engagement <= 1 AND
    person_engagement >= 0 AND person_engagement <= 1
  )
);

-- Indexes for conversations
CREATE INDEX idx_conversations_person_id ON conversations(person_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_sentiment ON conversations(sentiment_overall);

-- ----------------------------------------------------------------------------
-- WEEKLY FEATURES TABLE (Aggregated weekly metrics)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weekly_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  -- Time period
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Volume metrics
  conversation_count INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  
  -- Initiation patterns
  user_initiated INTEGER DEFAULT 0,
  person_initiated INTEGER DEFAULT 0,
  initiation_ratio DECIMAL(3,2) DEFAULT 0,
  
  -- Response metrics
  avg_response_time DECIMAL(8,2) DEFAULT 0,
  max_response_time DECIMAL(8,2) DEFAULT 0,
  missed_responses INTEGER DEFAULT 0,
  
  -- Sentiment aggregates
  avg_sentiment DECIMAL(4,3) DEFAULT 0,
  sentiment_variance DECIMAL(4,3) DEFAULT 0,
  positive_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  
  -- Engagement
  avg_user_engagement DECIMAL(3,2) DEFAULT 0,
  avg_person_engagement DECIMAL(3,2) DEFAULT 0,
  mutual_engagement DECIMAL(3,2) DEFAULT 0,
  
  -- Quality
  conflict_count INTEGER DEFAULT 0,
  productive_count INTEGER DEFAULT 0,
  
  -- Channels
  channel_distribution JSONB DEFAULT '{}',
  preferred_channel VARCHAR(20),
  
  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_weekly_features UNIQUE (person_id, week_start)
);

-- Indexes for weekly_features
CREATE INDEX idx_weekly_features_person_id ON weekly_features(person_id);
CREATE INDEX idx_weekly_features_week_start ON weekly_features(week_start DESC);

-- ----------------------------------------------------------------------------
-- RELATIONSHIP INSIGHTS TABLE (Computed insights and recommendations)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS relationship_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  -- Health assessment
  health_score DECIMAL(5,2) NOT NULL, -- 0-100
  health_status VARCHAR(20) NOT NULL,
  risk_factors JSONB DEFAULT '[]',
  strengths TEXT[],
  
  -- Trends
  strength_trend JSONB,
  sentiment_trend JSONB,
  frequency_trend JSONB,
  
  -- Predictions
  churn_risk DECIMAL(3,2) DEFAULT 0, -- 0-1
  next_contact_prediction TIMESTAMP,
  
  -- Recommendations
  recommended_actions JSONB DEFAULT '[]',
  
  -- Context
  comparison_percentile DECIMAL(5,2), -- 0-100
  avg_health_score DECIMAL(5,2),
  
  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT latest_insight_per_person UNIQUE (person_id, computed_at)
);

-- Indexes for relationship_insights
CREATE INDEX idx_insights_person_id ON relationship_insights(person_id);
CREATE INDEX idx_insights_health_status ON relationship_insights(health_status);
CREATE INDEX idx_insights_churn_risk ON relationship_insights(churn_risk DESC);
CREATE INDEX idx_insights_computed_at ON relationship_insights(computed_at DESC);

-- ----------------------------------------------------------------------------
-- RECOMMENDED ACTIONS TABLE (Tracked actions and their outcomes)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recommended_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  
  -- Action details
  action_type VARCHAR(30) NOT NULL,
  priority VARCHAR(10) NOT NULL,
  reason TEXT,
  template TEXT,
  
  -- Timing
  suggested_timing TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Execution
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, dismissed, expired
  completed_at TIMESTAMP,
  outcome VARCHAR(20), -- positive, negative, neutral, unknown
  
  -- Metadata
  insight_id UUID REFERENCES relationship_insights(id)
);

-- Indexes for recommended_actions
CREATE INDEX idx_actions_person_id ON recommended_actions(person_id);
CREATE INDEX idx_actions_status ON recommended_actions(status);
CREATE INDEX idx_actions_priority ON recommended_actions(priority);
CREATE INDEX idx_actions_suggested_timing ON recommended_actions(suggested_timing);

-- ----------------------------------------------------------------------------
-- VIEWS FOR ANALYTICS
-- ----------------------------------------------------------------------------

-- Relationship health dashboard view
CREATE OR REPLACE VIEW relationship_health_dashboard AS
SELECT 
  user_id,
  COUNT(*) as total_connections,
  AVG(relationship_strength) as avg_strength,
  COUNT(CASE WHEN relationship_health = 'excellent' THEN 1 END) as excellent_count,
  COUNT(CASE WHEN relationship_health = 'good' THEN 1 END) as good_count,
  COUNT(CASE WHEN relationship_health = 'fair' THEN 1 END) as fair_count,
  COUNT(CASE WHEN relationship_health = 'at_risk' THEN 1 END) as at_risk_count,
  COUNT(CASE WHEN relationship_health = 'needs_attention' THEN 1 END) as needs_attention_count,
  COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as high_risk_count,
  COUNT(CASE WHEN last_contact >= NOW() - INTERVAL '30 days' THEN 1 END) as active_last_30d,
  COUNT(CASE WHEN last_contact < NOW() - INTERVAL '90 days' THEN 1 END) as dormant_90d
FROM people
GROUP BY user_id;

-- Recent conversation summary
CREATE OR REPLACE VIEW recent_conversation_summary AS
SELECT 
  c.person_id,
  p.name as person_name,
  p.user_id,
  COUNT(*) as conversation_count_7d,
  AVG(c.sentiment_overall) as avg_sentiment_7d,
  AVG(c.user_engagement) as avg_engagement_7d,
  MAX(c.timestamp) as last_conversation
FROM conversations c
JOIN people p ON c.person_id = p.id
WHERE c.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY c.person_id, p.name, p.user_id;

-- At-risk relationships view
CREATE OR REPLACE VIEW at_risk_relationships AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.relationship_health,
  p.risk_level,
  p.last_contact,
  EXTRACT(DAY FROM NOW() - p.last_contact) as days_since_contact,
  ri.churn_risk,
  ri.health_score,
  (
    SELECT COUNT(*) 
    FROM recommended_actions ra 
    WHERE ra.person_id = p.id AND ra.status = 'pending'
  ) as pending_actions
FROM people p
LEFT JOIN LATERAL (
  SELECT * FROM relationship_insights 
  WHERE person_id = p.id 
  ORDER BY computed_at DESC 
  LIMIT 1
) ri ON TRUE
WHERE p.risk_level IN ('high', 'critical')
   OR p.relationship_health IN ('at_risk', 'needs_attention')
ORDER BY ri.churn_risk DESC NULLS LAST;

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function to update person's updated_at timestamp
CREATE OR REPLACE FUNCTION update_person_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for people table
CREATE TRIGGER trigger_update_person_timestamp
BEFORE UPDATE ON people
FOR EACH ROW
EXECUTE FUNCTION update_person_timestamp();

-- Function to compute health score percentile
CREATE OR REPLACE FUNCTION compute_health_percentile(p_user_id VARCHAR, p_health_score DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  percentile DECIMAL;
BEGIN
  SELECT 
    (COUNT(CASE WHEN ri.health_score < p_health_score THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
  INTO percentile
  FROM relationship_insights ri
  JOIN people p ON ri.person_id = p.id
  WHERE p.user_id = p_user_id
    AND ri.computed_at >= NOW() - INTERVAL '7 days';
  
  RETURN COALESCE(percentile, 50.0);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- SAMPLE DATA SEEDING (for testing)
-- ----------------------------------------------------------------------------

-- Insert sample person
/*
INSERT INTO people (user_id, name, email, relationship_strength, sentiment_trend, trust_score, comm_style, relationship_type)
VALUES 
  ('user_123', 'Sarah Johnson', 'sarah@example.com', 0.85, 0.65, 0.90, 'responsive', 'colleague'),
  ('user_123', 'Mike Chen', 'mike@example.com', 0.60, -0.20, 0.55, 'slow', 'client'),
  ('user_123', 'Emily Davis', 'emily@example.com', 0.92, 0.80, 0.95, 'casual', 'friend');
*/
