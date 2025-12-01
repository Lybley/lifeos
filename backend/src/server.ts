import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';
import dotenv from 'dotenv';
import { postgresClient } from './config/postgres';
import { neo4jDriver } from './config/neo4j';
import { pineconeClient } from './config/pinecone';
import { queueConnection } from './config/queue';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import apiRoutes from './routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Database initialization
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

    // Test Pinecone connection (if API key is provided)
    if (process.env.PINECONE_API_KEY) {
      // Pinecone client will be initialized in the config
      logger.info('Pinecone client initialized');
    }

    // Test Redis connection
    await queueConnection.client.ping();
    logger.info('Redis connected successfully');

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
      logger.info(`Server running on port ${PORT}`);
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
  await queueConnection.close();
  process.exit(0);
});

export default app;
