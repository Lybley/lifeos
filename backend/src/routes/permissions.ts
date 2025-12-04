/**
 * Permission & Consent API Routes
 */

import { Router, Request, Response } from 'express';
import { PermissionService } from '../permissions/PermissionService';
import { PermissionScope, BulkPermissionGrant } from '../permissions/types';
import { AuthenticatedRequest } from '../permissions/PermissionMiddleware';
import logger from '../utils/logger';

const router = Router();

/**
 * Get all scope definitions
 */
router.get('/scopes', async (req: Request, res: Response) => {
  try {
    const permissionService = req.app.get('permissionService') as PermissionService;
    const scopes = await permissionService.getScopeDefinitions();
    
    res.json({ scopes });
    
  } catch (error) {
    logger.error('Failed to get scopes', { error });
    res.status(500).json({ error: 'Failed to retrieve scopes' });
  }
});

/**
 * Get user's permissions
 */
router.get('/user/permissions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    const status = req.query.status as string | undefined;
    
    const permissions = await permissionService.getUserPermissions(
      userId,
      status as any
    );
    
    res.json({ permissions });
    
  } catch (error) {
    logger.error('Failed to get user permissions', { error });
    res.status(500).json({ error: 'Failed to retrieve permissions' });
  }
});

/**
 * Get permission summary
 */
router.get('/user/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    const summary = await permissionService.getPermissionSummary(userId);
    
    res.json({ summary });
    
  } catch (error) {
    logger.error('Failed to get permission summary', { error });
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

/**
 * Grant permission
 */
router.post('/grant', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { scope, expiresAt, reason } = req.body;
    
    if (!scope) {
      return res.status(400).json({ error: 'Scope is required' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const permissionId = await permissionService.grantPermission(
      userId,
      scope as PermissionScope,
      {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        reason,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
    
    res.json({
      success: true,
      permissionId,
      message: 'Permission granted'
    });
    
  } catch (error) {
    logger.error('Failed to grant permission', { error });
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

/**
 * Grant multiple permissions
 */
router.post('/grant/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const grant: BulkPermissionGrant = req.body;
    
    if (!grant.scopes || !Array.isArray(grant.scopes)) {
      return res.status(400).json({ error: 'Scopes array is required' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const permissionIds = await permissionService.grantPermissions(
      userId,
      grant,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
    
    res.json({
      success: true,
      permissionIds,
      count: permissionIds.length,
      message: `${permissionIds.length} permissions granted`
    });
    
  } catch (error) {
    logger.error('Failed to grant permissions', { error });
    res.status(500).json({ error: 'Failed to grant permissions' });
  }
});

/**
 * Revoke permission
 */
router.post('/revoke', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { scope, reason } = req.body;
    
    if (!scope) {
      return res.status(400).json({ error: 'Scope is required' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const revoked = await permissionService.revokePermission(
      userId,
      scope as PermissionScope,
      {
        reason,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
    
    if (revoked) {
      res.json({
        success: true,
        message: 'Permission revoked'
      });
    } else {
      res.status(404).json({
        error: 'Permission not found or already revoked'
      });
    }
    
  } catch (error) {
    logger.error('Failed to revoke permission', { error });
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

/**
 * Revoke all permissions
 */
router.post('/revoke/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { reason } = req.body;
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const count = await permissionService.revokeAllPermissions(userId, reason);
    
    res.json({
      success: true,
      revokedCount: count,
      message: `${count} permissions revoked`
    });
    
  } catch (error) {
    logger.error('Failed to revoke all permissions', { error });
    res.status(500).json({ error: 'Failed to revoke all permissions' });
  }
});

/**
 * Get audit log
 */
router.get('/audit-log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const auditLog = await permissionService.getAuditLog(userId, {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      action: req.query.action as string,
      scope: req.query.scope as PermissionScope
    });
    
    res.json({ auditLog });
    
  } catch (error) {
    logger.error('Failed to get audit log', { error });
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

/**
 * Check specific permission
 */
router.post('/check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { scope } = req.body;
    
    if (!scope) {
      return res.status(400).json({ error: 'Scope is required' });
    }
    
    const permissionService = req.app.get('permissionService') as PermissionService;
    
    const result = await permissionService.hasPermission(
      userId,
      scope as PermissionScope
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('Failed to check permission', { error });
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;
