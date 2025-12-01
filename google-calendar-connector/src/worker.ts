/**
 * Background Worker for Calendar Sync
 */

import dotenv from 'dotenv';
import { startCalendarWorker } from './services/syncQueue';
import logger from './utils/logger';

dotenv.config();

logger.info('Starting Google Calendar sync worker...');

const worker = startCalendarWorker();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});
