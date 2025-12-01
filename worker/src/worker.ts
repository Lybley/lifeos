import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { processDefaultJob } from './processors/defaultProcessor';
import { processDataSync } from './processors/dataSyncProcessor';
import { processVectorUpdate } from './processors/vectorProcessor';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('connect', () => {
  logger.info('Worker connected to Redis');
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

// Job processor routing
const processJob = async (job: Job) => {
  logger.info(`Processing job: ${job.name} [${job.id}]`);
  
  try {
    switch (job.name) {
      case 'data-sync':
        return await processDataSync(job);
      
      case 'vector-update':
        return await processVectorUpdate(job);
      
      default:
        return await processDefaultJob(job);
    }
  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);
    throw error;
  }
};

// Create worker
const worker = new Worker('default', processJob, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  logger.error('Worker error:', err);
});

logger.info('Worker started and waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker gracefully');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

export default worker;
