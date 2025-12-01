import { Router, Request, Response } from 'express';
import { defaultQueue } from '../config/queue';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Add a job to the queue
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { name, data, options } = req.body;
  
  if (!name) {
    throw new AppError('Job name is required', 400);
  }
  
  try {
    const job = await defaultQueue.add(name, data || {}, options || {});
    
    res.status(201).json({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
    });
  } catch (error) {
    logger.error('Error adding job to queue:', error);
    throw new AppError('Failed to add job', 500);
  }
});

// Get job status
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const job = await defaultQueue.getJob(id);
    
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    
    const state = await job.getState();
    
    res.json({
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress,
      returnvalue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching job:', error);
    throw new AppError('Failed to fetch job', 500);
  }
});

// Get queue stats
router.get('/stats/overview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      defaultQueue.getWaitingCount(),
      defaultQueue.getActiveCount(),
      defaultQueue.getCompletedCount(),
      defaultQueue.getFailedCount(),
    ]);
    
    res.json({
      waiting,
      active,
      completed,
      failed,
    });
  } catch (error) {
    logger.error('Error fetching queue stats:', error);
    throw new AppError('Failed to fetch queue stats', 500);
  }
});

export default router;
