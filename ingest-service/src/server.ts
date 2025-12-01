import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import 'express-async-errors';
import dotenv from 'dotenv';
import { postgresClient } from './config/postgres';
import { neo4jDriver } from './config/neo4j';
import { pineconeClient } from './config/pinecone';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import ingestRoutes from './routes/ingest';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ingest-service'
  });
});

// Routes
app.use('/ingest', ingestRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Initialize databases
const initializeDatabases = async () => {
  try {
    // Test PostgreSQL connection
    await postgresClient.query('SELECT NOW()');
    logger.info('PostgreSQL connected successfully');

    // Test Neo4j connection
    const session = neo4jDriver.session();
    await session.run('RETURN 1');
    await session.close();
    logger.info('Neo4j connected successfully');

    // Test Pinecone connection
    if (pineconeClient) {
      logger.info('Pinecone client initialized');
    }
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Start server
const startServer = async () => {
  try {
    await initializeDatabases();
    
    app.listen(PORT, () => {
      logger.info(`Ingest service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await postgresClient.end();
  await neo4jDriver.close();
  process.exit(0);
});

export default app;
