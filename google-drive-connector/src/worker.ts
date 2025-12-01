/**
 * Background Worker for Drive Sync
 */

import dotenv from 'dotenv';
import { startDriveWorker } from './services/syncQueue';
import logger from './utils/logger';

dotenv.config();

logger.info('Starting Google Drive sync worker...');

const worker = startDriveWorker();

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
