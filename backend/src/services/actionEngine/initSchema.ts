/**
 * Initialize Action Engine Database Schema
 * Run this script to create all necessary tables
 */

import { postgresClient } from '../../config/postgres';
import logger from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function initSchema() {
  try {
    logger.info('Initializing Action Engine schema...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schemas.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await postgresClient.query(schema);

    logger.info('Action Engine schema initialized successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize schema:', error);
    process.exit(1);
  }
}

initSchema();
