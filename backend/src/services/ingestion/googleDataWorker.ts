/**
 * Google Data Ingestion Worker
 * 
 * Background worker that periodically syncs data from Google services
 * (Gmail, Drive, Calendar) and indexes them for RAG queries.
 */

import { Worker, Job, Queue } from 'bullmq';
import { queueConnection } from '../../config/queue';
import logger from '../../utils/logger';
import { postgresClient } from '../../config/postgres';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleSyncJob {
  userId: string;
  service: 'gmail' | 'drive' | 'calendar';
  syncType: 'full' | 'incremental';
  lastSyncTimestamp?: string;
}

export interface SyncResult {
  userId: string;
  service: string;
  itemsProcessed: number;
  itemsIndexed: number;
  errors: number;
  startTime: string;
  endTime: string;
  nextSyncToken?: string;
}

// ============================================================================
// QUEUES
// ============================================================================

let googleSyncQueue: Queue<GoogleSyncJob> | null = null;
let googleSyncWorker: Worker | null = null;

export function getGoogleSyncQueue() {
  if (!googleSyncQueue) {
    googleSyncQueue = new Queue<GoogleSyncJob>('google-sync', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs for debugging
        },
      },
    });
  }
  return googleSyncQueue;
}

// ============================================================================
// WORKER IMPLEMENTATION
// ============================================================================

/**
 * Process Gmail sync job
 */
async function processGmailSync(job: Job<GoogleSyncJob>): Promise<SyncResult> {
  const { userId, syncType, lastSyncTimestamp } = job.data;
  const startTime = new Date().toISOString();
  
  logger.info('Processing Gmail sync', { userId, syncType });
  
  try {
    // TODO: Implement Gmail connector integration
    // 1. Fetch emails from Gmail API using the connector
    // 2. Extract relevant data (subject, body, metadata)
    // 3. Generate embeddings
    // 4. Store in Pinecone for vector search
    // 5. Store metadata in PostgreSQL
    
    const result: SyncResult = {
      userId,
      service: 'gmail',
      itemsProcessed: 0,
      itemsIndexed: 0,
      errors: 0,
      startTime,
      endTime: new Date().toISOString(),
    };
    
    logger.info('Gmail sync completed', result);
    return result;
    
  } catch (error) {
    logger.error('Gmail sync failed', { error, userId });
    throw error;
  }
}

/**
 * Process Google Drive sync job
 */
async function processDriveSync(job: Job<GoogleSyncJob>): Promise<SyncResult> {
  const { userId, syncType, lastSyncTimestamp } = job.data;
  const startTime = new Date().toISOString();
  
  logger.info('Processing Drive sync', { userId, syncType });
  
  try {
    // TODO: Implement Drive connector integration
    // 1. Fetch files from Drive API using the connector
    // 2. Extract text from documents
    // 3. Generate embeddings for searchable content
    // 4. Store in Pinecone
    // 5. Store file metadata in PostgreSQL
    
    const result: SyncResult = {
      userId,
      service: 'drive',
      itemsProcessed: 0,
      itemsIndexed: 0,
      errors: 0,
      startTime,
      endTime: new Date().toISOString(),
    };
    
    logger.info('Drive sync completed', result);
    return result;
    
  } catch (error) {
    logger.error('Drive sync failed', { error, userId });
    throw error;
  }
}

/**
 * Process Google Calendar sync job
 */
async function processCalendarSync(job: Job<GoogleSyncJob>): Promise<SyncResult> {
  const { userId, syncType, lastSyncTimestamp } = job.data;
  const startTime = new Date().toISOString();
  
  logger.info('Processing Calendar sync', { userId, syncType });
  
  try {
    // TODO: Implement Calendar connector integration
    // 1. Fetch events from Calendar API using the connector
    // 2. Extract event details
    // 3. Generate embeddings for event descriptions
    // 4. Store in Pinecone
    // 5. Store event metadata in PostgreSQL
    
    const result: SyncResult = {
      userId,
      service: 'calendar',
      itemsProcessed: 0,
      itemsIndexed: 0,
      errors: 0,
      startTime,
      endTime: new Date().toISOString(),
    };
    
    logger.info('Calendar sync completed', result);
    return result;
    
  } catch (error) {
    logger.error('Calendar sync failed', { error, userId });
    throw error;
  }
}

/**
 * Main worker processor
 */
async function processGoogleSyncJob(job: Job<GoogleSyncJob>): Promise<SyncResult> {
  const { service } = job.data;
  
  logger.info(`Processing Google sync job for ${service}`, {
    jobId: job.id,
    attemptsMade: job.attemptsMade,
  });
  
  // Route to appropriate service handler
  switch (service) {
    case 'gmail':
      return await processGmailSync(job);
    case 'drive':
      return await processDriveSync(job);
    case 'calendar':
      return await processCalendarSync(job);
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

export function getGoogleSyncWorker() {
  if (!googleSyncWorker) {
    googleSyncWorker = new Worker<GoogleSyncJob, SyncResult>(
      'google-sync',
      processGoogleSyncJob,
      {
        connection: queueConnection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    // Worker event handlers
    googleSyncWorker.on('completed', (job, result) => {
      logger.info('Google sync job completed', {
        jobId: job.id,
        service: job.data.service,
        itemsIndexed: result.itemsIndexed,
      });
    });

    googleSyncWorker.on('failed', (job, error) => {
      logger.error('Google sync job failed', {
        jobId: job?.id,
        service: job?.data.service,
        error: error.message,
      });
    });

    // Worker error handler
    googleSyncWorker.on('error', (error) => {
      logger.error('Google sync worker error', { error: error.message });
    });
  }
  return googleSyncWorker;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Schedule a sync job for a user's Google service
 */
export async function scheduleGoogleSync(
  userId: string,
  service: 'gmail' | 'drive' | 'calendar',
  syncType: 'full' | 'incremental' = 'incremental',
  options?: {
    priority?: number;
    delay?: number;
  }
): Promise<void> {
  await getGoogleSyncQueue().add(
    `${service}-sync-${userId}`,
    {
      userId,
      service,
      syncType,
    },
    {
      priority: options?.priority,
      delay: options?.delay,
      jobId: `${service}-${userId}-${Date.now()}`,
    }
  );
  
  logger.info('Scheduled Google sync job', { userId, service, syncType });
}

/**
 * Schedule recurring sync for a user
 */
export async function scheduleRecurringSync(
  userId: string,
  services: ('gmail' | 'drive' | 'calendar')[],
  intervalMinutes: number = 60
): Promise<void> {
  for (const service of services) {
    await getGoogleSyncQueue().add(
      `${service}-sync-${userId}`,
      {
        userId,
        service,
        syncType: 'incremental',
      },
      {
        repeat: {
          every: intervalMinutes * 60 * 1000, // Convert to milliseconds
        },
        jobId: `recurring-${service}-${userId}`,
      }
    );
  }
  
  logger.info('Scheduled recurring sync', { userId, services, intervalMinutes });
}

/**
 * Cancel recurring sync for a user
 */
export async function cancelRecurringSync(
  userId: string,
  services: ('gmail' | 'drive' | 'calendar')[]
): Promise<void> {
  for (const service of services) {
    await getGoogleSyncQueue().removeRepeatable(`${service}-sync-${userId}`, {
      every: 60 * 60 * 1000, // Default interval
    });
  }
  
  logger.info('Cancelled recurring sync', { userId, services });
}

logger.info('Google Data Ingestion Worker initialized');
