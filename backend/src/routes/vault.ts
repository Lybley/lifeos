/**
 * Vault API Routes
 * Server stores ONLY encrypted data - never sees keys or plaintext
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { postgresClient as db } from '../config/postgres';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /api/v1/vault/config/:userId
 * Get vault configuration (includes KDF parameters, but never the key)
 */
router.get('/config/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const config = await db.query(
      'SELECT * FROM vault_config WHERE user_id = $1',
      [userId]
    );

    if (config.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Log access
    await db.query(
      `INSERT INTO vault_audit_log (user_id, action, success) 
       VALUES ($1, 'get_config', true)`,
      [userId]
    );

    res.json(config.rows[0]);
  } catch (error) {
    logger.error('Get vault config error:', error);
    res.status(500).json({ error: 'Failed to get vault config' });
  }
});

/**
 * POST /api/v1/vault/initialize
 * Initialize new vault for user
 */
router.post(
  '/initialize',
  [
    body('userId').isString().notEmpty(),
    body('kdfSaltHex').isString().notEmpty(),
    body('kdfIterations').isInt({ min: 10000 }),
    body('passphraseHint').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        userId,
        kdfSaltHex,
        kdfIterations,
        kdfAlgorithm = 'PBKDF2',
        kdfHash = 'SHA-256',
        passphraseHint,
        require2FA = false,
        autoLockMinutes = 15,
      } = req.body;

      // Check if vault already exists
      const existing = await db.query(
        'SELECT id FROM vault_config WHERE user_id = $1',
        [userId]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Vault already exists' });
      }

      // Check admin settings
      const adminSettings = await db.query(
        'SELECT * FROM vault_admin_settings LIMIT 1'
      );

      if (adminSettings.rows.length > 0) {
        const settings = adminSettings.rows[0];
        
        if (!settings.vault_feature_enabled || !settings.allow_new_vaults) {
          return res.status(403).json({ 
            error: 'Vault creation is currently disabled' 
          });
        }

        if (kdfIterations < settings.min_kdf_iterations) {
          return res.status(400).json({
            error: `KDF iterations must be at least ${settings.min_kdf_iterations}`,
          });
        }
      }

      // Create vault config
      const result = await db.query(
        `INSERT INTO vault_config (
          user_id, vault_enabled, kdf_algorithm, kdf_iterations, 
          kdf_salt_hex, kdf_hash, passphrase_hint, require_2fa, 
          auto_lock_minutes, vault_created_at
        ) VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          userId,
          kdfAlgorithm,
          kdfIterations,
          kdfSaltHex,
          kdfHash,
          passphraseHint,
          require2FA,
          autoLockMinutes,
        ]
      );

      // Log vault creation
      await db.query(
        `INSERT INTO vault_audit_log (user_id, action, success) 
         VALUES ($1, 'vault_created', true)`,
        [userId]
      );

      logger.info(`Vault initialized for user ${userId}`);

      res.json({
        message: 'Vault initialized successfully',
        config: result.rows[0],
      });
    } catch (error) {
      logger.error('Vault initialization error:', error);
      res.status(500).json({ error: 'Failed to initialize vault' });
    }
  }
);

/**
 * POST /api/v1/vault/verify-unlock/:userId
 * Verify vault unlock (without storing anything)
 */
router.post('/verify-unlock/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user has vault
    const config = await db.query(
      'SELECT * FROM vault_config WHERE user_id = $1',
      [userId]
    );

    if (config.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const vaultConfig = config.rows[0];

    // Check if locked due to failed attempts
    if (vaultConfig.locked_until && new Date(vaultConfig.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Vault is temporarily locked',
        lockedUntil: vaultConfig.locked_until,
      });
    }

    // Update last unlocked timestamp
    await db.query(
      'UPDATE vault_config SET last_unlocked_at = NOW() WHERE user_id = $1',
      [userId]
    );

    // Reset failed attempts
    await db.query(
      'UPDATE vault_config SET failed_unlock_attempts = 0 WHERE user_id = $1',
      [userId]
    );

    // Log successful unlock
    await db.query(
      `INSERT INTO vault_audit_log (user_id, action, success) 
       VALUES ($1, 'unlock', true)`,
      [userId]
    );

    res.json({ success: true, message: 'Vault unlocked' });
  } catch (error) {
    logger.error('Vault unlock verification error:', error);
    res.status(500).json({ error: 'Unlock verification failed' });
  }
});

/**
 * POST /api/v1/vault/items
 * Store encrypted item (server never sees plaintext)
 */
router.post(
  '/items',
  [
    body('userId').isString().notEmpty(),
    body('nodeType').isString().notEmpty(),
    body('encryptedLabel').isString().notEmpty(),
    body('labelIv').isString().notEmpty(),
    body('encryptedData').isString().notEmpty(),
    body('encryptionIv').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        userId,
        nodeType,
        encryptedLabel,
        labelIv,
        encryptedData,
        encryptionIv,
        metadata = {},
      } = req.body;

      // Check vault exists and is enabled
      const config = await db.query(
        'SELECT vault_enabled FROM vault_config WHERE user_id = $1',
        [userId]
      );

      if (config.rows.length === 0 || !config.rows[0].vault_enabled) {
        return res.status(403).json({ error: 'Vault not available' });
      }

      // Check item limit
      const itemCount = await db.query(
        'SELECT COUNT(*) FROM vault_nodes WHERE user_id = $1 AND deleted_at IS NULL',
        [userId]
      );

      const adminSettings = await db.query(
        'SELECT max_vault_items FROM vault_admin_settings LIMIT 1'
      );

      if (adminSettings.rows.length > 0) {
        const maxItems = adminSettings.rows[0].max_vault_items;
        if (parseInt(itemCount.rows[0].count) >= maxItems) {
          return res.status(429).json({
            error: `Vault item limit reached (${maxItems})`,
          });
        }
      }

      // Store encrypted item
      const result = await db.query(
        `INSERT INTO vault_nodes (
          user_id, node_type, node_label, encrypted_data, 
          encryption_iv, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at`,
        [
          userId,
          nodeType,
          encryptedLabel,
          encryptedData,
          encryptionIv,
          JSON.stringify(metadata),
        ]
      );

      // Also store label IV as metadata for decryption
      await db.query(
        'UPDATE vault_nodes SET metadata = jsonb_set(metadata, $1, $2) WHERE id = $3',
        ['{label_iv}', JSON.stringify(labelIv), result.rows[0].id]
      );

      // Log
      await db.query(
        `INSERT INTO vault_audit_log (user_id, action, node_id, success) 
         VALUES ($1, 'create_node', $2, true)`,
        [userId, result.rows[0].id]
      );

      logger.info(`Vault item created: ${result.rows[0].id}`);

      res.json({
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
      });
    } catch (error) {
      logger.error('Store vault item error:', error);
      res.status(500).json({ error: 'Failed to store item' });
    }
  }
);

/**
 * GET /api/v1/vault/items/:itemId
 * Get encrypted item
 */
router.get('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    const item = await db.query(
      `SELECT * FROM vault_nodes WHERE id = $1 AND deleted_at IS NULL`,
      [itemId]
    );

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemData = item.rows[0];

    // Update access tracking
    await db.query(
      `UPDATE vault_nodes 
       SET last_accessed_at = NOW(), access_count = access_count + 1
       WHERE id = $1`,
      [itemId]
    );

    // Log access
    await db.query(
      `INSERT INTO vault_audit_log (user_id, action, node_id, success) 
       VALUES ($1, 'access_node', $2, true)`,
      [itemData.user_id, itemId]
    );

    // Extract label IV from metadata
    const labelIv = itemData.metadata?.label_iv || '';

    res.json({
      id: itemData.id,
      user_id: itemData.user_id,
      node_type: itemData.node_type,
      node_label: itemData.node_label,
      label_iv: labelIv,
      encrypted_data: itemData.encrypted_data,
      encryption_iv: itemData.encryption_iv,
      metadata: itemData.metadata,
      created_at: itemData.created_at,
      updated_at: itemData.updated_at,
      last_accessed_at: itemData.last_accessed_at,
    });
  } catch (error) {
    logger.error('Get vault item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

/**
 * GET /api/v1/vault/items
 * List encrypted items for user
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const { userId, nodeType } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let query = `
      SELECT id, user_id, node_type, node_label, metadata, 
             created_at, updated_at, last_accessed_at
      FROM vault_nodes 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (nodeType) {
      query += ` AND node_type = $2`;
      params.push(nodeType);
    }

    query += ` ORDER BY updated_at DESC`;

    const items = await db.query(query, params);

    // Extract label IVs
    const itemsWithIvs = items.rows.map(item => ({
      ...item,
      label_iv: item.metadata?.label_iv || '',
    }));

    res.json(itemsWithIvs);
  } catch (error) {
    logger.error('List vault items error:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

/**
 * DELETE /api/v1/vault/items/:itemId
 * Soft delete vault item
 */
router.delete('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    const item = await db.query(
      'SELECT user_id FROM vault_nodes WHERE id = $1',
      [itemId]
    );

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Soft delete
    await db.query(
      'UPDATE vault_nodes SET deleted_at = NOW() WHERE id = $1',
      [itemId]
    );

    // Log
    await db.query(
      `INSERT INTO vault_audit_log (user_id, action, node_id, success) 
       VALUES ($1, 'delete_node', $2, true)`,
      [item.rows[0].user_id, itemId]
    );

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    logger.error('Delete vault item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

/**
 * GET /api/v1/vault/audit/:userId
 * Get audit log for user's vault
 */
router.get('/audit/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;

    const audit = await db.query(
      `SELECT * FROM vault_audit_log 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    res.json(audit.rows);
  } catch (error) {
    logger.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

export default router;]