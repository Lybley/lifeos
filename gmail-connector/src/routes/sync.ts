/**
 * Sync Management Routes
 */

import { Router, Request, Response } from 'express';
import {
  queueEmailSync,
  getSyncStatus,
  getQueueStats,
} from '../services/syncQueue';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /sync/start
 * Manually trigger email sync
 */
router.post('/start', async (req: Request, res: Response) => {
  const { userId, isInitialSync, monthsBack } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const jobId = await queueEmailSync(userId, {
      isInitialSync: isInitialSync || false,
      monthsBack: monthsBack || 6,
    });

    logger.info(`Manual sync started for user ${userId}, job ${jobId}`);

    res.json({
      success: true,
      jobId,
      message: 'Email sync started',
    });
  } catch (error) {
    logger.error('Failed to start sync:', error);
    res.status(500).json({
      error: 'Failed to start sync',
    });
  }
});

/**
 * GET /sync/status/:jobId
 * Get sync job status
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const status = await getSyncStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
    });
  }
});

/**
 * GET /sync/stats
 * Get queue statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    res.status(500).json({
      error: 'Failed to get queue stats',
    });
  }
});

export default router;
