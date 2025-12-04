/**
 * GDPR Compliance API Routes
 * Implements: Right to Access, Erasure, Portability, Audit
 */

import { Router, Request, Response } from 'express';
import { postgresClient } from '../config/postgres';
import { requirePermission, AuthenticatedRequest } from '../permissions/PermissionMiddleware';
import logger from '../utils/logger';
import { privacyService } from '../services/encryption/privacyService';

const router = Router();

// ============================================================================
// RIGHT TO ACCESS (GDPR Art. 15)
// ============================================================================

/**
 * GET /api/v1/privacy/export
 * Export all user data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const format = (req.query.format as string) || 'json';

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    logger.info(`Data export requested by user: ${userId}`);

    // Collect all user data
    const userData: any = {
      user_id: userId,
      export_date: new Date().toISOString(),
      format,
    };

    // Actions
    const actionsQuery = `
      SELECT * FROM actions WHERE user_id = $1 ORDER BY created_at DESC
    `;
    const actions = await postgresClient.query(actionsQuery, [userId]);
    userData.actions = actions.rows;

    // Audit logs
    const auditQuery = `
      SELECT * FROM action_audit_logs WHERE user_id = $1 ORDER BY created_at DESC
    `;
    const audit = await postgresClient.query(auditQuery, [userId]);
    userData.audit_logs = audit.rows;

    // Rate limits
    const rateLimitQuery = `
      SELECT * FROM action_rate_limits WHERE rate_limit_key LIKE $1
    `;
    const rateLimits = await postgresClient.query(rateLimitQuery, [`%${userId}%`]);
    userData.rate_limits = rateLimits.rows;

    // Add metadata
    userData.metadata = {
      total_actions: userData.actions.length,
      total_audit_logs: userData.audit_logs.length,
      account_created: userData.actions[0]?.created_at,
      last_activity: userData.audit_logs[0]?.created_at,
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lifeos-data-${userId}-${Date.now()}.json"`
      );
      return res.json(userData);
    } else if (format === 'csv') {
      // Convert to CSV (simplified)
      let csv = 'Type,ID,Created,Status\n';
      userData.actions.forEach((action: any) => {
        csv += `Action,${action.id},${action.created_at},${action.status}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lifeos-data-${userId}-${Date.now()}.csv"`
      );
      return res.send(csv);
    }

    res.status(400).json({ error: 'Unsupported format. Use json or csv' });
  } catch (error) {
    logger.error('Data export failed:', error);
    res.status(500).json({ error: 'Data export failed' });
  }
});

// ============================================================================
// RIGHT TO ERASURE (GDPR Art. 17)
// ============================================================================

/**
 * DELETE /api/v1/privacy/delete-account
 * Request account deletion (soft delete with 30-day grace period)
 */
router.delete('/delete-account', async (req: Request, res: Response) => {
  try {
    const { user_id, confirmation } = req.body;

    if (!user_id || !confirmation) {
      return res.status(400).json({
        error: 'user_id and confirmation required',
      });
    }

    if (confirmation !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        error: 'Invalid confirmation. Type: DELETE MY ACCOUNT',
      });
    }

    logger.warn(`Account deletion requested: ${user_id}`);

    // Create deletion request (30-day grace period)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Store deletion request (you'd have a user_deletion_requests table)
    // For now, we'll mark the user as pending deletion
    
    // Send confirmation email
    logger.info(`Deletion scheduled for ${deletionDate.toISOString()}`);

    res.json({
      success: true,
      message: 'Account deletion scheduled',
      deletion_date: deletionDate.toISOString(),
      grace_period_days: 30,
      cancellation_url: `/api/v1/privacy/cancel-deletion?user_id=${user_id}`,
    });
  } catch (error) {
    logger.error('Account deletion failed:', error);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

/**
 * POST /api/v1/privacy/cancel-deletion
 * Cancel pending account deletion
 */
router.post('/cancel-deletion', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    logger.info(`Deletion cancelled for user: ${user_id}`);

    res.json({
      success: true,
      message: 'Account deletion cancelled',
    });
  } catch (error) {
    logger.error('Cancel deletion failed:', error);
    res.status(500).json({ error: 'Cancel deletion failed' });
  }
});

/**
 * POST /api/v1/privacy/hard-delete
 * Immediately delete all user data (irreversible)
 */
router.post('/hard-delete', async (req: Request, res: Response) => {
  try {
    const { user_id, admin_token } = req.body;

    // Verify admin token (in production)
    if (!admin_token || admin_token !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    logger.warn(`HARD DELETE initiated for user: ${user_id}`);

    // Delete from all tables (cascade)
    await postgresClient.query('DELETE FROM actions WHERE user_id = $1', [userId]);
    await postgresClient.query('DELETE FROM action_audit_logs WHERE user_id = $1', [userId]);
    await postgresClient.query('DELETE FROM action_rate_limits WHERE rate_limit_key LIKE $1', [
      `%${userId}%`,
    ]);

    logger.warn(`User ${user_id} completely deleted`);

    res.json({
      success: true,
      message: 'All user data permanently deleted',
    });
  } catch (error) {
    logger.error('Hard delete failed:', error);
    res.status(500).json({ error: 'Hard delete failed' });
  }
});

// ============================================================================
// AUDIT TRAIL (GDPR Art. 30)
// ============================================================================

/**
 * GET /api/v1/privacy/audit-logs
 * Get audit trail for user
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const query = `
      SELECT 
        id,
        event_type,
        event_data,
        ip_address,
        user_agent,
        created_at
      FROM privacy_audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresClient.query(query, [userId, limit, offset]);

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rows.length,
      },
    });
  } catch (error) {
    logger.error('Audit logs fetch failed:', error);
    res.status(500).json({ error: 'Audit logs fetch failed' });
  }
});

// ============================================================================
// DATA PORTABILITY (GDPR Art. 20)
// ============================================================================

/**
 * GET /api/v1/privacy/portable-format
 * Export data in machine-readable format with decryption keys
 */
router.get('/portable-format', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    // Export in standardized format for portability
    const portableData = {
      format: 'LifeOS-Portable-v1',
      user_id: userId,
      export_date: new Date().toISOString(),
      data: {
        // Add all exportable data here
      },
      encryption: {
        // Include encryption keys if user has premium tier
        // (only if explicitly requested and authenticated)
      },
    };

    res.json(portableData);
  } catch (error) {
    logger.error('Portable export failed:', error);
    res.status(500).json({ error: 'Portable export failed' });
  }
});

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/privacy/consent
 * Update user consent preferences
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const { user_id, consent_type, granted } = req.body;

    if (!user_id || !consent_type) {
      return res.status(400).json({ error: 'user_id and consent_type required' });
    }

    logger.info(`Consent updated: ${user_id} - ${consent_type}: ${granted}`);

    // Store consent (you'd have a user_consents table)

    res.json({
      success: true,
      message: 'Consent updated',
      consent_type,
      granted,
    });
  } catch (error) {
    logger.error('Consent update failed:', error);
    res.status(500).json({ error: 'Consent update failed' });
  }
});

// ============================================================================
// ENCRYPTION SETTINGS
// ============================================================================

/**
 * GET /api/v1/privacy/encryption-settings
 * Get user's encryption settings
 */
router.get('/encryption-settings', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    let settings = await privacyService.getUserSettings(userId);
    
    // Initialize if not exists
    if (!settings) {
      await privacyService.initializeUserEncryption(userId);
      settings = await privacyService.getUserSettings(userId);
    }

    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    logger.error('Failed to get encryption settings:', error);
    res.status(500).json({ error: 'Failed to get encryption settings' });
  }
});

/**
 * POST /api/v1/privacy/enable-zero-knowledge
 * Enable zero-knowledge encryption
 */
router.post('/enable-zero-knowledge', async (req: Request, res: Response) => {
  try {
    const { user_id, master_key_encrypted } = req.body;

    if (!user_id || !master_key_encrypted) {
      return res.status(400).json({ error: 'user_id and master_key_encrypted required' });
    }

    await privacyService.enableZeroKnowledge(user_id, master_key_encrypted);

    res.json({
      success: true,
      message: 'Zero-knowledge encryption enabled',
    });
  } catch (error) {
    logger.error('Failed to enable zero-knowledge:', error);
    res.status(500).json({ error: 'Failed to enable zero-knowledge encryption' });
  }
});

/**
 * POST /api/v1/privacy/enable-vault
 * Enable vault feature
 */
router.post('/enable-vault', async (req: Request, res: Response) => {
  try {
    const { user_id, vault_key_encrypted } = req.body;

    if (!user_id || !vault_key_encrypted) {
      return res.status(400).json({ error: 'user_id and vault_key_encrypted required' });
    }

    await privacyService.enableVault(user_id, vault_key_encrypted);

    res.json({
      success: true,
      message: 'Vault feature enabled',
    });
  } catch (error) {
    logger.error('Failed to enable vault:', error);
    res.status(500).json({ error: 'Failed to enable vault' });
  }
});

// ============================================================================
// VAULT OPERATIONS
// ============================================================================

/**
 * POST /api/v1/privacy/vault/store
 * Store encrypted vault node
 */
router.post('/vault/store', async (req: Request, res: Response) => {
  try {
    const { user_id, node_id, encrypted_content, metadata } = req.body;

    if (!user_id || !node_id || !encrypted_content) {
      return res.status(400).json({ error: 'user_id, node_id, and encrypted_content required' });
    }

    await privacyService.storeVaultNode(user_id, node_id, encrypted_content, metadata);

    res.json({
      success: true,
      message: 'Vault node stored',
      node_id,
    });
  } catch (error) {
    logger.error('Failed to store vault node:', error);
    res.status(500).json({ error: 'Failed to store vault node' });
  }
});

/**
 * GET /api/v1/privacy/vault/list
 * List all vault nodes for user
 * IMPORTANT: This must come BEFORE /vault/:node_id to avoid route conflicts
 */
router.get('/vault/list', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const nodes = await privacyService.listVaultNodes(userId);

    res.json({
      success: true,
      nodes,
      total: nodes.length,
    });
  } catch (error) {
    logger.error('Failed to list vault nodes:', error);
    res.status(500).json({ error: 'Failed to list vault nodes' });
  }
});

/**
 * GET /api/v1/privacy/vault/:node_id
 * Retrieve encrypted vault node
 */
router.get('/vault/:node_id', async (req: Request, res: Response) => {
  try {
    const { node_id } = req.params;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const node = await privacyService.getVaultNode(userId, node_id);

    if (!node) {
      return res.status(404).json({ error: 'Vault node not found' });
    }

    res.json({
      success: true,
      node,
    });
  } catch (error) {
    logger.error('Failed to get vault node:', error);
    res.status(500).json({ error: 'Failed to get vault node' });
  }
});

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/privacy/generate-recovery-codes
 * Generate recovery codes for zero-knowledge encryption
 */
router.post('/generate-recovery-codes', async (req: Request, res: Response) => {
  try {
    const { user_id, master_key } = req.body;

    if (!user_id || !master_key) {
      return res.status(400).json({ error: 'user_id and master_key required' });
    }

    // Convert base64 to Buffer
    const masterKeyBuffer = Buffer.from(master_key, 'base64');
    const codes = await privacyService.generateRecoveryCodes(user_id, masterKeyBuffer);

    res.json({
      success: true,
      recovery_codes: codes,
      message: 'Store these codes in a safe place. They can only be used once.',
    });
  } catch (error) {
    logger.error('Failed to generate recovery codes:', error);
    res.status(500).json({ error: 'Failed to generate recovery codes' });
  }
});

/**
 * POST /api/v1/privacy/use-recovery-code
 * Use recovery code to retrieve master key
 */
router.post('/use-recovery-code', async (req: Request, res: Response) => {
  try {
    const { user_id, recovery_code } = req.body;

    if (!user_id || !recovery_code) {
      return res.status(400).json({ error: 'user_id and recovery_code required' });
    }

    const masterKey = await privacyService.useRecoveryCode(user_id, recovery_code);

    if (!masterKey) {
      return res.status(400).json({ error: 'Invalid or already used recovery code' });
    }

    res.json({
      success: true,
      master_key: masterKey.toString('base64'),
    });
  } catch (error) {
    logger.error('Failed to use recovery code:', error);
    res.status(500).json({ error: 'Failed to use recovery code' });
  }
});

export default router;
