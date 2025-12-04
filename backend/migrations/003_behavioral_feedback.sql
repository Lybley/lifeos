-- Behavioral Feedback Loop Schema
-- Stores user feedback on agent suggestions and tracks model performance

-- ============================================================================
-- USER FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Context
  suggestion_type VARCHAR(100) NOT NULL, -- task_scheduling, action_recommendation, planner_block, etc.
  suggestion_id UUID NOT NULL, -- ID of the suggested item
  suggestion_data JSONB NOT NULL, -- Full suggestion details
  context_data JSONB, -- Context when suggestion was made (time, user state, etc.)
  
  -- Feedback
  feedback_type VARCHAR(50) NOT NULL, -- accept, reject, modify, ignore
  confidence_score FLOAT, -- Agent's confidence when making suggestion (0-1)
  user_rating INTEGER, -- User's explicit rating (1-5) if provided
  
  -- Modifications (if applicable)
  original_value JSONB,
  modified_value JSONB,
  modification_type VARCHAR(100), -- time_change, priority_change, category_change, etc.
  
  -- Outcome tracking
  was_completed BOOLEAN,
  completed_at TIMESTAMP,
  outcome_quality VARCHAR(50), -- success, partial, failure
  
  -- Timestamps
  suggested_at TIMESTAMP DEFAULT NOW(),
  feedback_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_suggested_at ON user_feedback(suggested_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_suggestion_id ON user_feedback(suggestion_id);

-- ============================================================================
-- BEHAVIOR PATTERNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Pattern identification
  pattern_type VARCHAR(100) NOT NULL, -- time_preference, priority_adjustment, category_preference, etc.
  pattern_name VARCHAR(255) NOT NULL,
  
  -- Pattern details
  pattern_features JSONB NOT NULL, -- Extracted features defining the pattern
  confidence FLOAT DEFAULT 0.5, -- Pattern confidence (0-1)
  frequency INTEGER DEFAULT 1, -- How often this pattern appears
  
  -- Impact
  weight FLOAT DEFAULT 1.0, -- How much this pattern should influence suggestions
  last_applied_at TIMESTAMP,
  
  -- Metadata
  discovered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, pattern_type, pattern_name)
);

CREATE INDEX IF NOT EXISTS idx_behavior_patterns_user_id ON behavior_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_patterns_type ON behavior_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_behavior_patterns_confidence ON behavior_patterns(confidence);

-- ============================================================================
-- MODEL VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Model identification
  model_name VARCHAR(100) NOT NULL, -- behavior_scorer, task_prioritizer, etc.
  version VARCHAR(50) NOT NULL,
  
  -- Model metadata
  algorithm VARCHAR(100), -- linear_regression, xgboost, neural_net, etc.
  hyperparameters JSONB,
  feature_names TEXT[],
  
  -- Training info
  trained_at TIMESTAMP DEFAULT NOW(),
  training_samples INTEGER,
  training_duration FLOAT, -- seconds
  
  -- Performance metrics
  metrics JSONB, -- {accuracy, precision, recall, f1, mae, rmse, etc.}
  
  -- Deployment
  deployed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  deployment_environment VARCHAR(50) DEFAULT 'production', -- production, staging, test
  
  -- Model artifacts
  model_path VARCHAR(500), -- Path to serialized model file
  model_checksum VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_model_versions_name ON ml_model_versions(model_name);
CREATE INDEX IF NOT EXISTS idx_ml_model_versions_active ON ml_model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_ml_model_versions_version ON ml_model_versions(version);

-- ============================================================================
-- MODEL PERFORMANCE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID REFERENCES ml_model_versions(id),
  
  -- Performance window
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  
  -- Metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy FLOAT,
  
  -- Detailed metrics
  metrics_by_class JSONB, -- Per-class performance
  confusion_matrix JSONB,
  
  -- Drift detection
  feature_drift_detected BOOLEAN DEFAULT false,
  concept_drift_detected BOOLEAN DEFAULT false,
  drift_score FLOAT,
  
  -- Alerts
  performance_below_threshold BOOLEAN DEFAULT false,
  alert_triggered BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_id ON model_performance_log(model_version_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_window ON model_performance_log(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_model_performance_drift ON model_performance_log(feature_drift_detected);

-- ============================================================================
-- RETRAINING JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS retraining_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  model_name VARCHAR(100) NOT NULL,
  
  -- Job info
  job_type VARCHAR(50) NOT NULL, -- scheduled, drift_triggered, manual
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Trigger
  triggered_by VARCHAR(100), -- cron, drift_detector, admin_user_id
  trigger_reason TEXT,
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration FLOAT, -- seconds
  
  -- Results
  new_model_version_id UUID REFERENCES ml_model_versions(id),
  training_samples INTEGER,
  performance_improvement FLOAT, -- Percentage improvement over previous model
  
  -- Errors
  error_message TEXT,
  error_stack TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retraining_jobs_model_name ON retraining_jobs(model_name);
CREATE INDEX IF NOT EXISTS idx_retraining_jobs_status ON retraining_jobs(status);
CREATE INDEX IF NOT EXISTS idx_retraining_jobs_created ON retraining_jobs(created_at);

-- ============================================================================
-- BEHAVIOR SCORES TABLE (Cached predictions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Scoring context
  context_type VARCHAR(100) NOT NULL, -- task, action, time_slot, etc.
  context_id UUID,
  
  -- Scores
  acceptance_probability FLOAT, -- Probability user will accept (0-1)
  priority_score FLOAT, -- Adjusted priority based on behavior
  confidence_score FLOAT, -- Model confidence in this prediction
  
  -- Features used
  features JSONB,
  
  -- Model used
  model_version_id UUID REFERENCES ml_model_versions(id),
  
  -- Validity
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Cache expiration
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_scores_user_id ON behavior_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_scores_context ON behavior_scores(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_behavior_scores_expires ON behavior_scores(expires_at);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert initial model version (baseline)
INSERT INTO ml_model_versions (
  model_name,
  version,
  algorithm,
  hyperparameters,
  feature_names,
  training_samples,
  training_duration,
  metrics,
  is_active,
  model_path
) VALUES (
  'behavior_scorer',
  'v1.0.0-baseline',
  'logistic_regression',
  '{"C": 1.0, "penalty": "l2", "solver": "liblinear"}',
  ARRAY['hour_of_day', 'day_of_week', 'task_priority', 'user_energy', 'recent_accept_rate'],
  100,
  5.2,
  '{"accuracy": 0.72, "precision": 0.68, "recall": 0.75, "f1": 0.71}',
  true,
  '/app/ml-models/behavior_scorer_v1.0.0.pkl'
);

-- Insert sample feedback
INSERT INTO user_feedback (
  user_id,
  suggestion_type,
  suggestion_id,
  suggestion_data,
  context_data,
  feedback_type,
  confidence_score,
  suggested_at
) VALUES 
  (
    'test-user-1',
    'task_scheduling',
    gen_random_uuid(),
    '{"task": "Complete report", "suggested_time": "2025-12-05T09:00:00Z", "duration": 120}',
    '{"current_time": "2025-12-04T15:00:00Z", "user_energy": 0.8, "pending_tasks": 5}',
    'accept',
    0.85,
    NOW() - INTERVAL '2 days'
  ),
  (
    'test-user-1',
    'task_scheduling',
    gen_random_uuid(),
    '{"task": "Gym workout", "suggested_time": "2025-12-05T18:00:00Z", "duration": 60}',
    '{"current_time": "2025-12-04T15:00:00Z", "user_energy": 0.6}',
    'modify',
    0.65,
    NOW() - INTERVAL '1 day'
  );

COMMENT ON TABLE user_feedback IS 'Stores all user feedback on agent suggestions for learning';
COMMENT ON TABLE behavior_patterns IS 'Learned behavior patterns for each user';
COMMENT ON TABLE ml_model_versions IS 'Version control for ML models';
COMMENT ON TABLE model_performance_log IS 'Tracks model performance over time for drift detection';
COMMENT ON TABLE retraining_jobs IS 'History of model retraining jobs';
COMMENT ON TABLE behavior_scores IS 'Cached behavior predictions for fast retrieval';
