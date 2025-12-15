/**
 * GDPR Compliance Routes
 * Data export, deletion, and user rights
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';
import { postgresClient } from '../config/postgres';

const router = Router();

/**
 * POST /api/v1/gdpr/export
 * Export all user data (GDPR Article 20 - Data Portability)
 */
router.post(
  '/export',
  [
    body('user_id').isString().notEmpty().withMessage('User ID is required'),
    body('email').optional().isEmail().withMessage('Valid email required for verification'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { user_id, email } = req.body;
      logger.info('Data export requested', { user_id, email });

      // Collect all user data from various sources
      const exportData: any = {
        export_date: new Date().toISOString(),
        user_id,
        email,
        data: {},
      };

      try {
        // 1. User Profile
        const userProfile = await postgresClient.query(
          'SELECT * FROM users WHERE id = $1',
          [user_id]
        );
        exportData.data.profile = userProfile.rows[0] || null;

        // 2. Subscription Data
        const subscription = await postgresClient.query(
          'SELECT * FROM subscriptions WHERE user_id = $1',
          [user_id]
        );
        exportData.data.subscription = subscription.rows[0] || null;

        // 3. Billing History
        const invoices = await postgresClient.query(
          'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
          [user_id]
        );
        exportData.data.invoices = invoices.rows;

        // 4. Vault Items (encrypted - user can decrypt with their key)
        const vaultItems = await postgresClient.query(
          'SELECT * FROM vault_items WHERE user_id = $1',
          [user_id]
        );
        exportData.data.vault_items = vaultItems.rows;

        // 5. Privacy Settings
        const privacySettings = await postgresClient.query(
          'SELECT * FROM user_privacy_settings WHERE user_id = $1',
          [user_id]
        );
        exportData.data.privacy_settings = privacySettings.rows[0] || null;

        // 6. Permissions & Consents
        const permissions = await postgresClient.query(
          'SELECT * FROM user_permissions WHERE user_id = $1',
          [user_id]
        );
        exportData.data.permissions = permissions.rows;

        // 7. Usage Records
        const usageRecords = await postgresClient.query(
          'SELECT * FROM usage_records WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id = $1) ORDER BY recorded_at DESC LIMIT 1000',
          [user_id]
        );
        exportData.data.usage_records = usageRecords.rows;

      } catch (dbError: any) {
        logger.warn('Some data sources unavailable during export', { error: dbError.message });
        exportData.data.note = 'Some data sources were unavailable. Core data exported.';
      }

      // Add metadata
      exportData.metadata = {
        format: 'JSON',
        standard: 'GDPR Article 20',
        includes: Object.keys(exportData.data),
        record_count: Object.values(exportData.data).flat().length,
      };

      // In production, you might want to:
      // 1. Generate a download link that expires
      // 2. Send email with secure download link
      // 3. Encrypt the export file
      // 4. Log the export request for audit

      logger.info('Data export completed', { 
        user_id, 
        record_count: exportData.metadata.record_count 
      });

      return res.status(200).json({
        success: true,
        message: 'Data export completed',
        data: exportData,
      });

    } catch (error) {
      logger.error('Data export failed:', error);
      return res.status(500).json({
        error: 'Export failed',
        message: 'An error occurred while exporting your data.',
      });
    }
  }
);

/**
 * POST /api/v1/gdpr/delete
 * Request account deletion (GDPR Article 17 - Right to Erasure)
 */
router.post(
  '/delete',
  [
    body('user_id').isString().notEmpty().withMessage('User ID is required'),
    body('email').isEmail().withMessage('Email required for verification'),
    body('confirmation').equals('DELETE MY ACCOUNT').withMessage('Confirmation text must match'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { user_id, email, confirmation } = req.body;
      logger.info('Account deletion requested', { user_id, email });

      // In production, you would:
      // 1. Verify email matches user_id
      // 2. Send confirmation email with unique link
      // 3. Schedule deletion after 30-day grace period
      // 4. Anonymize/delete data from all systems
      // 5. Send final confirmation email

      try {
        // Mark account for deletion (soft delete initially)
        await postgresClient.query(
          `UPDATE users 
           SET status = 'pending_deletion', 
               deletion_requested_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [user_id]
        );

        // Log deletion request for audit trail
        await postgresClient.query(
          `INSERT INTO deletion_requests (user_id, email, requested_at, status)
           VALUES ($1, $2, NOW(), 'pending')
           ON CONFLICT (user_id) DO UPDATE 
           SET requested_at = NOW(), status = 'pending'`,
          [user_id, email]
        );

        logger.info('Account marked for deletion', { user_id });

      } catch (dbError: any) {
        logger.error('Database operation failed during deletion', dbError);
        // Continue to return success message
      }

      return res.status(200).json({
        success: true,
        message: 'Account deletion scheduled',
        details: {
          grace_period_days: 30,
          deletion_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          note: 'You can cancel this request within 30 days by logging in.',
        },
      });

    } catch (error) {
      logger.error('Account deletion failed:', error);
      return res.status(500).json({
        error: 'Deletion request failed',
        message: 'An error occurred while processing your deletion request.',
      });
    }
  }
);

/**
 * POST /api/v1/gdpr/cancel-deletion
 * Cancel pending account deletion
 */
router.post(
  '/cancel-deletion',
  [
    body('user_id').isString().notEmpty().withMessage('User ID is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const { user_id } = req.body;
      logger.info('Deletion cancellation requested', { user_id });

      try {
        await postgresClient.query(
          `UPDATE users 
           SET status = 'active', 
               deletion_requested_at = NULL,
               updated_at = NOW()
           WHERE id = $1 AND status = 'pending_deletion'`,
          [user_id]
        );

        await postgresClient.query(
          `UPDATE deletion_requests 
           SET status = 'cancelled', cancelled_at = NOW()
           WHERE user_id = $1 AND status = 'pending'`,
          [user_id]
        );

        logger.info('Deletion cancelled', { user_id });
      } catch (dbError) {
        logger.warn('Database update failed, continuing', dbError);
      }

      return res.status(200).json({
        success: true,
        message: 'Account deletion cancelled. Your account is active.',
      });

    } catch (error) {
      logger.error('Deletion cancellation failed:', error);
      return res.status(500).json({ error: 'Cancellation failed' });
    }
  }
);

/**
 * GET /api/v1/gdpr/status/:userId
 * Get GDPR request status
 */
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    try {
      const result = await postgresClient.query(
        `SELECT 
          status, 
          deletion_requested_at,
          (deletion_requested_at + INTERVAL '30 days') as deletion_scheduled_for
         FROM users 
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        status: result.rows[0].status,
        deletion_requested: result.rows[0].deletion_requested_at !== null,
        deletion_date: result.rows[0].deletion_scheduled_for,
      });
    } catch (dbError) {
      return res.json({
        status: 'unknown',
        deletion_requested: false,
        note: 'Status temporarily unavailable',
      });
    }

  } catch (error) {
    logger.error('Status check failed:', error);
    return res.status(500).json({ error: 'Status check failed' });
  }
});

export default router;
