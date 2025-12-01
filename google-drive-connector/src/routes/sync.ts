/**
 * Sync Routes
 */

import { Router, Request, Response } from 'express';
import { queueDriveSync } from '../services/syncQueue';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /sync/start
 * Trigger manual sync
 */
router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const jobId = await queueDriveSync(userId, {
      isInitialSync: false,
    });

    logger.info(`Started Drive sync for user ${userId}, job ${jobId}`);

    res.json({
      success: true,
      message: 'Drive sync started',
      jobId,
    });
  } catch (error) {
    logger.error('Failed to start Drive sync:', error);
    res.status(500).json({
      error: 'Failed to start Drive sync',
    });
  }
});

/**
 * GET /sync/status/:jobId
 * Check sync job status
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const { driveQueue } = await import('../services/syncQueue');
    const job = await driveQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = await job.progress;

    res.json({
      jobId,
      state,
      progress,
      timestamp: job.timestamp,
    });
  } catch (error) {
    logger.error('Failed to get job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
    });
  }
});

export default router;
