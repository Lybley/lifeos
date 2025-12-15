/**
 * Planner Engine API Routes
 * Endpoints for intelligent task scheduling and planning
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { plannerEngine } from '../services/planner/PlannerEngine';
import { autoScheduler } from '../services/planner/AutoScheduler';
import {
  PlannerRequest,
  Task,
  CalendarEvent,
  EnergyProfile,
  ScheduledBlock,
} from '../services/planner/plannerModels';
import logger from '../utils/logger';
import { mongoClient } from '../config/mongodb';

const router = Router();

/**
 * POST /api/v1/planner/generate
 * Generate daily or weekly plan
 */
router.post(
  '/generate',
  [
    body('userId').isString().notEmpty().withMessage('userId is required'),
    body('horizon').isIn(['daily', 'weekly']).withMessage('horizon must be daily or weekly'),
    body('date').optional().isISO8601().withMessage('date must be valid ISO date'),
    body('constraints').optional().isObject(),
    body('preferences').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const plannerRequest: PlannerRequest = {
        userId: req.body.userId,
        horizon: req.body.horizon,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        constraints: req.body.constraints,
        preferences: req.body.preferences,
      };

      logger.info('Generating plan', {
        userId: plannerRequest.userId,
        horizon: plannerRequest.horizon,
      });

      // Fetch user's tasks, events, and energy profile from database
      const [tasks, events, energyProfile] = await Promise.all([
        fetchUserTasks(plannerRequest.userId),
        fetchUserEvents(plannerRequest.userId),
        fetchEnergyProfile(plannerRequest.userId),
      ]);

      if (tasks.length === 0) {
        return res.json({
          message: 'No pending tasks to schedule',
          plan: null,
        });
      }

      // Generate plan
      const plan = await plannerEngine.generatePlan(
        plannerRequest,
        tasks,
        events,
        energyProfile
      );

      logger.info('Plan generated successfully', {
        userId: plannerRequest.userId,
        tasksScheduled: plan.totalTasksScheduled,
        confidence: plan.confidence,
      });

      res.json(plan);
    } catch (error) {
      logger.error('Plan generation error:', error);
      res.status(500).json({
        error: 'Plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/planner/candidates/:taskId
 * Get scheduling candidates for a specific task
 */
router.get(
  '/candidates/:taskId',
  [
    param('taskId').isString().notEmpty(),
    query('numCandidates').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const taskId = req.params.taskId;
      const numCandidates = req.query.numCandidates
        ? parseInt(req.query.numCandidates as string)
        : 3;

      // Fetch task
      const task = await fetchTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Fetch user's events and energy profile
      const [events, energyProfile] = await Promise.all([
        fetchUserEvents(task.userId),
        fetchEnergyProfile(task.userId),
      ]);

      // Create scheduling candidates
      const candidates = await autoScheduler.createCandidates(
        task,
        events,
        energyProfile,
        numCandidates
      );

      res.json({
        taskId,
        candidates,
      });
    } catch (error) {
      logger.error('Candidates generation error:', error);
      res.status(500).json({
        error: 'Failed to generate candidates',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/planner/approve/:requestId
 * Approve or reject a scheduling request
 */
router.post(
  '/approve/:requestId',
  [
    param('requestId').isUUID().withMessage('requestId must be a valid UUID'),
    body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
    body('selectedCandidateId').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const requestId = req.params.requestId;
      const action = req.body.action;
      const selectedCandidateId = req.body.selectedCandidateId;

      // In a real implementation, fetch the approval request from database
      // For now, return a success response
      logger.info('Approval action received', { requestId, action });

      if (action === 'approve') {
        // Update task status, create calendar event, etc.
        res.json({
          message: 'Schedule approved successfully',
          requestId,
          status: 'approved',
        });
      } else {
        res.json({
          message: 'Schedule rejected',
          requestId,
          status: 'rejected',
        });
      }
    } catch (error) {
      logger.error('Approval action error:', error);
      res.status(500).json({
        error: 'Approval action failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/planner/reschedule/:taskId
 * Reschedule a task
 */
router.post(
  '/reschedule/:taskId',
  [
    param('taskId').isString().notEmpty(),
    body('reason')
      .isIn(['conflict', 'overload', 'low_energy', 'urgent_task', 'manual'])
      .withMessage('Invalid reschedule reason'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const taskId = req.params.taskId;
      const reason = req.body.reason;

      // Fetch task and current schedule
      const task = await fetchTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Fetch user data
      const [events, energyProfile, allBlocks] = await Promise.all([
        fetchUserEvents(task.userId),
        fetchEnergyProfile(task.userId),
        fetchUserScheduledBlocks(task.userId),
      ]);

      const currentBlock = allBlocks.find(b => b.taskId === taskId);
      if (!currentBlock) {
        return res.status(404).json({ error: 'Task not currently scheduled' });
      }

      // Generate rescheduling candidates
      const candidates = await autoScheduler.reschedule(
        task,
        reason,
        currentBlock,
        allBlocks,
        events,
        energyProfile
      );

      res.json({
        taskId,
        reason,
        candidates,
      });
    } catch (error) {
      logger.error('Reschedule error:', error);
      res.status(500).json({
        error: 'Rescheduling failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/planner/conflicts
 * Check for scheduling conflicts
 */
router.get(
  '/conflicts',
  [query('userId').isString().notEmpty().withMessage('userId is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const userId = req.query.userId as string;

      // Fetch user's scheduled blocks, tasks, events
      const [blocks, tasks, events, energyProfile] = await Promise.all([
        fetchUserScheduledBlocks(userId),
        fetchUserTasks(userId),
        fetchUserEvents(userId),
        fetchEnergyProfile(userId),
      ]);

      // Resolve conflicts
      const result = await autoScheduler.resolveConflicts(
        blocks,
        tasks,
        events,
        energyProfile
      );

      res.json({
        userId,
        hasConflicts: result.rescheduledTasks.length > 0,
        resolvedBlocks: result.resolvedBlocks,
        rescheduledTasks: result.rescheduledTasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
        })),
      });
    } catch (error) {
      logger.error('Conflict resolution error:', error);
      res.status(500).json({
        error: 'Conflict resolution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/planner/health
 * Health check for planner service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'planner-engine',
    version: '1.0.0',
  });
});

// ============================================================================
// HELPER FUNCTIONS - Database Queries
// ============================================================================

/**
 * Fetch user's pending tasks from database
 */
async function fetchUserTasks(userId: string): Promise<Task[]> {
  try {
    const db = mongoClient.db();
    const tasks = await db.collection('planner_tasks')
      .find({ user_id: userId, status: { $in: ['pending', 'scheduled'] } })
      .sort({ priority: -1, due_date: 1 })
      .toArray();

    return tasks.map(task => ({
      id: task.id,
      userId: task.user_id,
      title: task.title,
      description: task.description,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      estimatedDuration: task.estimated_duration || 60,
      priority: task.priority || 'medium',
      category: task.category || 'other',
      tags: task.tags || [],
      project: task.project,
      requiresFocus: task.requires_focus || false,
      requiresEnergy: task.requires_energy || 'medium',
      canSplit: task.can_split || false,
      minSessionDuration: task.min_session_duration,
      dependsOn: task.depends_on,
      blockedBy: task.blocked_by,
      status: task.status,
      completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at || task.created_at),
    }));
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Fetch single task by ID
 */
async function fetchTask(taskId: string): Promise<Task | null> {
  try {
    const result = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      estimatedDuration: row.estimated_duration || 60,
      priority: row.priority || 'medium',
      category: row.category || 'other',
      tags: row.tags || [],
      project: row.project,
      requiresFocus: row.requires_focus || false,
      requiresEnergy: row.requires_energy || 'medium',
      canSplit: row.can_split || false,
      minSessionDuration: row.min_session_duration,
      dependsOn: row.depends_on,
      blockedBy: row.blocked_by,
      status: row.status,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    logger.error('Error fetching task:', error);
    return null;
  }
}

/**
 * Fetch user's calendar events
 */
async function fetchUserEvents(userId: string): Promise<CalendarEvent[]> {
  try {
    const result = await db.query(
      `SELECT * FROM calendar_events 
       WHERE user_id = $1 AND start_time >= NOW()
       ORDER BY start_time ASC
       LIMIT 100`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      isAllDay: row.is_all_day || false,
      timezone: row.timezone || 'UTC',
      type: row.type || 'other',
      isRecurring: row.is_recurring || false,
      recurrenceRule: row.recurrence_rule,
      isMovable: row.is_movable || false,
      minNotice: row.min_notice || 24,
      attendees: row.attendees,
      organizer: row.organizer,
      status: row.status || 'confirmed',
      source: row.source || 'manual',
      externalId: row.external_id,
    }));
  } catch (error) {
    logger.error('Error fetching events:', error);
    return [];
  }
}

/**
 * Fetch user's energy profile
 */
async function fetchEnergyProfile(userId: string): Promise<EnergyProfile> {
  // In a real implementation, fetch from database
  // For now, return a default profile
  return {
    userId,
    hourlyPattern: {
      monday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : i >= 14 && i <= 16 ? 0.7 : 0.6)),
      tuesday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : i >= 14 && i <= 16 ? 0.7 : 0.6)),
      wednesday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : i >= 14 && i <= 16 ? 0.7 : 0.6)),
      thursday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : i >= 14 && i <= 16 ? 0.7 : 0.6)),
      friday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : i >= 14 && i <= 16 ? 0.7 : 0.6)),
      saturday: Array(24).fill(0.5),
      sunday: Array(24).fill(0.5),
    },
    peakFocusWindows: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', energy: 0.9, focusQuality: 0.9 },
      { dayOfWeek: 2, startTime: '09:00', endTime: '11:00', energy: 0.9, focusQuality: 0.9 },
    ],
    preferredWorkHours: {
      start: '09:00',
      end: '17:00',
    },
    typicalSleepTime: '23:00',
    typicalWakeTime: '07:00',
    preferredBreakDuration: 15,
    breakFrequency: 90,
    deepWorkCapacity: 4,
    maxMeetingsPerDay: 5,
    lastUpdated: new Date(),
    confidence: 0.7,
  };
}

/**
 * Fetch user's scheduled blocks
 */
async function fetchUserScheduledBlocks(userId: string): Promise<ScheduledBlock[]> {
  // In a real implementation, fetch from a scheduled_blocks table
  // For now, return empty array
  return [];
}

export default router;
