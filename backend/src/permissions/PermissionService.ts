/**
 * Permission Service
 * 
 * Core service for managing permissions and consent
 */

import { Pool } from 'pg';
import logger from '../utils/logger';
import {
  Permission,
  PermissionScope,
  PermissionStatus,
  PermissionCheckResult,
  ScopeDefinition,
  ConsentAuditLog,
  BulkPermissionGrant,
  ConsentVersion
} from './types';

export class PermissionService {
  private db: Pool;
  
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    scope: PermissionScope
  ): Promise<PermissionCheckResult> {
    try {
      const result = await this.db.query(
        'SELECT has_permission($1, $2) AS allowed',
        [userId, scope]
      );
      
      const allowed = result.rows[0]?.allowed || false;
      
      if (!allowed) {
        return {
          allowed: false,
          scope,
          reason: 'Permission not granted or expired'
        };
      }
      
      // Get permission details
      const permission = await this.getPermission(userId, scope);
      
      return {
        allowed: true,
        scope,
        permission
      };
      
    } catch (error) {
      logger.error('Failed to check permission', { error, userId, scope });
      return {
        allowed: false,
        scope,
        reason: 'Error checking permission'
      };
    }
  }
  
  /**
   * Check multiple permissions at once
   */
  async hasPermissions(
    userId: string,
    scopes: PermissionScope[]
  ): Promise<Record<PermissionScope, PermissionCheckResult>> {
    const results: Record<string, PermissionCheckResult> = {};
    
    await Promise.all(
      scopes.map(async (scope) => {
        results[scope] = await this.hasPermission(userId, scope);
      })
    );
    
    return results;
  }
  
  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: string,
    scope: PermissionScope,
    options: {
      expiresAt?: Date;
      grantedBy?: string;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string> {
    try {
      const result = await this.db.query(
        `SELECT grant_permission($1, $2, $3, $4, $5, $6, $7) AS permission_id`,
        [
          userId,
          scope,
          options.expiresAt || null,
          options.grantedBy || 'user',
          options.reason || null,
          options.ipAddress || null,
          options.userAgent || null
        ]
      );
      
      const permissionId = result.rows[0].permission_id;
      
      logger.info('Permission granted', { userId, scope, permissionId });
      
      return permissionId;
      
    } catch (error) {
      logger.error('Failed to grant permission', { error, userId, scope });
      throw error;
    }
  }
  
  /**
   * Grant multiple permissions at once
   */
  async grantPermissions(
    userId: string,
    grant: BulkPermissionGrant,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string[]> {
    const permissionIds: string[] = [];
    
    for (const scope of grant.scopes) {
      const id = await this.grantPermission(userId, scope, {
        expiresAt: grant.expiresAt,
        reason: grant.reason,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      });
      permissionIds.push(id);
    }
    
    return permissionIds;
  }
  
  /**
   * Revoke permission from user
   */
  async revokePermission(
    userId: string,
    scope: PermissionScope,
    options: {
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT revoke_permission($1, $2, $3, $4, $5) AS revoked',
        [
          userId,
          scope,
          options.reason || null,
          options.ipAddress || null,
          options.userAgent || null
        ]
      );
      
      const revoked = result.rows[0]?.revoked || false;
      
      if (revoked) {
        logger.info('Permission revoked', { userId, scope });
      } else {
        logger.warn('Permission not found for revocation', { userId, scope });
      }
      
      return revoked;
      
    } catch (error) {
      logger.error('Failed to revoke permission', { error, userId, scope });
      throw error;
    }
  }
  
  /**
   * Revoke all permissions for user
   */
  async revokeAllPermissions(
    userId: string,
    reason?: string
  ): Promise<number> {
    try {
      const permissions = await this.getUserPermissions(userId, 'active');
      
      let revokedCount = 0;
      for (const permission of permissions) {
        const revoked = await this.revokePermission(userId, permission.scope, { reason });
        if (revoked) revokedCount++;
      }
      
      logger.info('All permissions revoked', { userId, count: revokedCount });
      
      return revokedCount;
      
    } catch (error) {
      logger.error('Failed to revoke all permissions', { error, userId });
      throw error;
    }
  }
  
  /**
   * Get specific permission
   */
  async getPermission(
    userId: string,
    scope: PermissionScope
  ): Promise<Permission | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM permissions
         WHERE user_id = $1 AND scope = $2 AND status = 'active'
         ORDER BY granted_at DESC
         LIMIT 1`,
        [userId, scope]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToPermission(result.rows[0]);
      
    } catch (error) {
      logger.error('Failed to get permission', { error, userId, scope });
      return null;
    }
  }
  
  /**
   * Get all user permissions
   */
  async getUserPermissions(
    userId: string,
    status?: PermissionStatus
  ): Promise<Permission[]> {
    try {
      const query = status
        ? 'SELECT * FROM permissions WHERE user_id = $1 AND status = $2 ORDER BY granted_at DESC'
        : 'SELECT * FROM permissions WHERE user_id = $1 ORDER BY granted_at DESC';
      
      const params = status ? [userId, status] : [userId];
      
      const result = await this.db.query(query, params);
      
      return result.rows.map(row => this.mapRowToPermission(row));
      
    } catch (error) {
      logger.error('Failed to get user permissions', { error, userId });
      return [];
    }
  }
  
  /**
   * Get all scope definitions
   */
  async getScopeDefinitions(): Promise<ScopeDefinition[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM scope_definitions ORDER BY risk_level, category, name'
      );
      
      return result.rows.map(row => ({
        scope: row.scope,
        name: row.name,
        description: row.description,
        category: row.category,
        riskLevel: row.risk_level,
        defaultEnabled: row.default_enabled,
        requiresExplicitConsent: row.requires_explicit_consent,
        version: row.version,
        scopeHash: row.scope_hash
      }));
      
    } catch (error) {
      logger.error('Failed to get scope definitions', { error });
      return [];
    }
  }
  
  /**
   * Get audit log for user
   */
  async getAuditLog(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: string;
      scope?: PermissionScope;
    } = {}
  ): Promise<ConsentAuditLog[]> {
    try {
      let query = 'SELECT * FROM consent_audit_log WHERE user_id = $1';
      const params: any[] = [userId];
      let paramIndex = 2;
      
      if (options.action) {
        query += ` AND action = $${paramIndex}`;
        params.push(options.action);
        paramIndex++;
      }
      
      if (options.scope) {
        query += ` AND scope = $${paramIndex}`;
        params.push(options.scope);
        paramIndex++;
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }
      
      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
      }
      
      const result = await this.db.query(query, params);
      
      return result.rows.map(row => this.mapRowToAuditLog(row));
      
    } catch (error) {
      logger.error('Failed to get audit log', { error, userId });
      return [];
    }
  }
  
  /**
   * Log permission usage
   */
  async logUsage(
    userId: string,
    scope: PermissionScope,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.db.query(
        'SELECT log_permission_usage($1, $2, $3)',
        [userId, scope, JSON.stringify(metadata)]
      );
      
    } catch (error) {
      logger.error('Failed to log permission usage', { error, userId, scope });
    }
  }
  
  /**
   * Expire permissions (should be run periodically)
   */
  async expirePermissions(): Promise<number> {
    try {
      const result = await this.db.query('SELECT expire_permissions() AS count');
      const count = result.rows[0]?.count || 0;
      
      if (count > 0) {
        logger.info('Permissions expired', { count });
      }
      
      return count;
      
    } catch (error) {
      logger.error('Failed to expire permissions', { error });
      return 0;
    }
  }
  
  /**
   * Get permission summary by category
   */
  async getPermissionSummary(userId: string): Promise<any> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_permission_summary WHERE user_id = $1',
        [userId]
      );
      
      return result.rows;
      
    } catch (error) {
      logger.error('Failed to get permission summary', { error, userId });
      return [];
    }
  }
  
  /**
   * Helper: Map database row to Permission
   */
  private mapRowToPermission(row: any): Permission {
    return {
      id: row.id,
      userId: row.user_id,
      scope: row.scope,
      status: row.status,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      grantedBy: row.granted_by,
      reason: row.reason,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      consentVersion: row.consent_version,
      scopeHash: row.scope_hash
    };
  }
  
  /**
   * Helper: Map database row to ConsentAuditLog
   */
  private mapRowToAuditLog(row: any): ConsentAuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      permissionId: row.permission_id,
      action: row.action,
      scope: row.scope,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      reason: row.reason,
      metadata: row.metadata
    };
  }
}

export default PermissionService;
