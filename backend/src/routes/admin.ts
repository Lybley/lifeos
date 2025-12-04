/**
 * Admin Dashboard API Routes
 * Multi-tenant management, metrics, support, and billing
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { postgresClient as db } from '../config/postgres';
import logger from '../utils/logger';
import {
  requireAdmin,
  requireRole,
  requirePermission,
  logAdminAction,
} from '../middleware/adminAuth';

const router = Router();

// All admin routes require authentication
router.use(requireAdmin);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /api/v1/admin/users
 * List all users with pagination and filters
 */
router.get(
  '/users',
  requirePermission('users', 'read'),
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereConditions.push(
          `(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM admin_users ${whereClause}`,
        params
      );
      const totalUsers = parseInt(countResult.rows[0].count);

      // Get paginated users
      params.push(limit, offset);
      const usersResult = await db.query(
        `SELECT 
          au.id, au.user_id, au.email, au.name,
          au.role_name, au.status, au.mfa_enabled,
          au.last_login, au.last_activity, au.login_count,
          au.created_at, au.updated_at
         FROM admin_users au
         ${whereClause}
         ORDER BY au.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      res.json({
        users: usersResult.rows,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      });
    } catch (error) {
      logger.error('Failed to fetch users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch users',
      });
    }
  }
);

/**
 * GET /api/v1/admin/users/:userId
 * Get user details
 */
router.get(
  '/users/:userId',
  requirePermission('users', 'read'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const userResult = await db.query(
        `SELECT 
          au.id, au.user_id, au.email, au.name,
          au.role_name, au.status, au.mfa_enabled,
          au.last_login, au.last_activity, au.login_count,
          au.created_at, au.updated_at,
          ar.permissions, ar.level
         FROM admin_users au
         JOIN admin_roles ar ON au.role_id = ar.id
         WHERE au.user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      // Get recent activity
      const activityResult = await db.query(
        `SELECT activity_type, activity_details, created_at
         FROM user_activity_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      res.json({
        user: userResult.rows[0],
        recentActivity: activityResult.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user',
      });
    }
  }
);

/**
 * PATCH /api/v1/admin/users/:userId
 * Update user status or role
 */
router.patch(
  '/users/:userId',
  requirePermission('users', 'write'),
  [
    body('status').optional().isIn(['active', 'suspended', 'deactivated']),
    body('role_name').optional().isString(),
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

      const { userId } = req.params;
      const { status, role_name } = req.body;

      // Get current user state
      const currentUserResult = await db.query(
        'SELECT * FROM admin_users WHERE user_id = $1',
        [userId]
      );

      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      const currentUser = currentUserResult.rows[0];
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      const changes: any = { before: {}, after: {} };

      if (status && status !== currentUser.status) {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
        changes.before.status = currentUser.status;
        changes.after.status = status;
      }

      if (role_name && role_name !== currentUser.role_name) {
        // Get new role ID
        const roleResult = await db.query(
          'SELECT id FROM admin_roles WHERE role_name = $1',
          [role_name]
        );

        if (roleResult.rows.length === 0) {
          return res.status(400).json({
            error: 'Invalid role',
            message: 'Role not found',
          });
        }

        updates.push(`role_id = $${paramIndex}`);
        params.push(roleResult.rows[0].id);
        paramIndex++;
        updates.push(`role_name = $${paramIndex}`);
        params.push(role_name);
        paramIndex++;
        changes.before.role_name = currentUser.role_name;
        changes.after.role_name = role_name;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'No valid updates provided',
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(userId);

      await db.query(
        `UPDATE admin_users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
        params
      );

      // Log action
      await logAdminAction(
        req.adminUser!.user_id,
        req.adminUser!.email,
        'update_user',
        'user',
        userId,
        `Updated user ${userId}`,
        changes,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        message: 'User updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update user',
      });
    }
  }
);

/**
 * DELETE /api/v1/admin/users/:userId
 * Delete user (super admin only)
 */
router.delete(
  '/users/:userId',
  requireRole(0), // Super admin only
  requirePermission('users', 'delete'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const result = await db.query(
        'DELETE FROM admin_users WHERE user_id = $1 RETURNING *',
        [userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      // Log action
      await logAdminAction(
        req.adminUser!.user_id,
        req.adminUser!.email,
        'delete_user',
        'user',
        userId,
        `Deleted user ${userId}`,
        undefined,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user',
      });
    }
  }
);

// ============================================================================
// METRICS & ANALYTICS
// ============================================================================

/**
 * GET /api/v1/admin/metrics/overview
 * Get dashboard overview metrics
 */
router.get(
  '/metrics/overview',
  requirePermission('metrics', 'read'),
  async (req: Request, res: Response) => {
    try {
      // User stats
      const userStatsResult = await db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE status = 'active') as active_users,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users
        FROM admin_users
      `);

      // Recent metrics
      const metricsResult = await db.query(`
        SELECT metric_name, value, period, period_start
        FROM system_metrics
        WHERE period_start >= NOW() - INTERVAL '7 days'
        ORDER BY period_start DESC
        LIMIT 50
      `);

      // Activity trends
      const activityResult = await db.query(`
        SELECT 
          activity_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM user_activity_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY activity_type, DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        userStats: userStatsResult.rows[0],
        recentMetrics: metricsResult.rows,
        activityTrends: activityResult.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch metrics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch metrics',
      });
    }
  }
);

/**
 * GET /api/v1/admin/metrics/system
 * Get system metrics by name and time range
 */
router.get(
  '/metrics/system',
  requirePermission('metrics', 'read'),
  async (req: Request, res: Response) => {
    try {
      const metricName = req.query.metric_name as string;
      const period = req.query.period as string;
      const days = parseInt(req.query.days as string) || 7;

      let whereConditions = ['period_start >= NOW() - INTERVAL $1'];
      let params: any[] = [`${days} days`];
      let paramIndex = 2;

      if (metricName) {
        whereConditions.push(`metric_name = $${paramIndex}`);
        params.push(metricName);
        paramIndex++;
      }

      if (period) {
        whereConditions.push(`period = $${paramIndex}`);
        params.push(period);
        paramIndex++;
      }

      const result = await db.query(
        `SELECT *
         FROM system_metrics
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY period_start DESC`,
        params
      );

      res.json({
        metrics: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch system metrics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch system metrics',
      });
    }
  }
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * GET /api/v1/admin/audit-logs
 * Get audit trail with filters
 */
router.get(
  '/audit-logs',
  requirePermission('admin', 'read'),
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const adminUserId = req.query.admin_user_id as string;
      const action = req.query.action as string;
      const resourceType = req.query.resource_type as string;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (adminUserId) {
        whereConditions.push(`admin_user_id = $${paramIndex}`);
        params.push(adminUserId);
        paramIndex++;
      }

      if (action) {
        whereConditions.push(`action = $${paramIndex}`);
        params.push(action);
        paramIndex++;
      }

      if (resourceType) {
        whereConditions.push(`resource_type = $${paramIndex}`);
        params.push(resourceType);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM admin_audit_logs ${whereClause}`,
        params
      );
      const totalLogs = parseInt(countResult.rows[0].count);

      // Get paginated logs
      params.push(limit, offset);
      const logsResult = await db.query(
        `SELECT *
         FROM admin_audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      res.json({
        logs: logsResult.rows,
        pagination: {
          page,
          limit,
          total: totalLogs,
          totalPages: Math.ceil(totalLogs / limit),
        },
      });
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch audit logs',
      });
    }
  }
);

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

/**
 * GET /api/v1/admin/tickets
 * List support tickets
 */
router.get(
  '/tickets',
  requirePermission('support', 'read'),
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const priority = req.query.priority as string;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (status) {
        whereConditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        whereConditions.push(`priority = $${paramIndex}`);
        params.push(priority);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const countResult = await db.query(
        `SELECT COUNT(*) FROM support_tickets ${whereClause}`,
        params
      );
      const totalTickets = parseInt(countResult.rows[0].count);

      params.push(limit, offset);
      const ticketsResult = await db.query(
        `SELECT *
         FROM support_tickets
         ${whereClause}
         ORDER BY 
           CASE priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      res.json({
        tickets: ticketsResult.rows,
        pagination: {
          page,
          limit,
          total: totalTickets,
          totalPages: Math.ceil(totalTickets / limit),
        },
      });
    } catch (error) {
      logger.error('Failed to fetch tickets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch tickets',
      });
    }
  }
);

/**
 * PATCH /api/v1/admin/tickets/:ticketId
 * Update ticket status or assignment
 */
router.patch(
  '/tickets/:ticketId',
  requirePermission('support', 'write'),
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('assigned_to').optional().isString(),
    body('resolution_notes').optional().isString(),
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

      const { ticketId } = req.params;
      const { status, assigned_to, resolution_notes } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;

        if (status === 'resolved' || status === 'closed') {
          updates.push(`resolved_at = NOW()`);
        }
      }

      if (assigned_to) {
        updates.push(`assigned_to = $${paramIndex}`);
        params.push(assigned_to);
        paramIndex++;
      }

      if (resolution_notes) {
        updates.push(`resolution_notes = $${paramIndex}`);
        params.push(resolution_notes);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'No valid updates provided',
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(ticketId);

      await db.query(
        `UPDATE support_tickets SET ${updates.join(', ')} WHERE ticket_id = $${paramIndex}`,
        params
      );

      // Log action
      await logAdminAction(
        req.adminUser!.user_id,
        req.adminUser!.email,
        'update_ticket',
        'support_ticket',
        ticketId,
        `Updated ticket ${ticketId}`,
        req.body,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        message: 'Ticket updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update ticket:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update ticket',
      });
    }
  }
);

// ============================================================================
// BILLING
// ============================================================================

/**
 * GET /api/v1/admin/billing/overview
 * Get billing overview and revenue metrics
 */
router.get(
  '/billing/overview',
  requirePermission('billing', 'read'),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const result = await db.query(
        `SELECT *
         FROM billing_snapshots
         WHERE snapshot_date >= CURRENT_DATE - INTERVAL '1 day' * $1
         ORDER BY snapshot_date DESC`,
        [days]
      );

      // Calculate trends
      const snapshots = result.rows;
      const latest = snapshots[0] || {};
      const previous = snapshots[1] || {};

      const trends = {
        mrr: {
          current: latest.mrr || 0,
          change: latest.mrr && previous.mrr ? latest.mrr - previous.mrr : 0,
        },
        total_users: {
          current: latest.total_users || 0,
          change:
            latest.total_users && previous.total_users
              ? latest.total_users - previous.total_users
              : 0,
        },
        paying_users: {
          current: latest.paying_users || 0,
          change:
            latest.paying_users && previous.paying_users
              ? latest.paying_users - previous.paying_users
              : 0,
        },
        churn_rate: {
          current: latest.churn_rate || 0,
          change:
            latest.churn_rate && previous.churn_rate
              ? latest.churn_rate - previous.churn_rate
              : 0,
        },
      };

      res.json({
        snapshots: result.rows,
        trends,
      });
    } catch (error) {
      logger.error('Failed to fetch billing overview:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch billing overview',
      });
    }
  }
);

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

/**
 * GET /api/v1/admin/health
 * Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    // Get active connections
    const connectionsResult = await db.query(
      'SELECT count(*) FROM pg_stat_activity'
    );

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'up',
          latency_ms: dbLatency,
          active_connections: parseInt(connectionsResult.rows[0].count),
        },
        api: {
          status: 'up',
          uptime_seconds: process.uptime(),
        },
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Service check failed',
    });
  }
});

export default router;
