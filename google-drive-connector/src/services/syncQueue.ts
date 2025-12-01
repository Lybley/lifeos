/**
 * Sync Queue Service using BullMQ
 */

import { Queue, Worker, Job } from 'bullmq';
import { DriveClient } from './driveClient';
import { processBatch } from './fileProcessor';
import logger from '../utils/logger';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const QUEUE_NAME = 'google-drive-sync';

export const driveQueue = new Queue(QUEUE_NAME, { connection });

interface DriveSyncJobData {
  userId: string;
  isInitialSync?: boolean;
  monthsBack?: number;
}

/**
 * Queue a Drive sync job
 */
export async function queueDriveSync(
  userId: string,
  options: { isInitialSync?: boolean; monthsBack?: number } = {}
): Promise<string> {
  const job = await driveQueue.add(
    'sync-drive',
    {
      userId,
      isInitialSync: options.isInitialSync || false,
      monthsBack: options.monthsBack || 6,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  logger.info(`Queued Drive sync job ${job.id} for user ${userId}`);
  return job.id!;
}

/**
 * Process Drive sync job
 */
async function processDriveSync(job: Job<DriveSyncJobData>): Promise<void> {
  const { userId, isInitialSync, monthsBack } = job.data;

  logger.info(`Processing Drive sync for user ${userId} (initial: ${isInitialSync})`);

  try {
    const driveClient = new DriveClient(userId);

    let startDate = new Date();
    if (isInitialSync && monthsBack) {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
    } else {
      // For incremental sync, get files modified in last 7 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    }

    await job.updateProgress(10);

    logger.info(`Fetching Drive files from ${startDate.toISOString()}`);
    const files = await driveClient.getFilesInDateRange(startDate);

    logger.info(`Found ${files.length} files to process`);
    await job.updateProgress(30);

    // Process files in batches
    const batchSize = 10;
    let processedCount = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const result = await processBatch(userId, batch);

      processedCount += result.processed;
      const progress = 30 + Math.floor((processedCount / files.length) * 60);
      await job.updateProgress(progress);

      logger.info(
        `Batch processed: ${result.processed} succeeded, ${result.failed} failed`
      );
    }

    await job.updateProgress(100);

    logger.info(
      `Drive sync complete for user ${userId}. Processed ${processedCount}/${files.length} files`
    );
  } catch (error) {
    logger.error(`Drive sync failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Start the worker
 */
export function startDriveWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processDriveSync, {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    limiter: {
      max: 10,
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
  });

  logger.info('Drive sync worker started');

  return worker;
}
