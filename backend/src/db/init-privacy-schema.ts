import { postgresClient } from '../config/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';

async function initPrivacySchema() {
  try {
    const schemaPath = join(__dirname, 'schema', 'privacy.sql');
    const sql = readFileSync(schemaPath, 'utf8');
    
    await postgresClient.query(sql);
    logger.info('✅ Privacy schema initialized successfully');
    
    // Verify tables were created
    const result = await postgresClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'user_encryption_settings',
        'encrypted_data',
        'user_consents',
        'user_deletion_requests',
        'privacy_audit_logs',
        'key_rotation_history',
        'recovery_codes'
      )
      ORDER BY table_name
    `);
    
    logger.info('Created tables:', result.rows.map(r => r.table_name));
    
    await postgresClient.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Privacy schema initialization failed:', error);
    process.exit(1);
  }
}

initPrivacySchema();
