import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import 'express-async-errors';
import dotenv from 'dotenv';
import { postgresClient, neo4jDriver } from './config/databases';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for OAuth state
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000, // 1 hour
    },
  })
);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gmail-connector',
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize
const init = async () => {
  try {
    await postgresClient.query('SELECT NOW()');
    logger.info('PostgreSQL connected');

    const session = neo4jDriver.session();
    await session.run('RETURN 1');
    await session.close();
    logger.info('Neo4j connected');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Start server
const start = async () => {
  try {
    await init();

    app.listen(PORT, () => {
      logger.info(`Gmail connector service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`OAuth redirect: ${process.env.GOOGLE_REDIRECT_URI}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

export default app;
