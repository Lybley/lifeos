/**
 * Sync Queue Service
 * 
 * Manages background jobs for email synchronization
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('connect', () => {
  logger.info('Sync queue connected to Redis');
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

// Create queue
export const emailSyncQueue = new Queue('gmail-sync', { connection });

// Queue events for monitoring
const queueEvents = new QueueEvents('gmail-sync', { connection });

queueEvents.on('completed', ({ jobId }) => {
  logger.info(`Email sync job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Email sync job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  logger.info(`Email sync job ${jobId} progress:`, data);
});

export interface SyncJobData {
  userId: string;
  isInitialSync: boolean;
  monthsBack?: number;
  startDate?: string;
  endDate?: string;
  pageToken?: string;
}

/**
 * Queue email sync job
 */
export async function queueEmailSync(
  userId: string,
  options: Partial<SyncJobData> = {}
): Promise<string> {
  const jobData: SyncJobData = {
    userId,
    isInitialSync: options.isInitialSync || false,
    monthsBack: options.monthsBack || 6,
    startDate: options.startDate,
    endDate: options.endDate,
    pageToken: options.pageToken,
  };

  const job = await emailSyncQueue.add('sync-emails', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
    },
  });

  logger.info(`Queued email sync job ${job.id} for user ${userId}`);
  return job.id!;
}

/**
 * Get sync status
 */
export async function getSyncStatus(jobId: string) {
  const job = await emailSyncQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailSyncQueue.getWaitingCount(),
    emailSyncQueue.getActiveCount(),
    emailSyncQueue.getCompletedCount(),
    emailSyncQueue.getFailedCount(),
    emailSyncQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}
