import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import logger from '../utils/logger';

// PostgreSQL
export const postgresClient = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lifeos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

postgresClient.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error:', err);
});

// Neo4j
export const neo4jDriver: Driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2000,
  }
);

neo4jDriver.verifyConnectivity()
  .then(() => logger.info('Neo4j connected'))
  .catch((error) => logger.error('Neo4j connection failed:', error));
