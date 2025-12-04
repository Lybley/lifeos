/**
 * RBAC Middleware for Admin Dashboard
 * Verifies admin roles and permissions
 */

import { Request, Response, NextFunction } from 'express';
import { postgresClient as db } from '../config/postgres';
import logger from '../utils/logger';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  permissions: Record<string, string[]>;
  status: string;
  level: number;
}

// Extend Express Request to include admin user
declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

/**
 * Verify admin authentication
 * In production, this would check JWT or session tokens
 * For now, we'll use a simple user_id header for testing
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In production, extract from JWT or session
    // For now, using header for testing
    const userId = req.headers['x-admin-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required',
      });
      return;
    }

    // Fetch admin user from database
    const result = await db.query(
      `SELECT 
        au.id, au.user_id, au.email, au.name, 
        au.role_id, au.role_name, au.status,
        ar.permissions, ar.level
       FROM admin_users au
       JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.user_id = $1 AND au.status = 'active'`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Not authorized as admin',
      });
      return;
    }

    req.adminUser = result.rows[0] as AdminUser;

    // Update last activity
    await db.query(
      'UPDATE admin_users SET last_activity = NOW() WHERE user_id = $1',
      [userId]
    );

    next();
  } catch (error) {
    logger.error('Admin auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate admin user',
    });
  }
};

/**
 * Require specific admin role level
 */
export const requireRole = (maxLevel: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required',
      });
      return;
    }

    if (req.adminUser.level > maxLevel) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions for this operation',
      });
      return;
    }

    next();
  };
};

/**
 * Require specific permission
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required',
      });
      return;
    }

    const permissions = req.adminUser.permissions;
    const resourcePermissions = permissions[resource];

    if (!resourcePermissions || !resourcePermissions.includes(action)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing permission: ${resource}:${action}`,
      });
      return;
    }

    next();
  };
};

/**
 * Log admin action to audit trail
 */
export const logAdminAction = async (
  adminUserId: string,
  adminEmail: string,
  action: string,
  resourceType: string,
  resourceId: string,
  description: string,
  changes?: any,
  ipAddress?: string,
  userAgent?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO admin_audit_logs 
       (admin_user_id, admin_email, action, resource_type, resource_id, 
        description, changes, ip_address, user_agent, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        adminUserId,
        adminEmail,
        action,
        resourceType,
        resourceId,
        description,
        changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent,
        success,
        errorMessage,
      ]
    );
  } catch (error) {
    logger.error('Failed to log admin action:', error);
  }
};
