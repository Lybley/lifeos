-- Planner Engine Tables

-- ============================================================================
-- TASKS TABLE (Enhanced for Planner)
-- ============================================================================

-- Drop existing basic tasks table if it exists
DROP TABLE IF EXISTS tasks CASCADE;

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Basic info
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Scheduling properties
  due_date TIMESTAMP,
  estimated_duration INTEGER DEFAULT 60, -- minutes
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  
  -- Context
  category VARCHAR(50) DEFAULT 'other', -- work, personal, health, learning, social, other
  tags TEXT[], -- array of tags
  project VARCHAR(255),
  
  -- Requirements
  requires_focus BOOLEAN DEFAULT false,
  requires_energy VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  can_split BOOLEAN DEFAULT false,
  min_session_duration INTEGER, -- minutes
  
  -- Dependencies
  depends_on TEXT[], -- array of task IDs
  blocked_by TEXT[], -- array of task IDs
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
  completed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- ============================================================================
-- CALENDAR EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Basic info
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Time
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Type
  type VARCHAR(50) DEFAULT 'other', -- meeting, appointment, deadline, personal, other
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  
  -- Flexibility
  is_movable BOOLEAN DEFAULT false,
  min_notice INTEGER DEFAULT 24, -- hours
  
  -- Participants
  attendees TEXT[],
  organizer VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, tentative, cancelled
  
  -- Source
  source VARCHAR(50) DEFAULT 'manual', -- google_calendar, outlook, manual, generated
  external_id VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);

-- ============================================================================
-- ENERGY PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS energy_profiles (
  user_id VARCHAR(255) PRIMARY KEY,
  
  -- Daily patterns (stored as JSONB)
  hourly_pattern JSONB NOT NULL DEFAULT '{
    "monday": [],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  }',
  
  -- Peak windows (stored as JSONB array)
  peak_focus_windows JSONB DEFAULT '[]',
  
  -- Preferences
  preferred_work_start VARCHAR(5) DEFAULT '09:00',
  preferred_work_end VARCHAR(5) DEFAULT '17:00',
  typical_sleep_time VARCHAR(5) DEFAULT '23:00',
  typical_wake_time VARCHAR(5) DEFAULT '07:00',
  
  -- Breaks
  preferred_break_duration INTEGER DEFAULT 15, -- minutes
  break_frequency INTEGER DEFAULT 90, -- every X minutes
  
  -- Work style
  deep_work_capacity INTEGER DEFAULT 4, -- hours per day
  max_meetings_per_day INTEGER DEFAULT 5,
  
  -- Context
  last_updated TIMESTAMP DEFAULT NOW(),
  confidence FLOAT DEFAULT 0.5
);

-- ============================================================================
-- SCHEDULED BLOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Time
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  
  -- Content
  type VARCHAR(50) NOT NULL, -- task, meeting, break, buffer, focus_time
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Scoring
  confidence_score FLOAT DEFAULT 0.5,
  priority_score FLOAT DEFAULT 0.5,
  energy_match FLOAT DEFAULT 0.5,
  
  -- Rationale (stored as JSONB array)
  rationale JSONB DEFAULT '[]',
  
  -- Status
  status VARCHAR(20) DEFAULT 'proposed', -- proposed, confirmed, rejected
  is_flexible BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_user_id ON scheduled_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_start_time ON scheduled_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_task_id ON scheduled_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_event_id ON scheduled_blocks(event_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_status ON scheduled_blocks(status);

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert a test user energy profile
INSERT INTO energy_profiles (user_id, hourly_pattern, preferred_work_start, preferred_work_end)
VALUES (
  'test-user-1',
  '{
    "monday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
    "tuesday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
    "wednesday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
    "thursday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
    "friday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
    "saturday": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    "sunday": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  }',
  '09:00',
  '17:00'
) ON CONFLICT (user_id) DO NOTHING;

-- Insert sample tasks for testing
INSERT INTO tasks (id, user_id, title, description, due_date, estimated_duration, priority, category, requires_focus, requires_energy, status)
VALUES 
  (gen_random_uuid(), 'test-user-1', 'Complete project proposal', 'Write Q4 project proposal for client', NOW() + INTERVAL '2 days', 120, 'high', 'work', true, 'high', 'pending'),
  (gen_random_uuid(), 'test-user-1', 'Review team code', 'Code review for sprint 12', NOW() + INTERVAL '1 day', 60, 'medium', 'work', false, 'medium', 'pending'),
  (gen_random_uuid(), 'test-user-1', 'Gym workout', 'Evening cardio session', NOW() + INTERVAL '1 day', 60, 'low', 'health', false, 'medium', 'pending');

-- Insert sample calendar event
INSERT INTO calendar_events (id, user_id, title, start_time, end_time, type, is_movable, status, source)
VALUES 
  (gen_random_uuid(), 'test-user-1', 'Team standup', NOW() + INTERVAL '1 day' + INTERVAL '10 hours', NOW() + INTERVAL '1 day' + INTERVAL '10 hours 30 minutes', 'meeting', false, 'confirmed', 'manual');

COMMENT ON TABLE tasks IS 'Tasks for intelligent scheduling by the Planner Engine';
COMMENT ON TABLE calendar_events IS 'Calendar events and meetings for schedule planning';
COMMENT ON TABLE energy_profiles IS 'User energy patterns throughout the day for optimal scheduling';
COMMENT ON TABLE scheduled_blocks IS 'Scheduled time blocks generated by the Planner Engine';
