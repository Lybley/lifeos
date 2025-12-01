-- Task Extraction Tables

-- Table for temporary task extractions (before user confirmation)
CREATE TABLE IF NOT EXISTS task_extractions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_type VARCHAR(50),
  tasks JSONB NOT NULL,
  input_metadata JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  INDEX idx_task_extractions_user (user_id),
  INDEX idx_task_extractions_status (status),
  INDEX idx_task_extractions_created (created_at)
);

-- Table for persisted tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  task_text TEXT NOT NULL,
  due_date DATE,
  assignee VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  confidence FLOAT,
  source_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  INDEX idx_tasks_user (user_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_assignee (assignee),
  INDEX idx_tasks_due_date (due_date),
  INDEX idx_tasks_source (source_id)
);

-- Neo4j Schema (Cypher)
-- Run these in Neo4j console:

-- Create Task node constraint
-- CREATE CONSTRAINT task_id_unique IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE;

-- Create indexes
-- CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status);
-- CREATE INDEX task_assignee IF NOT EXISTS FOR (t:Task) ON (t.assignee);
-- CREATE INDEX task_due_date IF NOT EXISTS FOR (t:Task) ON (t.due_date);
