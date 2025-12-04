/**
 * Permission Enforcement Middleware
 * 
 * Enforces permission checks at various layers:
 * - Data ingestion
 * - RAG calls
 * - Agent execution
 * - Action execution
 */

import { Request, Response, NextFunction } from 'express';
import { PermissionService } from './PermissionService';
import { PermissionScope } from './types';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    sub?: string;
  };
  permissions?: PermissionService;
}

/**
 * Create permission checking middleware
 */
export function requirePermission(
  scope: PermissionScope | PermissionScope[],
  options: {
    logUsage?: boolean;
    strictMode?: boolean; // Fail if ANY required permission is missing
  } = {}
) {
  const scopes = Array.isArray(scope) ? scope : [scope];
  
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user?.id && !req.user?.sub) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      const userId = req.user.id || req.user.sub!;
      
      // Get permission service
      const permissionService = req.permissions || 
        (req.app.get('permissionService') as PermissionService);
      
      if (!permissionService) {
        logger.error('Permission service not available');
        return res.status(500).json({
          error: 'Internal error',
          message: 'Permission service unavailable'
        });
      }
      
      // Check all required permissions
      const checks = await Promise.all(
        scopes.map(s => permissionService.hasPermission(userId, s))
      );
      
      const deniedScopes = checks
        .filter(check => !check.allowed)
        .map(check => check.scope);
      
      // Strict mode: ALL permissions required
      if (options.strictMode && deniedScopes.length > 0) {
        logger.warn('Permission denied (strict mode)', {
          userId,
          requiredScopes: scopes,
          deniedScopes,
          path: req.path
        });
        
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Required permissions not granted',
          requiredScopes: scopes,
          deniedScopes
        });
      }
      
      // Non-strict mode: AT LEAST ONE permission required
      if (!options.strictMode && checks.every(check => !check.allowed)) {
        logger.warn('Permission denied', {
          userId,
          requiredScopes: scopes,
          path: req.path
        });
        
        return res.status(403).json({
          error: 'Permission denied',
          message: 'At least one required permission must be granted',
          requiredScopes: scopes
        });
      }
      
      // Log usage if requested
      if (options.logUsage) {
        const allowedScopes = checks
          .filter(check => check.allowed)
          .map(check => check.scope);
        
        // Log usage asynchronously
        Promise.all(
          allowedScopes.map(s => 
            permissionService.logUsage(userId, s, {
              path: req.path,
              method: req.method,
              userAgent: req.headers['user-agent']
            })
          )
        ).catch(error => {
          logger.error('Failed to log permission usage', { error });
        });
      }
      
      // Attach permission checks to request for downstream use
      (req as any).permissionChecks = checks;
      
      next();
      
    } catch (error) {
      logger.error('Permission middleware error', { error });
      return res.status(500).json({
        error: 'Internal error',
        message: 'Failed to check permissions'
      });
    }
  };
}

/**
 * Data ingestion permission middleware
 */
export function requireIngestionPermission(
  source: 'emails' | 'files' | 'calendar' | 'messages' | 'contacts'
) {
  const scopeMap: Record<string, PermissionScope[]> = {
    emails: [PermissionScope.EMAILS_FULL, PermissionScope.EMAILS_METADATA],
    files: [PermissionScope.FILES_FULL, PermissionScope.FILES_METADATA],
    calendar: [PermissionScope.CALENDAR_READ],
    messages: [PermissionScope.MESSAGES_READ],
    contacts: [PermissionScope.CONTACTS_READ]
  };
  
  const scopes = scopeMap[source] || [];
  
  return requirePermission(scopes, {
    logUsage: true,
    strictMode: false // Allow either full or metadata access
  });
}

/**
 * RAG query permission middleware
 */
export function requireRAGPermission() {
  // RAG requires at least one data source permission
  const readScopes = [
    PermissionScope.EMAILS_METADATA,
    PermissionScope.FILES_METADATA,
    PermissionScope.CALENDAR_READ,
    PermissionScope.MESSAGES_READ,
    PermissionScope.CONTACTS_READ
  ];
  
  return requirePermission(readScopes, {
    logUsage: true,
    strictMode: false // Allow if ANY data source is accessible
  });
}

/**
 * Action execution permission middleware
 */
export function requireActionPermission(actionType: string) {
  const actionScopeMap: Record<string, PermissionScope[]> = {
    send_email: [PermissionScope.EMAILS_FULL],
    create_event: [PermissionScope.CALENDAR_WRITE],
    delete_event: [PermissionScope.CALENDAR_WRITE],
    update_event: [PermissionScope.CALENDAR_WRITE],
    make_purchase: [PermissionScope.PURCHASES_WRITE],
    view_health: [PermissionScope.HEALTH_READ]
  };
  
  const scopes = actionScopeMap[actionType] || [];
  
  if (scopes.length === 0) {
    logger.warn('Unknown action type, no permission check', { actionType });
  }
  
  return requirePermission(scopes, {
    logUsage: true,
    strictMode: true // All action permissions required
  });
}

/**
 * Agent execution permission middleware
 */
export function requireAgentPermission(agentCapabilities: string[]) {
  // Map agent capabilities to required permissions
  const capabilityScopes: Record<string, PermissionScope> = {
    read_emails: PermissionScope.EMAILS_METADATA,
    read_files: PermissionScope.FILES_METADATA,
    read_calendar: PermissionScope.CALENDAR_READ,
    write_calendar: PermissionScope.CALENDAR_WRITE,
    read_contacts: PermissionScope.CONTACTS_READ
  };
  
  const requiredScopes = agentCapabilities
    .map(cap => capabilityScopes[cap])
    .filter(scope => scope !== undefined);
  
  if (requiredScopes.length === 0) {
    logger.warn('Agent has no recognized capabilities', { agentCapabilities });
  }
  
  return requirePermission(requiredScopes, {
    logUsage: true,
    strictMode: true // Agent needs ALL its required permissions
  });
}

/**
 * Permission check decorator for service methods
 */
export function CheckPermission(scope: PermissionScope | PermissionScope[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // First argument should be userId
      const userId = args[0];
      
      if (!userId) {
        throw new Error('User ID required for permission check');
      }
      
      // Get permission service from this context
      const permissionService = (this as any).permissionService as PermissionService;
      
      if (!permissionService) {
        throw new Error('Permission service not available');
      }
      
      // Check permission
      const scopes = Array.isArray(scope) ? scope : [scope];
      const checks = await Promise.all(
        scopes.map(s => permissionService.hasPermission(userId, s))
      );
      
      const hasPermission = checks.some(check => check.allowed);
      
      if (!hasPermission) {
        const error = new Error('Permission denied') as any;
        error.code = 'PERMISSION_DENIED';
        error.requiredScopes = scopes;
        throw error;
      }
      
      // Call original method
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };\n}\n\n/**\n * Helper function to check permission in service layer\n */\nexport async function checkPermissionInService(\n  permissionService: PermissionService,\n  userId: string,\n  scope: PermissionScope | PermissionScope[],\n  operation: string\n): Promise<void> {\n  const scopes = Array.isArray(scope) ? scope : [scope];\n  \n  const checks = await Promise.all(\n    scopes.map(s => permissionService.hasPermission(userId, s))\n  );\n  \n  const hasPermission = checks.some(check => check.allowed);\n  \n  if (!hasPermission) {\n    logger.warn('Permission denied in service layer', {\n      userId,\n      operation,\n      requiredScopes: scopes\n    });\n    \n    const error = new Error(`Permission denied for ${operation}`) as any;\n    error.code = 'PERMISSION_DENIED';\n    error.requiredScopes = scopes;\n    throw error;\n  }\n}\n\nexport default {\n  requirePermission,\n  requireIngestionPermission,\n  requireRAGPermission,\n  requireActionPermission,\n  requireAgentPermission,\n  CheckPermission,\n  checkPermissionInService\n};\n