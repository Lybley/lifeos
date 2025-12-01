/**
 * Background Worker for Gmail Sync
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { GmailClient } from './services/gmailClient';
import { processBatch } from './services/messageProcessor';
import { SyncJobData } from './services/syncQueue';
import { postgresClient } from './config/databases';
import logger from './utils/logger';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

/**
 * Update sync status in PostgreSQL
 */
async function updateSyncStatus(
  userId: string,
  status: string,
  metadata?: any
): Promise<void> {
  const query = `
    INSERT INTO sync_status (
      id, user_id, integration_type, last_sync_at,
      last_successful_sync_at, is_enabled, error_count,
      last_error, created_at, updated_at, metadata
    ) VALUES ($1, $2, $3, NOW(), $4, true, $5, $6, NOW(), NOW(), $7)
    ON CONFLICT (user_id, integration_type)
    DO UPDATE SET
      last_sync_at = NOW(),
      last_successful_sync_at = CASE WHEN $8 = 'completed' THEN NOW() ELSE sync_status.last_successful_sync_at END,
      error_count = CASE WHEN $8 = 'failed' THEN sync_status.error_count + 1 ELSE 0 END,
      last_error = $6,
      updated_at = NOW(),
      metadata = $7
  `;

  const errorCount = status === 'failed' ? 1 : 0;
  const lastSuccessful = status === 'completed' ? new Date() : null;

  await postgresClient.query(query, [
    uuidv4(),
    userId,
    'gmail',
    lastSuccessful,
    errorCount,
    status === 'failed' ? metadata?.error : null,
    JSON.stringify(metadata || {}),
    status,
  ]);
}

/**
 * Process email sync job
 */
async function processEmailSync(job: Job<SyncJobData>): Promise<void> {
  const { userId, isInitialSync, monthsBack, startDate, endDate } = job.data;

  logger.info(`Starting email sync for user ${userId}`);

  try {
    // Initialize Gmail client
    const gmailClient = new GmailClient(userId);

    // Calculate date range
    let syncStartDate: Date;
    let syncEndDate: Date;

    if (startDate && endDate) {
      syncStartDate = new Date(startDate);
      syncEndDate = new Date(endDate);
    } else if (isInitialSync) {
      // Initial sync: go back N months
      syncEndDate = new Date();
      syncStartDate = new Date();
      syncStartDate.setMonth(syncStartDate.getMonth() - (monthsBack || 6));
    } else {
      // Incremental sync: get messages since last sync
      const lastSyncQuery = `
        SELECT last_successful_sync_at
        FROM sync_status
        WHERE user_id = $1 AND integration_type = 'gmail'
        ORDER BY last_successful_sync_at DESC
        LIMIT 1
      `;

      const result = await postgresClient.query(lastSyncQuery, [userId]);

      if (result.rows.length > 0 && result.rows[0].last_successful_sync_at) {
        syncStartDate = new Date(result.rows[0].last_successful_sync_at);
      } else {
        // Fallback: go back 1 month
        syncStartDate = new Date();
        syncStartDate.setMonth(syncStartDate.getMonth() - 1);
      }

      syncEndDate = new Date();
    }

    logger.info(
      `Syncing emails from ${syncStartDate.toISOString()} to ${syncEndDate.toISOString()}`
    );

    // Fetch messages
    const messages = await gmailClient.getMessagesInDateRange(
      syncStartDate,
      syncEndDate
    );

    logger.info(`Fetched ${messages.length} messages from Gmail`);

    if (messages.length === 0) {
      logger.info('No new messages to sync');
      await updateSyncStatus(userId, 'completed', {
        messages_synced: 0,
        sync_type: isInitialSync ? 'initial' : 'incremental',
      });
      return;
    }

    // Process in batches
    const batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '100');
    let totalProcessed = 0;
    let totalFailed = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      logger.info(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          messages.length / batchSize
        )}`
      );

      const result = await processBatch(userId, batch);

      totalProcessed += result.processed;
      totalFailed += result.failed;

      // Update job progress
      const progress = Math.floor(((i + batch.length) / messages.length) * 100);
      await job.updateProgress({
        progress,
        processed: totalProcessed,
        failed: totalFailed,
        total: messages.length,
      });

      logger.info(
        `Batch complete: ${result.processed} processed, ${result.failed} failed`
      );
    }

    logger.info(
      `Email sync complete for user ${userId}: ${totalProcessed} processed, ${totalFailed} failed`
    );

    // Update sync status
    await updateSyncStatus(userId, 'completed', {
      messages_synced: totalProcessed,
      messages_failed: totalFailed,
      sync_type: isInitialSync ? 'initial' : 'incremental',
      date_range: {
        start: syncStartDate.toISOString(),
        end: syncEndDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Email sync failed for user ${userId}:`, error);

    await updateSyncStatus(userId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sync_type: isInitialSync ? 'initial' : 'incremental',
    });

    throw error;
  }
}

// Create worker
const worker = new Worker('gmail-sync', processEmailSync, {
  connection,
  concurrency: 2, // Process 2 users concurrently
  limiter: {
    max: 5, // Max 5 jobs per minute
    duration: 60000,
  },
});

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  logger.error('Worker error:', err);
});

logger.info('Gmail sync worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker');
  await worker.close();
  await connection.quit();
  await postgresClient.end();
  process.exit(0);
});
