import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('connect', () => {
  logger.info('Redis connected for queue');
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

// Define queue
const defaultQueue = new Queue('default', { connection });

export { connection as queueConnection, defaultQueue };
