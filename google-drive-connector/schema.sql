-- Google Drive Files Metadata Table
CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  drive_file_id VARCHAR(255) NOT NULL,
  pmg_document_id VARCHAR(255),
  file_name TEXT NOT NULL,
  mime_type VARCHAR(255),
  file_size BIGINT,
  web_view_link TEXT,
  created_time TIMESTAMP,
  modified_time TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_files_user_id ON drive_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_drive_file_id ON drive_files(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_synced_at ON drive_files(synced_at);
