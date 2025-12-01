import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../utils/logger';

// PostgreSQL
export const postgresClient = new Pool({
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

// Pinecone
let pineconeClient: Pinecone | null = null;

if (process.env.PINECONE_API_KEY) {
  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  logger.info('Pinecone client initialized');
} else {
  logger.warn('PINECONE_API_KEY not provided');
}

export { pineconeClient };
