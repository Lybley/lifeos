import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables FIRST before importing any config files
dotenv.config();

import { postgresClient } from './config/postgres';
import { neo4jDriver } from './config/neo4j';
import { pineconeClient } from './config/pinecone';
import { queueConnection } from './config/queue';
import { initializeWebSocket } from './config/websocket';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { PermissionService } from './permissions/PermissionService';
import apiRoutes from './routes';
// Worker will be initialized conditionally
let actionWorker: any = null;

const app: Application = express();
const PORT = process.env.PORT || 8000;
const httpServer = createServer(app);

// Initialize services
const permissionService = new PermissionService(postgresClient);
app.set('permissionService', permissionService);

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
  // Test PostgreSQL connection (optional)
  try {
    await postgresClient.query('SELECT NOW()');
    logger.info('PostgreSQL connected successfully');
  } catch (pgError) {
    logger.warn('PostgreSQL not available, some features will be limited:', pgError);
  }

  // Test Neo4j connection (optional)
  try {
    const neo4jSession = neo4jDriver.session();
    await neo4jSession.run('RETURN 1 AS test');
    await neo4jSession.close();
    logger.info('Neo4j connected successfully');
  } catch (neoError) {
    logger.warn('Neo4j not available, graph features will be limited');
  }

  // Test Redis connection (optional for WebSocket)
  try {
    await queueConnection.ping();
    logger.info('Redis connected successfully');
  } catch (redisError) {
    logger.warn('Redis not available, background jobs will be limited');
  }
};

// Start server
const startServer = async () => {
  try {
    await initializeDatabases();
    
    // Initialize action worker if Redis is available
    try {
      const { actionWorker: worker } = await import('./services/actionEngine/worker');
      actionWorker = worker;
      logger.info('Action Engine worker initialized');
    } catch (workerError) {
      logger.warn('Action worker not initialized (Redis may not be available)');
    }
    
    // Initialize Google sync worker if Redis is available
    try {
      const { googleSyncWorker } = await import('./services/ingestion/googleDataWorker');
      logger.info('Google Data Ingestion worker initialized');
    } catch (workerError) {
      logger.warn('Google sync worker not initialized (Redis may not be available)');
    }
    
    // Initialize WebSocket server
    initializeWebSocket(httpServer);
    
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`WebSocket server enabled`);
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
  
  try {
    if (actionWorker) {
      await actionWorker.close();
    }
    await postgresClient.end();
    await neo4jDriver.close();
    await queueConnection.close();
  } catch (err) {
    logger.warn('Error during shutdown:', err);
  }
  
  process.exit(0);
});

export default app;
