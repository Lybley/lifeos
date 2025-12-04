-- Knowledge Expansion Layer Schema
-- For ingesting documents, extracting concepts, and building knowledge graphs

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document identification
  document_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- book, paper, article, note, etc.
  
  -- Source
  source_url TEXT,
  source_type VARCHAR(50), -- upload, url, api, etc.
  file_path TEXT,
  
  -- Metadata
  authors TEXT[],
  publication_date DATE,
  isbn VARCHAR(20),
  doi VARCHAR(100),
  tags TEXT[],
  language VARCHAR(10) DEFAULT 'en',
  
  -- Content
  content_text TEXT, -- Full text
  content_summary TEXT, -- AI-generated summary
  page_count INTEGER,
  word_count INTEGER,
  
  -- Processing status
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  extraction_status VARCHAR(50) DEFAULT 'pending',
  
  -- Processing results
  concepts_extracted INTEGER DEFAULT 0,
  relationships_extracted INTEGER DEFAULT 0,
  
  -- User/Organization
  user_id VARCHAR(255),
  organization_id VARCHAR(255),
  is_public BOOLEAN DEFAULT false,
  
  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_document_id ON knowledge_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user_id ON knowledge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_type ON knowledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tags ON knowledge_documents USING GIN(tags);

-- ============================================================================
-- CONCEPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Concept identification
  concept_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  concept_type VARCHAR(100), -- entity, process, principle, rule, pattern, etc.
  
  -- Definition
  definition TEXT NOT NULL,
  alternative_names TEXT[], -- Synonyms, aliases
  
  -- Context
  domain VARCHAR(100), -- physics, biology, business, etc.
  subdomain VARCHAR(100),
  abstraction_level VARCHAR(50), -- concrete, abstract, meta
  
  -- Relationships metadata
  parent_concepts TEXT[], -- More general concepts
  child_concepts TEXT[], -- More specific concepts
  related_concepts TEXT[], -- Related but not hierarchical
  
  -- Evidence
  source_documents TEXT[], -- Document IDs where this appears
  confidence_score FLOAT DEFAULT 0.5, -- 0-1, confidence in extraction
  occurrence_count INTEGER DEFAULT 1,
  
  -- Embeddings for semantic search
  embedding_vector VECTOR(1536), -- For OpenAI embeddings
  
  -- Properties
  properties JSONB DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  
  -- Validation
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concepts_concept_id ON concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);
CREATE INDEX IF NOT EXISTS idx_concepts_type ON concepts(concept_type);
CREATE INDEX IF NOT EXISTS idx_concepts_domain ON concepts(domain);
CREATE INDEX IF NOT EXISTS idx_concepts_confidence ON concepts(confidence_score);
-- Note: For vector similarity search, you'd use pgvector extension
-- CREATE INDEX IF NOT EXISTS idx_concepts_embedding ON concepts USING ivfflat (embedding_vector vector_cosine_ops);

-- ============================================================================
-- CONCEPT RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship
  from_concept_id VARCHAR(100) NOT NULL REFERENCES concepts(concept_id),
  to_concept_id VARCHAR(100) NOT NULL REFERENCES concepts(concept_id),
  relationship_type VARCHAR(100) NOT NULL,
  
  -- Relationship details
  strength FLOAT DEFAULT 1.0, -- 0-1, strength of relationship
  bidirectional BOOLEAN DEFAULT false,
  
  -- Context
  context TEXT,
  source_document_ids TEXT[],
  
  -- Properties
  properties JSONB DEFAULT '{}',
  
  -- Validation
  confidence FLOAT DEFAULT 0.5,
  verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_relationship UNIQUE(from_concept_id, to_concept_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_concept_relationships_from ON concept_relationships(from_concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_relationships_to ON concept_relationships(to_concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_relationships_type ON concept_relationships(relationship_type);

-- Common relationship types:
-- is_a, part_of, has_property, causes, requires, enables, conflicts_with, 
-- exemplifies, implements, derives_from, applies_to, etc.

-- ============================================================================
-- RULES & PRINCIPLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identification
  rule_id VARCHAR(100) UNIQUE NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50), -- principle, law, heuristic, best_practice, etc.
  
  -- Rule definition
  statement TEXT NOT NULL,
  conditions TEXT[],
  consequences TEXT[],
  exceptions TEXT[],
  
  -- Formalization
  formal_notation TEXT, -- Logical or mathematical notation
  
  -- Context
  domain VARCHAR(100),
  applicability TEXT,
  
  -- Related concepts
  related_concepts TEXT[],
  
  -- Evidence
  source_documents TEXT[],
  confidence FLOAT DEFAULT 0.5,
  
  -- Properties
  properties JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_rules_rule_id ON knowledge_rules(rule_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_rules_domain ON knowledge_rules(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_rules_type ON knowledge_rules(rule_type);

-- ============================================================================
-- PMG INTEGRATION (Concept to Memory Links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_memory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link between concept and personal memory
  concept_id VARCHAR(100) NOT NULL REFERENCES concepts(concept_id),
  memory_id VARCHAR(100) NOT NULL, -- Reference to PMG memory node
  
  -- Link details
  link_type VARCHAR(50), -- learned, applied, referenced, questioned
  relevance_score FLOAT DEFAULT 0.5,
  
  -- Context
  context TEXT,
  notes TEXT,
  
  -- User
  user_id VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concept_memory_links_concept ON concept_memory_links(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_memory_links_memory ON concept_memory_links(memory_id);
CREATE INDEX IF NOT EXISTS idx_concept_memory_links_user ON concept_memory_links(user_id);

-- ============================================================================
-- EXTRACTION JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  job_id VARCHAR(100) UNIQUE NOT NULL,
  document_id VARCHAR(100) NOT NULL REFERENCES knowledge_documents(document_id),
  
  -- Job details
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  extraction_type VARCHAR(50) DEFAULT 'full', -- full, incremental, targeted
  
  -- Configuration
  llm_model VARCHAR(100),
  prompt_version VARCHAR(20),
  extraction_config JSONB,
  
  -- Results
  concepts_found INTEGER DEFAULT 0,
  relationships_found INTEGER DEFAULT 0,
  rules_found INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_job_id ON concept_extraction_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_document ON concept_extraction_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON concept_extraction_jobs(status);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert sample document
INSERT INTO knowledge_documents (
  document_id, title, document_type, authors, content_summary, status
) VALUES (
  'doc-sample-001',
  'Introduction to Machine Learning',
  'book',
  ARRAY['John Doe', 'Jane Smith'],
  'A comprehensive introduction to machine learning concepts and algorithms',
  'completed'
);

-- Insert sample concepts
INSERT INTO concepts (concept_id, name, concept_type, definition, domain, confidence_score) VALUES
  (
    'concept-ml-001',
    'Supervised Learning',
    'process',
    'A type of machine learning where the model is trained on labeled data',
    'machine_learning',
    0.95
  ),
  (
    'concept-ml-002',
    'Neural Network',
    'entity',
    'A computational model inspired by biological neural networks',
    'machine_learning',
    0.98
  ),
  (
    'concept-ml-003',
    'Overfitting',
    'pattern',
    'A modeling error that occurs when a model learns the training data too well',
    'machine_learning',
    0.92
  );

-- Insert sample relationships
INSERT INTO concept_relationships (
  from_concept_id, to_concept_id, relationship_type, strength
) VALUES
  ('concept-ml-001', 'concept-ml-002', 'uses', 0.8),
  ('concept-ml-002', 'concept-ml-003', 'susceptible_to', 0.7);

-- Insert sample rule
INSERT INTO knowledge_rules (
  rule_id, rule_name, rule_type, statement, domain, related_concepts
) VALUES (
  'rule-ml-001',
  'Bias-Variance Tradeoff',
  'principle',
  'There is a tradeoff between a model''s ability to minimize bias and variance',
  'machine_learning',
  ARRAY['concept-ml-003']
);

COMMENT ON TABLE knowledge_documents IS 'Documents ingested for knowledge extraction';
COMMENT ON TABLE concepts IS 'Extracted concepts forming the knowledge graph';
COMMENT ON TABLE concept_relationships IS 'Relationships between concepts';
COMMENT ON TABLE knowledge_rules IS 'Rules, principles, and heuristics extracted from documents';
COMMENT ON TABLE concept_memory_links IS 'Links between concepts and personal memories in PMG';
COMMENT ON TABLE concept_extraction_jobs IS 'Background jobs for extracting knowledge from documents';
