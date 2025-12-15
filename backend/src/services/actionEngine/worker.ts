/**
 * Action Engine Worker - Processes actions from queue
 */

import { Queue, Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { queueConnection } from '../../config/queue';
import { postgresClient } from '../../config/postgres';
import { getActionHandler } from './actionHandlers';
import { performSafetyChecks, incrementRateLimit } from './safetyChecks';
import { Action, ActionType, ActionStatus, AuditEventType } from './types';
import logger from '../../utils/logger';
import { sendApprovalEmail } from './emailService';

// ============================================================================
// QUEUE SETUP
// ============================================================================

let actionQueue: Queue | null = null;
let actionWorker: Worker | null = null;

export function getActionQueue() {
  if (!actionQueue) {
    actionQueue = new Queue('actions', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 172800, // Keep failed jobs for 48 hours
        },
      },
    });
  }
  return actionQueue;
}

export function getActionWorker() {
  if (!actionWorker) {
    actionWorker = new Worker(
      'actions',
      async (job: Job) => {
        const { actionId} = job.data;
        logger.info(`Processing action ${actionId}`);

    try {
      // Get action from database
      const action = await getAction(actionId);

      if (!action) {
        throw new Error(`Action ${actionId} not found`);
      }

      // Check if action requires approval and is not yet approved
      if (action.requires_approval && action.status === 'pending') {
        logger.info(`Action ${actionId} requires approval, waiting...`);
        await logAudit(actionId, action.user_id, 'created', null, 'worker');
        return { status: 'awaiting_approval', actionId };
      }

      // Check if action is not in approved state
      if (action.status !== 'approved') {
        logger.warn(`Action ${actionId} status is ${action.status}, skipping execution`);
        return { status: action.status, actionId };
      }

      // Update status to executing
      await updateActionStatus(actionId, 'executing');
      await logAudit(actionId, action.user_id, 'started', null, 'worker');

      // Get handler for this action type
      const handler = getActionHandler(action.action_type);

      if (!handler) {
        throw new Error(`No handler found for action type: ${action.action_type}`);
      }

      // Validate payload
      const validation = handler.validate(action.payload);
      if (!validation.valid) {
        throw new Error(`Invalid payload: ${validation.error}`);
      }

      // Execute action
      const result = await handler.execute(action.payload);

      if (!result.success) {
        throw new Error(result.error || 'Action execution failed');
      }

      // Update action with result
      await completeAction(actionId, result.result, result.rollback_data);
      await logAudit(actionId, action.user_id, 'completed', result.result, 'worker');

      // Increment rate limit counters
      await incrementRateLimit(action.action_type as ActionType, action.user_id);

      logger.info(`Action ${actionId} completed successfully`);
      return { status: 'completed', actionId, result: result.result };
    } catch (error) {
      logger.error(`Action ${actionId} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await failAction(actionId, errorMessage);

      // Get action to check retry count
      const action = await getAction(actionId);
      if (action && action.retry_count < action.max_retries) {
        await logAudit(actionId, action.user_id, 'retried', { error: errorMessage }, 'worker');
        throw error; // This will trigger BullMQ retry
      } else {
        await logAudit(actionId, action.user_id, 'failed', { error: errorMessage }, 'worker');
        throw error;
      }
    }
  },
  {
    connection: queueConnection,
    concurrency: 5, // Process up to 5 actions concurrently
  }
);
  }
  return actionWorker;
}

// ============================================================================
// ACTION MANAGEMENT
// ============================================================================

/**
 * Create a new action
 */
export async function createAction(
  userId: string,
  actionType: ActionType,
  payload: any,
  priority: number = 5,
  scheduledFor?: Date
): Promise<{ actionId: string; requiresApproval: boolean; approvalToken?: string }> {
  logger.info(`Creating action ${actionType} for user ${userId}`);

  // Perform safety checks
  const safetyCheck = await performSafetyChecks(actionType, userId, payload);

  if (!safetyCheck.allowed) {
    throw new Error(safetyCheck.reason || 'Action not allowed');
  }

  // Generate approval token if needed
  const requiresApproval = safetyCheck.requires_approval;
  const approvalToken = requiresApproval ? uuidv4() : null;
  const approvalExpiresAt = requiresApproval
    ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    : null;

  // Insert action into database
  const query = `
    INSERT INTO actions (
      user_id, action_type, status, priority, payload,
      requires_approval, approval_token, approval_expires_at,
      scheduled_for
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;

  const values = [
    userId,
    actionType,
    requiresApproval ? 'pending' : 'approved',
    priority,
    JSON.stringify(payload),
    requiresApproval,
    approvalToken,
    approvalExpiresAt,
    scheduledFor || null,
  ];

  const result = await postgresClient.query(query, values);
  const actionId = result.rows[0].id;

  // Log creation
  await logAudit(actionId, userId, 'created', { actionType, requiresApproval }, 'api');

  // If requires approval, send email
  if (requiresApproval && approvalToken) {
    try {
      await sendApprovalEmail(userId, actionId, actionType, payload, approvalToken);
      logger.info(`Approval email sent for action ${actionId}`);
    } catch (error) {
      logger.error(`Failed to send approval email for action ${actionId}:`, error);
      // Don't fail the action creation if email fails
    }
  } else {
    // If no approval needed, add to queue immediately
    await getActionQueue().add('process', { actionId }, { priority });
    logger.info(`Action ${actionId} added to queue`);
  }

  return {
    actionId,
    requiresApproval,
    approvalToken: approvalToken || undefined,
  };
}

/**
 * Approve an action
 */
export async function approveAction(
  actionId: string,
  approvedBy: string,
  source: 'api' | 'email_link' | 'ui',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  logger.info(`Approving action ${actionId} by ${approvedBy}`);

  const action = await getAction(actionId);

  if (!action) {
    throw new Error('Action not found');
  }

  if (action.status !== 'pending') {
    throw new Error(`Action cannot be approved. Current status: ${action.status}`);
  }

  if (!action.requires_approval) {
    throw new Error('Action does not require approval');
  }

  // Check if approval has expired
  if (action.approval_expires_at && new Date() > new Date(action.approval_expires_at)) {
    throw new Error('Approval token has expired');
  }

  // Update action status
  const query = `
    UPDATE actions
    SET status = 'approved',
        approved_by = $1,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [approvedBy, actionId]);

  // Log approval
  await logAudit(
    actionId,
    action.user_id,
    'approved',
    { approved_by: approvedBy },
    source,
    ipAddress,
    userAgent
  );

  // Add to queue for execution
  await getActionQueue().add('process', { actionId }, { priority: action.priority });
  logger.info(`Action ${actionId} approved and added to queue`);
}

/**
 * Reject an action
 */
export async function rejectAction(
  actionId: string,
  rejectedBy: string,
  reason: string,
  source: 'api' | 'email_link' | 'ui',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  logger.info(`Rejecting action ${actionId} by ${rejectedBy}`);

  const action = await getAction(actionId);

  if (!action) {
    throw new Error('Action not found');
  }

  if (action.status !== 'pending') {
    throw new Error(`Action cannot be rejected. Current status: ${action.status}`);
  }

  // Update action status
  const query = `
    UPDATE actions
    SET status = 'rejected',
        rejection_reason = $1,
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [reason, actionId]);

  // Log rejection
  await logAudit(
    actionId,
    action.user_id,
    'rejected',
    { rejected_by: rejectedBy, reason },
    source,
    ipAddress,
    userAgent
  );

  logger.info(`Action ${actionId} rejected`);
}

/**
 * Rollback an action
 */
export async function rollbackAction(
  actionId: string,
  rolledBackBy: string,
  reason: string
): Promise<void> {
  logger.info(`Rolling back action ${actionId}`);

  const action = await getAction(actionId);

  if (!action) {
    throw new Error('Action not found');
  }

  if (action.status !== 'completed') {
    throw new Error(`Action cannot be rolled back. Current status: ${action.status}`);
  }

  if (!action.rollback_data) {
    throw new Error('No rollback data available for this action');
  }

  // Get handler
  const handler = getActionHandler(action.action_type);

  if (!handler) {
    throw new Error(`No handler found for action type: ${action.action_type}`);
  }

  // Attempt rollback
  const success = await handler.rollback(action.rollback_data);

  if (!success) {
    throw new Error('Rollback failed');
  }

  // Update action status
  const query = `
    UPDATE actions
    SET status = 'rolled_back',
        rollback_reason = $1,
        rolled_back_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [reason, actionId]);

  // Log rollback
  await logAudit(actionId, action.user_id, 'rolled_back', { rolled_back_by: rolledBackBy, reason }, 'api');

  // Record in rollback history
  const historyQuery = `
    INSERT INTO action_rollback_history (
      action_id, rolled_back_by, rollback_reason, rollback_data, success
    ) VALUES ($1, $2, $3, $4, $5)
  `;

  await postgresClient.query(historyQuery, [
    actionId,
    rolledBackBy,
    reason,
    action.rollback_data,
    success,
  ]);

  logger.info(`Action ${actionId} rolled back successfully`);
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

async function getAction(actionId: string): Promise<Action | null> {
  const query = 'SELECT * FROM actions WHERE id = $1';
  const result = await postgresClient.query(query, [actionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    action_type: row.action_type,
    status: row.status,
    priority: row.priority,
    payload: row.payload,
    requires_approval: row.requires_approval,
    approval_token: row.approval_token,
    approval_expires_at: row.approval_expires_at,
    scheduled_for: row.scheduled_for,
    rollback_data: row.rollback_data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
  const query = `
    UPDATE actions
    SET status = $1::VARCHAR,
        started_at = CASE WHEN $1::VARCHAR = 'executing' THEN NOW() ELSE started_at END,
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [status, actionId]);
}

async function completeAction(
  actionId: string,
  result: any,
  rollbackData: any
): Promise<void> {
  const query = `
    UPDATE actions
    SET status = 'completed',
        completed_at = NOW(),
        rollback_data = $1,
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [rollbackData ? JSON.stringify(rollbackData) : null, actionId]);
}

async function failAction(actionId: string, errorMessage: string): Promise<void> {
  const query = `
    UPDATE actions
    SET status = 'failed',
        error_message = $1,
        retry_count = retry_count + 1,
        updated_at = NOW()
    WHERE id = $2
  `;

  await postgresClient.query(query, [errorMessage, actionId]);
}

async function logAudit(
  actionId: string,
  userId: string,
  eventType: AuditEventType,
  eventData: any | null,
  source: 'api' | 'webhook' | 'email_link' | 'ui' | 'worker',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const query = `
    INSERT INTO action_audit_logs (
      action_id, user_id, event_type, event_data, source, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  await postgresClient.query(query, [
    actionId,
    userId,
    eventType,
    eventData ? JSON.stringify(eventData) : null,
    source,
    ipAddress || null,
    userAgent || null,
  ]);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

export async function getActionById(actionId: string): Promise<Action | null> {
  return getAction(actionId);
}

export async function getActionsByUser(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Action[]> {
  const query = `
    SELECT * FROM actions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await postgresClient.query(query, [userId, limit, offset]);
  return result.rows;
}

export async function getActionAuditLogs(actionId: string): Promise<any[]> {
  const query = `
    SELECT * FROM action_audit_logs
    WHERE action_id = $1
    ORDER BY created_at ASC
  `;

  const result = await postgresClient.query(query, [actionId]);
  return result.rows;
}

// ============================================================================
// WORKER LIFECYCLE
// ============================================================================
// Event listeners are now handled within getActionWorker() function

actionWorker.on('error', (err) => {
  logger.error('Worker error:', err);
});

logger.info('Action Engine worker initialized');
