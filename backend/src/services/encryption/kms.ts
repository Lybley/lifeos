/**
 * Key Management Service Integration
 * Supports AWS KMS and Google Cloud KMS
 */

import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type KMSProvider = 'aws' | 'gcp' | 'local';

export interface KMSConfig {
  provider: KMSProvider;
  keyId: string;
  region?: string;
  projectId?: string;
}

// ============================================================================
// AWS KMS
// ============================================================================

class AWSKMS {
  private client: KMSClient;
  private keyId: string;

  constructor(keyId: string, region: string = 'us-east-1') {
    this.client = new KMSClient({ region });
    this.keyId = keyId;
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    try {
      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: plaintext,
      });

      const response = await this.client.send(command);
      
      if (!response.CiphertextBlob) {
        throw new Error('No ciphertext returned from KMS');
      }

      return Buffer.from(response.CiphertextBlob);
    } catch (error) {
      logger.error('AWS KMS encryption failed:', error);
      throw new Error('KMS encryption failed');
    }
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    try {
      const command = new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: ciphertext,
      });

      const response = await this.client.send(command);
      
      if (!response.Plaintext) {
        throw new Error('No plaintext returned from KMS');
      }

      return Buffer.from(response.Plaintext);
    } catch (error) {
      logger.error('AWS KMS decryption failed:', error);
      throw new Error('KMS decryption failed');
    }
  }
}

// ============================================================================
// GOOGLE CLOUD KMS
// ============================================================================

class GoogleKMS {
  private client: KeyManagementServiceClient;
  private keyName: string;

  constructor(projectId: string, locationId: string, keyRingId: string, keyId: string) {
    this.client = new KeyManagementServiceClient();
    this.keyName = this.client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    try {
      const [response] = await this.client.encrypt({
        name: this.keyName,
        plaintext: plaintext,
      });

      if (!response.ciphertext) {
        throw new Error('No ciphertext returned from KMS');
      }

      return Buffer.from(response.ciphertext as Uint8Array);
    } catch (error) {
      logger.error('Google KMS encryption failed:', error);
      throw new Error('KMS encryption failed');
    }
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    try {
      const [response] = await this.client.decrypt({
        name: this.keyName,
        ciphertext: ciphertext,
      });

      if (!response.plaintext) {
        throw new Error('No plaintext returned from KMS');
      }

      return Buffer.from(response.plaintext as Uint8Array);
    } catch (error) {
      logger.error('Google KMS decryption failed:', error);
      throw new Error('KMS decryption failed');
    }
  }
}

// ============================================================================
// LOCAL KMS (FOR DEVELOPMENT ONLY)
// ============================================================================

class LocalKMS {
  private key: Buffer;

  constructor() {
    // In production, this would be stored securely
    // For development, we use an environment variable
    const keyHex = process.env.LOCAL_KMS_KEY || '0'.repeat(64);
    this.key = Buffer.from(keyHex, 'hex');
    logger.warn('Using local KMS (development only)');
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    // Simple XOR for demonstration (NOT SECURE)
    // In production, use proper encryption
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    const crypto = require('crypto');
    const iv = ciphertext.slice(0, 16);
    const encrypted = ciphertext.slice(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

// ============================================================================
// KMS MANAGER
// ============================================================================

export class KMSManager {
  private kms: AWSKMS | GoogleKMS | LocalKMS;

  constructor(config: KMSConfig) {
    switch (config.provider) {
      case 'aws':
        this.kms = new AWSKMS(config.keyId, config.region);
        break;
      case 'gcp':
        if (!config.projectId) {
          throw new Error('projectId required for GCP KMS');
        }
        // Parse keyId as: projects/{project}/locations/{location}/keyRings/{keyRing}/cryptoKeys/{key}
        const parts = config.keyId.split('/');
        this.kms = new GoogleKMS(
          config.projectId,
          parts[3],
          parts[5],
          parts[7]
        );
        break;
      case 'local':
        this.kms = new LocalKMS();
        break;
      default:
        throw new Error(`Unsupported KMS provider: ${config.provider}`);
    }
  }

  /**
   * Encrypt data encryption key (DEK) with key encryption key (KEK)
   */
  async encryptDEK(dek: Buffer): Promise<string> {
    const encrypted = await this.kms.encrypt(dek);
    return encrypted.toString('base64');
  }

  /**
   * Decrypt data encryption key (DEK) from key encryption key (KEK)
   */
  async decryptDEK(encryptedDEK: string): Promise<Buffer> {
    const ciphertext = Buffer.from(encryptedDEK, 'base64');
    return await this.kms.decrypt(ciphertext);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createKMS(): KMSManager {
  const provider = (process.env.KMS_PROVIDER || 'local') as KMSProvider;
  const config: KMSConfig = {
    provider,
    keyId: process.env.KMS_KEY_ID || 'local-dev-key',
    region: process.env.AWS_REGION,
    projectId: process.env.GCP_PROJECT_ID,
  };

  return new KMSManager(config);
}

logger.info('KMS service initialized');
