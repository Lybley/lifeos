import { Pool } from 'pg';
import logger from '../utils/logger';

const postgresClient = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'lifeos',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

postgresClient.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error:', err);
});

export { postgresClient };
