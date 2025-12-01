import neo4j, { Driver } from 'neo4j-driver';
import logger from '../utils/logger';

const neo4jDriver: Driver = neo4j.driver(
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

// Verify connectivity
neo4jDriver.verifyConnectivity()
  .then(() => logger.info('Neo4j driver created successfully'))
  .catch((error) => logger.error('Neo4j connectivity verification failed:', error));

export { neo4jDriver };
