/**
 * Sync Queue Service using BullMQ
 */

import { Queue, Worker, Job } from 'bullmq';
import { CalendarClient } from './calendarClient';
import { processBatch } from './eventProcessor';
import logger from '../utils/logger';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const QUEUE_NAME = 'google-calendar-sync';

export const calendarQueue = new Queue(QUEUE_NAME, { connection });

interface CalendarSyncJobData {
  userId: string;
  isInitialSync?: boolean;
  monthsBack?: number;
}

/**
 * Queue a Calendar sync job
 */
export async function queueCalendarSync(
  userId: string,
  options: { isInitialSync?: boolean; monthsBack?: number } = {}
): Promise<string> {
  const job = await calendarQueue.add(
    'sync-calendar',
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

  logger.info(`Queued Calendar sync job ${job.id} for user ${userId}`);
  return job.id!;
}

/**
 * Process Calendar sync job
 */
async function processCalendarSync(job: Job<CalendarSyncJobData>): Promise<void> {
  const { userId, isInitialSync, monthsBack } = job.data;

  logger.info(`Processing Calendar sync for user ${userId} (initial: ${isInitialSync})`);

  try {
    const calendarClient = new CalendarClient(userId);

    // Get all calendars
    await job.updateProgress(10);
    const calendars = await calendarClient.listCalendars();
    logger.info(`Found ${calendars.length} calendars`);

    // Determine date range
    let startDate = new Date();
    if (isInitialSync && monthsBack) {
      startDate.setMonth(startDate.getMonth() - monthsBack);
    } else {
      // For incremental sync, get events from last 7 days
      startDate.setDate(startDate.getDate() - 7);
    }

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6); // Also fetch future events

    await job.updateProgress(20);

    let totalProcessed = 0;
    let totalFailed = 0;

    // Process each calendar
    for (let i = 0; i < calendars.length; i++) {
      const calendar = calendars[i];
      const calendarId = calendar.id!;

      logger.info(`Fetching events from calendar: ${calendar.summary || calendarId}`);

      try {
        const events = await calendarClient.getAllEvents(
          calendarId,
          startDate,
          endDate
        );

        logger.info(`Found ${events.length} events in ${calendar.summary}`);

        // Process events in batches
        const batchSize = 20;
        for (let j = 0; j < events.length; j += batchSize) {
          const batch = events.slice(j, j + batchSize);
          const result = await processBatch(userId, batch);

          totalProcessed += result.processed;
          totalFailed += result.failed;
        }
      } catch (error) {
        logger.error(`Failed to sync calendar ${calendarId}:`, error);
      }

      const progress = 20 + Math.floor(((i + 1) / calendars.length) * 70);
      await job.updateProgress(progress);
    }

    await job.updateProgress(100);

    logger.info(
      `Calendar sync complete for user ${userId}. Processed ${totalProcessed} events, ${totalFailed} failed`
    );
  } catch (error) {
    logger.error(`Calendar sync failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Start the worker
 */
export function startCalendarWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processCalendarSync, {
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

  logger.info('Calendar sync worker started');

  return worker;
}
