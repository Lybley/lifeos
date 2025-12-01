/**
 * Action Engine API Routes
 */

import { Router, Request, Response } from 'express';
import {
  createAction,
  approveAction,
  rejectAction,
  rollbackAction,
  getActionById,
  getActionsByUser,
  getActionAuditLogs,
} from '../services/actionEngine/worker';
import { getRateLimitUsage } from '../services/actionEngine/safetyChecks';
import { ActionType } from '../services/actionEngine/types';
import logger from '../utils/logger';
import { postgresClient } from '../config/postgres';

const router = Router();

// ============================================================================
// CREATE ACTION
// ============================================================================

/**
 * POST /api/actions
 * Create a new action
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, action_type, payload, priority, scheduled_for } = req.body;

    // Validate required fields
    if (!user_id || !action_type || !payload) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, action_type, payload',
      });
    }

    // Validate action type
    const validActionTypes: ActionType[] = [
      'create_calendar_event',
      'send_email',
      'move_file',
      'create_document',
      'make_payment',
      'make_purchase',
    ];

    if (!validActionTypes.includes(action_type)) {
      return res.status(400).json({
        error: `Invalid action_type. Must be one of: ${validActionTypes.join(', ')}`,
      });
    }

    // Create action
    const result = await createAction(
      user_id,
      action_type,
      payload,
      priority,
      scheduled_for ? new Date(scheduled_for) : undefined
    );

    res.status(201).json({
      success: true,
      action_id: result.actionId,
      requires_approval: result.requiresApproval,
      approval_token: result.approvalToken,
      message: result.requiresApproval
        ? 'Action created and awaiting approval'
        : 'Action created and queued for execution',
    });
  } catch (error) {
    logger.error('Failed to create action:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create action',
    });
  }
});

// ============================================================================
// APPROVE ACTION
// ============================================================================

/**
 * POST /api/actions/:actionId/approve
 * Approve an action via API
 */
router.post('/:actionId/approve', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const { approved_by } = req.body;

    if (!approved_by) {
      return res.status(400).json({ error: 'approved_by is required' });
    }

    await approveAction(
      actionId,
      approved_by,
      'api',
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Action approved and queued for execution',
    });
  } catch (error) {
    logger.error('Failed to approve action:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve action',
    });
  }
});

/**
 * GET /api/actions/approve?token=xxx
 * Approve an action via email link
 */
router.get('/approve', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Invalid Approval Link</h1>
          <p>The approval token is missing or invalid.</p>
        </body>
        </html>
      `);
    }

    // Get action by token
    const query = 'SELECT * FROM actions WHERE approval_token = $1';
    const result = await postgresClient.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Not Found</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Action Not Found</h1>
          <p>No action found with this approval token.</p>
        </body>
        </html>
      `);
    }

    const action = result.rows[0];

    // Approve action
    await approveAction(
      action.id,
      action.user_id,
      'email_link',
      req.ip,
      req.get('user-agent')
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Action Approved</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            background: white;
            color: #333;
            padding: 40px;
            border-radius: 12px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          h1 { color: #10b981; }
          .action-id { 
            background: #f3f4f6;
            padding: 10px;
            border-radius: 6px;
            font-family: monospace;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Action Approved</h1>
          <p>The action has been successfully approved and will be executed shortly.</p>
          <div class="action-id">
            <strong>Action ID:</strong> ${action.id}
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            You can close this page now.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Failed to approve action via email:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Approval Failed</h1>
        <p>${error instanceof Error ? error.message : 'An error occurred'}</p>
      </body>
      </html>
    `);
  }
});

// ============================================================================
// REJECT ACTION
// ============================================================================

/**
 * POST /api/actions/:actionId/reject
 * Reject an action via API
 */
router.post('/:actionId/reject', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const { rejected_by, reason } = req.body;

    if (!rejected_by || !reason) {
      return res.status(400).json({ error: 'rejected_by and reason are required' });
    }

    await rejectAction(
      actionId,
      rejected_by,
      reason,
      'api',
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Action rejected',
    });
  } catch (error) {
    logger.error('Failed to reject action:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to reject action',
    });
  }
});

/**
 * GET /api/actions/reject?token=xxx
 * Reject an action via email link
 */
router.get('/reject', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Invalid Rejection Link</h1>
          <p>The rejection token is missing or invalid.</p>
        </body>
        </html>
      `);
    }

    // Get action by token
    const query = 'SELECT * FROM actions WHERE approval_token = $1';
    const result = await postgresClient.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Not Found</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Action Not Found</h1>
          <p>No action found with this token.</p>
        </body>
        </html>
      `);
    }

    const action = result.rows[0];

    // Reject action
    await rejectAction(
      action.id,
      action.user_id,
      'Rejected via email link',
      'email_link',
      req.ip,
      req.get('user-agent')
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Action Rejected</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
          }
          .container {
            background: white;
            color: #333;
            padding: 40px;
            border-radius: 12px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          h1 { color: #ef4444; }
          .action-id { 
            background: #f3f4f6;
            padding: 10px;
            border-radius: 6px;
            font-family: monospace;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⛔ Action Rejected</h1>
          <p>The action has been rejected and will not be executed.</p>
          <div class="action-id">
            <strong>Action ID:</strong> ${action.id}
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            You can close this page now.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Failed to reject action via email:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Rejection Failed</h1>
        <p>${error instanceof Error ? error.message : 'An error occurred'}</p>
      </body>
      </html>
    `);
  }
});

// ============================================================================
// ROLLBACK ACTION
// ============================================================================

/**
 * POST /api/actions/:actionId/rollback
 * Rollback a completed action
 */
router.post('/:actionId/rollback', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const { rolled_back_by, reason } = req.body;

    if (!rolled_back_by || !reason) {
      return res.status(400).json({ error: 'rolled_back_by and reason are required' });
    }

    await rollbackAction(actionId, rolled_back_by, reason);

    res.json({
      success: true,
      message: 'Action rolled back successfully',
    });
  } catch (error) {
    logger.error('Failed to rollback action:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to rollback action',
    });
  }
});

// ============================================================================
// GET ACTION DETAILS
// ============================================================================

/**
 * GET /api/actions/:actionId
 * Get action details
 */
router.get('/:actionId', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const action = await getActionById(actionId);

    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.json({
      success: true,
      action,
    });
  } catch (error) {
    logger.error('Failed to get action:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get action',
    });
  }
});

/**
 * GET /api/actions/:actionId/audit
 * Get audit logs for action
 */
router.get('/:actionId/audit', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const logs = await getActionAuditLogs(actionId);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get audit logs',
    });
  }
});

// ============================================================================
// GET USER ACTIONS
// ============================================================================

/**
 * GET /api/actions/user/:userId
 * Get all actions for a user
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const actions = await getActionsByUser(userId, limit, offset);

    res.json({
      success: true,
      actions,
      pagination: {
        limit,
        offset,
        total: actions.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user actions:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get user actions',
    });
  }
});

// ============================================================================
// RATE LIMIT USAGE
// ============================================================================

/**
 * GET /api/actions/rate-limits/:userId/:actionType
 * Get rate limit usage for user and action type
 */
router.get('/rate-limits/:userId/:actionType', async (req: Request, res: Response) => {
  try {
    const { userId, actionType } = req.params;

    const usage = await getRateLimitUsage(actionType as ActionType, userId);

    res.json({
      success: true,
      rate_limits: usage,
    });
  } catch (error) {
    logger.error('Failed to get rate limits:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get rate limits',
    });
  }
});

export default router;
