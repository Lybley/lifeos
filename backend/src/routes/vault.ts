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

export default router;\n"}, {"path": "/app/frontend/src/components/vault/VaultSetup.tsx", "content": "/**\n * Vault Setup Component\n * Guides user through vault initialization\n */\n\nimport React, { useState } from 'react';\nimport { validatePassphraseStrength, generateRecoveryKey } from '../../lib/vault/encryption';\nimport { vaultClient } from '../../lib/vault/vaultClient';\n\ninterface VaultSetupProps {\n  userId: string;\n  onComplete: () => void;\n}\n\nexport const VaultSetup: React.FC<VaultSetupProps> = ({ userId, onComplete }) => {\n  const [step, setStep] = useState(1);\n  const [passphrase, setPassphrase] = useState('');\n  const [passphraseConfirm, setPassphraseConfirm] = useState('');\n  const [passphraseHint, setPassphraseHint] = useState('');\n  const [recoveryKey, setRecoveryKey] = useState('');\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState('');\n\n  const passphraseStrength = validatePassphraseStrength(passphrase);\n\n  const handleCreateVault = async () => {\n    if (passphrase !== passphraseConfirm) {\n      setError('Passphrases do not match');\n      return;\n    }\n\n    if (!passphraseStrength.valid) {\n      setError('Passphrase is too weak');\n      return;\n    }\n\n    setLoading(true);\n    setError('');\n\n    try {\n      await vaultClient.initializeVault(userId, passphrase, {\n        passphraseHint,\n        require2FA: false,\n        autoLockMinutes: 15,\n      });\n\n      // Generate recovery key\n      const recovery = generateRecoveryKey();\n      setRecoveryKey(recovery);\n\n      setStep(3); // Show recovery key\n    } catch (err: any) {\n      setError(err.message || 'Failed to create vault');\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const handleFinish = () => {\n    onComplete();\n  };\n\n  return (\n    <div className=\"max-w-2xl mx-auto p-6\">\n      <div className=\"bg-white rounded-lg shadow-lg p-8\">\n        {/* Progress indicator */}\n        <div className=\"flex items-center justify-between mb-8\">\n          {[1, 2, 3].map(i => (\n            <div key={i} className=\"flex items-center\">\n              <div\n                className={`w-10 h-10 rounded-full flex items-center justify-center ${\n                  step >= i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'\n                }`}\n              >\n                {i}\n              </div>\n              {i < 3 && (\n                <div\n                  className={`w-24 h-1 mx-2 ${\n                    step > i ? 'bg-blue-600' : 'bg-gray-200'\n                  }`}\n                />\n              )}\n            </div>\n          ))}\n        </div>\n\n        {/* Step 1: Introduction */}\n        {step === 1 && (\n          <div>\n            <h2 className=\"text-2xl font-bold mb-4\">🔐 Secure Vault Setup</h2>\n            <div className=\"space-y-4 mb-6\">\n              <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">\n                <h3 className=\"font-semibold text-blue-900 mb-2\">\n                  ✅ What is the Vault?\n                </h3>\n                <p className=\"text-blue-800 text-sm\">\n                  A client-side encrypted storage for your most sensitive data.\n                  Your encryption key <strong>never leaves your device</strong>.\n                </p>\n              </div>\n\n              <div className=\"bg-green-50 border border-green-200 rounded-lg p-4\">\n                <h3 className=\"font-semibold text-green-900 mb-2\">\n                  🔒 How it works:\n                </h3>\n                <ul className=\"text-green-800 text-sm space-y-1 list-disc list-inside\">\n                  <li>You create a master passphrase</li>\n                  <li>Encryption happens in your browser using WebCrypto</li>\n                  <li>Server only stores encrypted ciphertext</li>\n                  <li>Only you can decrypt with your passphrase</li>\n                </ul>\n              </div>\n\n              <div className=\"bg-yellow-50 border border-yellow-200 rounded-lg p-4\">\n                <h3 className=\"font-semibold text-yellow-900 mb-2\">\n                  ⚠️ Important:\n                </h3>\n                <ul className=\"text-yellow-800 text-sm space-y-1 list-disc list-inside\">\n                  <li>If you forget your passphrase, data cannot be recovered</li>\n                  <li>Use a strong, memorable passphrase</li>\n                  <li>Save your recovery key securely</li>\n                </ul>\n              </div>\n            </div>\n\n            <button\n              onClick={() => setStep(2)}\n              className=\"w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700\"\n            >\n              Continue →\n            </button>\n          </div>\n        )}\n\n        {/* Step 2: Create Passphrase */}\n        {step === 2 && (\n          <div>\n            <h2 className=\"text-2xl font-bold mb-4\">Create Master Passphrase</h2>\n\n            {error && (\n              <div className=\"bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4\">\n                {error}\n              </div>\n            )}\n\n            <div className=\"space-y-4\">\n              <div>\n                <label className=\"block text-sm font-medium mb-2\">\n                  Master Passphrase *\n                </label>\n                <input\n                  type=\"password\"\n                  value={passphrase}\n                  onChange={e => setPassphrase(e.target.value)}\n                  className=\"w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500\"\n                  placeholder=\"Enter a strong passphrase\"\n                />\n                {passphrase && (\n                  <div className=\"mt-2\">\n                    <div className=\"flex items-center gap-2\">\n                      <div className=\"flex-1 bg-gray-200 rounded-full h-2\">\n                        <div\n                          className={`h-2 rounded-full transition-all ${\n                            passphraseStrength.score < 50\n                              ? 'bg-red-500'\n                              : passphraseStrength.score < 70\n                              ? 'bg-yellow-500'\n                              : 'bg-green-500'\n                          }`}\n                          style={{ width: `${passphraseStrength.score}%` }}\n                        />\n                      </div>\n                      <span className=\"text-sm font-medium\">\n                        {passphraseStrength.score}%\n                      </span>\n                    </div>\n                    {passphraseStrength.feedback.length > 0 && (\n                      <ul className=\"mt-2 text-sm text-gray-600 space-y-1\">\n                        {passphraseStrength.feedback.map((fb, i) => (\n                          <li key={i}>• {fb}</li>\n                        ))}\n                      </ul>\n                    )}\n                  </div>\n                )}\n              </div>\n\n              <div>\n                <label className=\"block text-sm font-medium mb-2\">\n                  Confirm Passphrase *\n                </label>\n                <input\n                  type=\"password\"\n                  value={passphraseConfirm}\n                  onChange={e => setPassphraseConfirm(e.target.value)}\n                  className=\"w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500\"\n                  placeholder=\"Re-enter your passphrase\"\n                />\n              </div>\n\n              <div>\n                <label className=\"block text-sm font-medium mb-2\">\n                  Passphrase Hint (Optional)\n                </label>\n                <input\n                  type=\"text\"\n                  value={passphraseHint}\n                  onChange={e => setPassphraseHint(e.target.value)}\n                  className=\"w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500\"\n                  placeholder=\"A hint to help you remember\"\n                />\n                <p className=\"text-xs text-gray-500 mt-1\">\n                  Make it memorable but not obvious to others\n                </p>\n              </div>\n            </div>\n\n            <div className=\"flex gap-3 mt-6\">\n              <button\n                onClick={() => setStep(1)}\n                className=\"flex-1 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50\"\n              >\n                ← Back\n              </button>\n              <button\n                onClick={handleCreateVault}\n                disabled={loading || !passphraseStrength.valid || passphrase !== passphraseConfirm}\n                className=\"flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed\"\n              >\n                {loading ? 'Creating...' : 'Create Vault →'}\n              </button>\n            </div>\n          </div>\n        )}\n\n        {/* Step 3: Recovery Key */}\n        {step === 3 && (\n          <div>\n            <h2 className=\"text-2xl font-bold mb-4\">✅ Vault Created!</h2>\n\n            <div className=\"bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6\">\n              <h3 className=\"font-bold text-red-900 mb-3 flex items-center gap-2\">\n                <span className=\"text-2xl\">⚠️</span>\n                Save Your Recovery Key\n              </h3>\n              <p className=\"text-red-800 mb-4\">\n                This recovery key can restore access if you forget your passphrase.\n                Store it securely - you won't see it again!\n              </p>\n\n              <div className=\"bg-white p-4 rounded border border-red-300 font-mono text-sm break-all\">\n                {recoveryKey}\n              </div>\n\n              <button\n                onClick={() => navigator.clipboard.writeText(recoveryKey)}\n                className=\"mt-3 text-red-900 font-semibold hover:underline\"\n              >\n                📋 Copy to Clipboard\n              </button>\n            </div>\n\n            <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6\">\n              <h3 className=\"font-semibold mb-2\">Recommended: Store in multiple secure locations</h3>\n              <ul className=\"text-sm space-y-1 list-disc list-inside\">\n                <li>Password manager</li>\n                <li>Encrypted USB drive</li>\n                <li>Secure physical location</li>\n              </ul>\n            </div>\n\n            <div className=\"flex items-center gap-3 mb-6\">\n              <input\n                type=\"checkbox\"\n                id=\"confirm-saved\"\n                className=\"w-5 h-5\"\n                onChange={e => setError(e.target.checked ? '' : 'Please confirm')}\n              />\n              <label htmlFor=\"confirm-saved\" className=\"text-sm font-medium\">\n                I have saved my recovery key in a secure location\n              </label>\n            </div>\n\n            <button\n              onClick={handleFinish}\n              className=\"w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700\"\n            >\n              Complete Setup\n            </button>\n          </div>\n        )}\n      </div>\n    </div>\n  );\n};\n"}]