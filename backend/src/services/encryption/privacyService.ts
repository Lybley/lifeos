/**
 * Privacy Service
 * Integrates encryption with database operations
 */

import { postgresClient } from '../../config/postgres';
import * as crypto from './crypto';
import { KMSManager, createKMS } from './kms';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type EncryptionTier = 'standard' | 'zero-knowledge' | 'vault';

export interface UserEncryptionSettings {
  userId: string;
  encryptionTier: EncryptionTier;
  vaultEnabled: boolean;
  kmsKeyId?: string;
}

export interface VaultNode {
  nodeId: string;
  data: any;
  isVault: boolean;
}

// ============================================================================
// ENCRYPTION SERVICE
// ============================================================================

export class PrivacyService {
  private kms: KMSManager;

  constructor() {
    this.kms = createKMS();
  }

  // ==========================================================================
  // USER ENCRYPTION SETTINGS
  // ==========================================================================

  /**
   * Get user encryption settings
   */
  async getUserSettings(userId: string): Promise<UserEncryptionSettings | null> {
    try {
      const result = await postgresClient.query(
        'SELECT * FROM user_encryption_settings WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        encryptionTier: row.encryption_tier,
        vaultEnabled: row.vault_enabled,
        kmsKeyId: row.kms_key_id,
      };
    } catch (error) {
      logger.error('Failed to get user settings:', error);
      throw error;
    }
  }

  /**
   * Initialize user encryption settings (standard tier)
   */
  async initializeUserEncryption(userId: string): Promise<void> {
    try {
      // Generate a unique DEK for the user
      const dek = crypto.generateKey();
      
      // Encrypt DEK with KMS
      const encryptedDEK = await this.kms.encryptDEK(dek);
      
      // Store encrypted DEK
      await postgresClient.query(
        `INSERT INTO user_encryption_settings (user_id, encryption_tier, vault_enabled, master_key_encrypted, kms_key_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, 'standard', false, encryptedDEK, process.env.KMS_KEY_ID || 'local-dev-key']
      );

      logger.info(`Encryption initialized for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to initialize user encryption:', error);
      throw error;
    }
  }

  /**
   * Enable zero-knowledge encryption for user
   */
  async enableZeroKnowledge(
    userId: string,
    masterKeyEncrypted: string
  ): Promise<void> {
    try {
      await postgresClient.query(
        `UPDATE user_encryption_settings 
         SET encryption_tier = $1, master_key_encrypted = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        ['zero-knowledge', masterKeyEncrypted, userId]
      );

      // Log audit event
      await this.logAuditEvent(userId, 'zero_knowledge_enabled', {
        timestamp: new Date().toISOString(),
      });

      logger.info(`Zero-knowledge encryption enabled for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to enable zero-knowledge:', error);
      throw error;
    }
  }

  /**
   * Enable vault feature for user
   */
  async enableVault(userId: string, vaultKeyEncrypted: string): Promise<void> {
    try {
      await postgresClient.query(
        `UPDATE user_encryption_settings 
         SET vault_enabled = true, vault_key_encrypted = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [vaultKeyEncrypted, userId]
      );

      // Log audit event
      await this.logAuditEvent(userId, 'vault_enabled', {
        timestamp: new Date().toISOString(),
      });

      logger.info(`Vault enabled for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to enable vault:', error);
      throw error;
    }
  }

  // ==========================================================================
  // DATA ENCRYPTION/DECRYPTION
  // ==========================================================================

  /**
   * Encrypt data for user (server-side, standard tier)
   */
  async encryptData(userId: string, data: any): Promise<string> {
    try {
      // Get user's encrypted DEK
      const settings = await this.getUserSettings(userId);
      if (!settings) {
        throw new Error('User encryption settings not found');
      }

      // Decrypt DEK with KMS
      const result = await postgresClient.query(
        'SELECT master_key_encrypted FROM user_encryption_settings WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Encryption key not found');
      }

      const encryptedDEK = result.rows[0].master_key_encrypted;
      const dek = await this.kms.decryptDEK(encryptedDEK);

      // Encrypt data with DEK
      const encrypted = crypto.encryptJSON(data, dek);

      // Securely zero out DEK
      crypto.secureZero(dek);

      return JSON.stringify(encrypted);
    } catch (error) {
      logger.error('Data encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt data for user (server-side, standard tier)
   */
  async decryptData(userId: string, encryptedData: string): Promise<any> {
    try {
      const encrypted = JSON.parse(encryptedData);

      // Get user's encrypted DEK
      const result = await postgresClient.query(
        'SELECT master_key_encrypted FROM user_encryption_settings WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Encryption key not found');
      }

      const encryptedDEK = result.rows[0].master_key_encrypted;
      const dek = await this.kms.decryptDEK(encryptedDEK);

      // Decrypt data with DEK
      const data = crypto.decryptJSON(encrypted, dek);

      // Securely zero out DEK
      crypto.secureZero(dek);

      return data;
    } catch (error) {
      logger.error('Data decryption failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // VAULT OPERATIONS
  // ==========================================================================

  /**
   * Store vault node (client-side encrypted)
   */
  async storeVaultNode(
    userId: string,
    nodeId: string,
    encryptedContent: string,
    metadata: any
  ): Promise<void> {
    try {
      await postgresClient.query(
        `INSERT INTO encrypted_data (user_id, node_id, data_type, encrypted_content, encryption_metadata, is_vault)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (node_id) DO UPDATE
         SET encrypted_content = $4, encryption_metadata = $5, updated_at = CURRENT_TIMESTAMP`,
        [userId, nodeId, 'vault_node', encryptedContent, JSON.stringify(metadata), true]
      );

      // Log vault access
      await this.logAuditEvent(userId, 'vault_node_stored', {
        nodeId,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Vault node stored: ${nodeId}`);
    } catch (error) {
      logger.error('Failed to store vault node:', error);
      throw error;
    }
  }

  /**
   * Retrieve vault node
   */
  async getVaultNode(userId: string, nodeId: string): Promise<any> {
    try {
      const result = await postgresClient.query(
        'SELECT encrypted_content, encryption_metadata FROM encrypted_data WHERE user_id = $1 AND node_id = $2 AND is_vault = true',
        [userId, nodeId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Log vault access
      await this.logAuditEvent(userId, 'vault_node_accessed', {
        nodeId,
        timestamp: new Date().toISOString(),
      });

      return {
        encryptedContent: result.rows[0].encrypted_content,
        metadata: result.rows[0].encryption_metadata,
      };
    } catch (error) {
      logger.error('Failed to get vault node:', error);
      throw error;
    }
  }

  /**
   * List all vault nodes for user
   */
  async listVaultNodes(userId: string): Promise<any[]> {
    try {
      const result = await postgresClient.query(
        'SELECT node_id, data_type, created_at FROM encrypted_data WHERE user_id = $1 AND is_vault = true ORDER BY created_at DESC',
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to list vault nodes:', error);
      throw error;
    }
  }

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  /**
   * Log privacy audit event
   */
  async logAuditEvent(
    userId: string,
    eventType: string,
    eventData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await postgresClient.query(
        `INSERT INTO privacy_audit_logs (user_id, event_type, event_data, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, eventType, JSON.stringify(eventData), ipAddress, userAgent]
      );
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }

  // ==========================================================================
  // KEY ROTATION
  // ==========================================================================

  /**
   * Rotate encryption key for user
   */
  async rotateUserKey(userId: string): Promise<void> {
    try {
      const settings = await this.getUserSettings(userId);
      if (!settings) {
        throw new Error('User not found');
      }

      // Generate new DEK
      const newDEK = crypto.generateKey();
      
      // Encrypt new DEK with KMS
      const encryptedNewDEK = await this.kms.encryptDEK(newDEK);
      
      // Get old DEK
      const result = await postgresClient.query(
        'SELECT master_key_encrypted FROM user_encryption_settings WHERE user_id = $1',
        [userId]
      );
      const encryptedOldDEK = result.rows[0].master_key_encrypted;
      const oldDEK = await this.kms.decryptDEK(encryptedOldDEK);

      // Re-encrypt all user's encrypted data with new DEK
      const dataResult = await postgresClient.query(
        'SELECT id, encrypted_content FROM encrypted_data WHERE user_id = $1 AND is_vault = false',
        [userId]
      );

      for (const row of dataResult.rows) {
        try {
          // Decrypt with old key
          const encrypted = JSON.parse(row.encrypted_content);
          const plaintext = crypto.decrypt(encrypted, oldDEK);
          
          // Re-encrypt with new key
          const reencrypted = crypto.encrypt(plaintext, newDEK);
          
          // Update database
          await postgresClient.query(
            'UPDATE encrypted_data SET encrypted_content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(reencrypted), row.id]
          );
        } catch (err) {
          logger.error(`Failed to re-encrypt data ${row.id}:`, err);
        }
      }

      // Update user's encrypted DEK
      await postgresClient.query(
        'UPDATE user_encryption_settings SET master_key_encrypted = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [encryptedNewDEK, userId]
      );

      // Log rotation
      await postgresClient.query(
        'INSERT INTO key_rotation_history (user_id, rotation_reason) VALUES ($1, $2)',
        [userId, 'scheduled']
      );

      // Securely zero out keys
      crypto.secureZero(oldDEK);
      crypto.secureZero(newDEK);

      logger.info(`Key rotated for user: ${userId}`);
    } catch (error) {
      logger.error('Key rotation failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // RECOVERY CODES
  // ==========================================================================

  /**
   * Generate recovery codes for zero-knowledge encryption
   */
  async generateRecoveryCodes(
    userId: string,
    masterKey: Buffer
  ): Promise<string[]> {
    try {
      const codes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        // Generate random recovery code
        const code = crypto.randomBytes(16).toString('hex');
        codes.push(code);

        // Hash the code
        const codeHash = crypto.hash(code);

        // Encrypt master key with recovery code
        const { key: recoveryKey } = crypto.deriveKeyFromPassphrase(code);
        const encryptedMasterKey = crypto.encrypt(masterKey, recoveryKey);

        // Store in database
        await postgresClient.query(
          'INSERT INTO recovery_codes (user_id, code_hash, encrypted_master_key) VALUES ($1, $2, $3)',
          [userId, codeHash, JSON.stringify(encryptedMasterKey)]
        );

        crypto.secureZero(recoveryKey);
      }

      logger.info(`Generated ${codes.length} recovery codes for user: ${userId}`);
      return codes;
    } catch (error) {
      logger.error('Failed to generate recovery codes:', error);
      throw error;
    }
  }

  /**
   * Use recovery code to retrieve master key
   */
  async useRecoveryCode(userId: string, code: string): Promise<Buffer | null> {
    try {
      const codeHash = crypto.hash(code);

      const result = await postgresClient.query(
        'SELECT id, encrypted_master_key FROM recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used = false',
        [userId, codeHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const encryptedMasterKey = JSON.parse(result.rows[0].encrypted_master_key);
      const { key: recoveryKey } = crypto.deriveKeyFromPassphrase(code);
      const masterKey = crypto.decrypt(encryptedMasterKey, recoveryKey);

      // Mark recovery code as used
      await postgresClient.query(
        'UPDATE recovery_codes SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [result.rows[0].id]
      );

      crypto.secureZero(recoveryKey);

      logger.info(`Recovery code used for user: ${userId}`);
      return masterKey;
    } catch (error) {
      logger.error('Failed to use recovery code:', error);
      return null;
    }
  }
}

// Export singleton instance
export const privacyService = new PrivacyService();
