/**
 * TaskExtractor API Routes
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { createTaskExtractorAgent } from '../services/agents/taskExtractorAgent';
import { TaskInput } from '../services/agents/taskExtractorPrompt';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/tasks/extract
 * Extract tasks from text
 */
router.post(
  '/extract',
  [
    body('user_id').isString().notEmpty().withMessage('user_id is required'),
    body('text').isString().notEmpty().withMessage('text is required'),
    body('metadata').isObject().withMessage('metadata must be an object'),
    body('metadata.source_id').isString().notEmpty().withMessage('metadata.source_id is required'),
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

      const { user_id, text, metadata } = req.body;

      const input: TaskInput = {
        text,
        metadata: {
          source_id: metadata.source_id,
          sender: metadata.sender,
          sender_email: metadata.sender_email,
          date: metadata.date,
          subject: metadata.subject,
          source_type: metadata.source_type,
        },
      };

      logger.info(`Task extraction request from user ${user_id}`);

      const agent = createTaskExtractorAgent(user_id);
      const result = await agent.extractTasks(input);

      logger.info(
        `Task extraction complete: ${result.metadata.total_tasks} tasks, ` +
        `${result.metadata.requires_confirmation} require confirmation`
      );

      res.json(result);
    } catch (error) {
      logger.error('Task extraction endpoint error:', error);
      res.status(500).json({
        error: 'Task extraction failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/tasks/accept
 * Accept extracted tasks
 */
router.post(
  '/accept',
  [
    body('user_id').isString().notEmpty(),
    body('extraction_id').isString().notEmpty(),
    body('action').isIn(['accept_all', 'accept_selected', 'reject_all']),
    body('selected_task_ids').optional().isArray(),
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

      const { user_id, extraction_id, action, selected_task_ids } = req.body;

      logger.info(
        `Accept tasks request: extraction ${extraction_id}, action ${action}`
      );

      const agent = createTaskExtractorAgent(user_id);
      const result = await agent.acceptChanges({
        extraction_id,
        action,
        selected_task_ids,
      });

      logger.info(`Accepted ${result.accepted} tasks`);

      res.json({
        success: true,
        accepted: result.accepted,
        task_ids: result.created_task_ids,
      });
    } catch (error) {
      logger.error('Accept tasks endpoint error:', error);
      res.status(500).json({
        error: 'Failed to accept tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/tasks/pending-extractions
 * List pending extractions
 */
router.get(
  '/pending-extractions',
  [query('user_id').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { user_id } = req.query;

      const agent = createTaskExtractorAgent(user_id as string);
      const extractions = await agent.listPendingExtractions();

      res.json({
        success: true,
        count: extractions.length,
        extractions,
      });
    } catch (error) {
      logger.error('List pending extractions error:', error);
      res.status(500).json({
        error: 'Failed to list pending extractions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/tasks
 * Get user tasks
 */
router.get(
  '/',
  [
    query('user_id').isString().notEmpty(),
    query('status').optional().isString(),
    query('assignee').optional().isString(),
    query('due_before').optional().isISO8601(),
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

      const { user_id, status, assignee, due_before } = req.query;

      const agent = createTaskExtractorAgent(user_id as string);
      const tasks = await agent.getUserTasks({
        status: status as string,
        assignee: assignee as string,
        due_before: due_before as string,
      });

      res.json({
        success: true,
        count: tasks.length,
        tasks,
      });
    } catch (error) {
      logger.error('Get tasks error:', error);
      res.status(500).json({
        error: 'Failed to get tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
