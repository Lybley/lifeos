/**
 * Data Ingestion API Routes
 * Endpoints for managing Google data sync jobs
 */

import { Router, Request, Response } from 'express';
import {
  scheduleGoogleSync,
  scheduleRecurringSync,
  cancelRecurringSync,
  googleSyncQueue,
} from '../services/ingestion/googleDataWorker';
import { requirePermission, AuthenticatedRequest } from '../permissions/PermissionMiddleware';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/ingestion/sync
 * Trigger a one-time sync for a Google service
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { user_id, service, sync_type } = req.body;
    
    if (!user_id || !service) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, service',
      });
    }
    
    if (!['gmail', 'drive', 'calendar'].includes(service)) {
      return res.status(400).json({
        error: 'Invalid service. Must be: gmail, drive, or calendar',
      });
    }
    
    await scheduleGoogleSync(
      user_id,
      service,
      sync_type || 'incremental'
    );
    
    res.json({
      success: true,
      message: `Sync job scheduled for ${service}`,
    });
    
  } catch (error) {
    logger.error('Failed to schedule sync', { error });
    res.status(500).json({
      error: 'Failed to schedule sync job',
    });
  }
});

/**
 * POST /api/v1/ingestion/recurring
 * Set up recurring sync for a user
 */
router.post('/recurring', async (req: Request, res: Response) => {
  try {
    const { user_id, services, interval_minutes } = req.body;
    
    if (!user_id || !services || !Array.isArray(services)) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, services (array)',
      });
    }
    
    await scheduleRecurringSync(
      user_id,
      services,
      interval_minutes || 60
    );
    
    res.json({
      success: true,
      message: `Recurring sync scheduled for ${services.join(', ')}`,
      interval_minutes: interval_minutes || 60,
    });
    
  } catch (error) {
    logger.error('Failed to schedule recurring sync', { error });
    res.status(500).json({
      error: 'Failed to schedule recurring sync',
    });
  }
});

/**
 * DELETE /api/v1/ingestion/recurring
 * Cancel recurring sync for a user
 */
router.delete('/recurring', async (req: Request, res: Response) => {
  try {
    const { user_id, services } = req.body;
    
    if (!user_id || !services || !Array.isArray(services)) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, services (array)',
      });
    }
    
    await cancelRecurringSync(user_id, services);
    
    res.json({
      success: true,
      message: `Recurring sync cancelled for ${services.join(', ')}`,
    });
    
  } catch (error) {
    logger.error('Failed to cancel recurring sync', { error });
    res.status(500).json({
      error: 'Failed to cancel recurring sync',
    });
  }
});

/**
 * GET /api/v1/ingestion/status
 * Get sync job status for a user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }
    
    // Get active jobs
    const activeJobs = await googleSyncQueue.getActive();
    const userActiveJobs = activeJobs.filter(job => job.data.userId === userId);
    
    // Get waiting jobs
    const waitingJobs = await googleSyncQueue.getWaiting();
    const userWaitingJobs = waitingJobs.filter(job => job.data.userId === userId);
    
    // Get recent completed jobs
    const completedJobs = await googleSyncQueue.getCompleted();
    const userCompletedJobs = completedJobs
      .filter(job => job.data.userId === userId)
      .slice(0, 10); // Last 10 completed jobs
    
    res.json({
      userId,
      active: userActiveJobs.length,
      waiting: userWaitingJobs.length,
      recentCompleted: userCompletedJobs.length,
      jobs: {
        active: userActiveJobs.map(j => ({
          id: j.id,
          service: j.data.service,
          syncType: j.data.syncType,
          progress: j.progress,
        })),
        waiting: userWaitingJobs.map(j => ({
          id: j.id,
          service: j.data.service,
          syncType: j.data.syncType,
        })),
      },
    });
    
  } catch (error) {
    logger.error('Failed to get sync status', { error });
    res.status(500).json({
      error: 'Failed to get sync status',
    });
  }
});

/**
 * GET /api/v1/ingestion/queue-stats
 * Get overall queue statistics
 */
router.get('/queue-stats', async (req: Request, res: Response) => {
  try {
    const counts = await googleSyncQueue.getJobCounts();
    
    res.json({
      queue: 'google-sync',
      stats: counts,
    });
    
  } catch (error) {
    logger.error('Failed to get queue stats', { error });
    res.status(500).json({
      error: 'Failed to get queue stats',
    });
  }
});

export default router;
