/**
 * Vault Client API
 * Handles all vault operations with automatic encryption/decryption
 */

import {
  deriveKeyFromPassphrase,
  encryptData,
  decryptData,
  hexToBytes,
  generateRandomBytes,
  bytesToHex,
  type VaultConfig,
  type EncryptedData,
} from './encryption';

export interface VaultItem {
  id: string;
  nodeType: string;
  nodeLabel: string;
  data: any; // Decrypted data
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export interface VaultUnlockOptions {
  passphrase: string;
  remember?: boolean; // Keep unlocked for session
  require2FA?: boolean;
}

export class VaultClient {
  private apiBaseUrl: string;
  private encryptionKey: CryptoKey | null = null;
  private vaultConfig: VaultConfig | null = null;
  private sessionToken: string | null = null;

  constructor(apiBaseUrl: string = '/api/v1/vault') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Check if vault exists for user
   */
  async checkVaultExists(userId: string): Promise<boolean> {
    const response = await fetch(`${this.apiBaseUrl}/config/${userId}`);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error('Failed to check vault status');
    return true;
  }

  /**
   * Initialize new vault
   */
  async initializeVault(
    userId: string,
    passphrase: string,
    options?: {
      passphraseHint?: string;
      require2FA?: boolean;
      autoLockMinutes?: number;
    }
  ): Promise<void> {
    // Generate salt
    const salt = generateRandomBytes(32);
    const saltHex = bytesToHex(salt);

    // Derive key (client-side only)
    const iterations = 100000;
    this.encryptionKey = await deriveKeyFromPassphrase(
      passphrase,
      salt,
      iterations,
      'SHA-256'
    );

    // Store vault config on server (no key or passphrase sent)
    const response = await fetch(`${this.apiBaseUrl}/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        kdfSaltHex: saltHex,
        kdfIterations: iterations,
        kdfAlgorithm: 'PBKDF2',
        kdfHash: 'SHA-256',
        passphraseHint: options?.passphraseHint,
        require2FA: options?.require2FA,
        autoLockMinutes: options?.autoLockMinutes || 15,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to initialize vault');
    }

    const data = await response.json();
    this.vaultConfig = data.config;
  }

  /**
   * Unlock vault with passphrase
   */
  async unlock(
    userId: string,
    options: VaultUnlockOptions
  ): Promise<{ success: boolean; message?: string }> {
    // Get vault config
    const configResponse = await fetch(`${this.apiBaseUrl}/config/${userId}`);
    if (!configResponse.ok) {
      throw new Error('Vault not found');
    }

    const configData = await configResponse.json();
    this.vaultConfig = configData;

    // Derive key from passphrase
    const salt = hexToBytes(this.vaultConfig.kdf_salt_hex);
    try {
      this.encryptionKey = await deriveKeyFromPassphrase(
        options.passphrase,
        salt,
        this.vaultConfig.kdf_iterations,
        this.vaultConfig.kdf_hash as 'SHA-256' | 'SHA-512'
      );

      // Verify by attempting to decrypt a test item
      const verifyResponse = await fetch(
        `${this.apiBaseUrl}/verify-unlock/${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!verifyResponse.ok) {
        this.encryptionKey = null;
        return { success: false, message: 'Incorrect passphrase' };
      }

      return { success: true };
    } catch (error) {
      this.encryptionKey = null;
      return { success: false, message: 'Decryption failed' };
    }
  }

  /**
   * Lock vault (clear encryption key from memory)
   */
  lock(): void {
    this.encryptionKey = null;
    this.sessionToken = null;
  }

  /**
   * Check if vault is unlocked
   */
  isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Store encrypted item in vault
   */
  async storeItem(
    userId: string,
    nodeType: string,
    nodeLabel: string,
    data: any,
    metadata?: any
  ): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Vault is locked');
    }

    // Encrypt data client-side
    const encrypted = await encryptData(data, this.encryptionKey);

    // Encrypt label as well
    const encryptedLabel = await encryptData(
      { label: nodeLabel },
      this.encryptionKey
    );

    // Send to server (only ciphertext)
    const response = await fetch(`${this.apiBaseUrl}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        nodeType,
        encryptedLabel: encryptedLabel.ciphertext,
        labelIv: encryptedLabel.iv,
        encryptedData: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        metadata, // Metadata stays unencrypted for filtering
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to store item');
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Retrieve and decrypt vault item
   */
  async getItem(itemId: string): Promise<VaultItem> {
    if (!this.encryptionKey) {
      throw new Error('Vault is locked');
    }

    const response = await fetch(`${this.apiBaseUrl}/items/${itemId}`);
    if (!response.ok) {
      throw new Error('Item not found');
    }

    const encryptedItem = await response.json();

    // Decrypt label
    const labelData = await decryptData(
      {
        ciphertext: encryptedItem.node_label,
        iv: encryptedItem.label_iv,
      },
      this.encryptionKey
    );

    // Decrypt data
    const decryptedData = await decryptData(
      {
        ciphertext: encryptedItem.encrypted_data,
        iv: encryptedItem.encryption_iv,
      },
      this.encryptionKey
    );

    return {
      id: encryptedItem.id,
      nodeType: encryptedItem.node_type,
      nodeLabel: labelData.label,
      data: decryptedData,
      metadata: encryptedItem.metadata,
      createdAt: encryptedItem.created_at,
      updatedAt: encryptedItem.updated_at,
      lastAccessedAt: encryptedItem.last_accessed_at,
    };
  }

  /**
   * List vault items (labels encrypted, metadata visible)
   */
  async listItems(
    userId: string,
    filters?: { nodeType?: string; tags?: string[] }
  ): Promise<Array<Omit<VaultItem, 'data'>>> {
    if (!this.encryptionKey) {
      throw new Error('Vault is locked');
    }

    const params = new URLSearchParams({ userId });
    if (filters?.nodeType) params.append('nodeType', filters.nodeType);

    const response = await fetch(`${this.apiBaseUrl}/items?${params}`);
    if (!response.ok) {
      throw new Error('Failed to list items');
    }

    const items = await response.json();

    // Decrypt labels
    const decryptedItems = await Promise.all(
      items.map(async (item: any) => {
        const labelData = await decryptData(
          {
            ciphertext: item.node_label,
            iv: item.label_iv,
          },
          this.encryptionKey!
        );

        return {
          id: item.id,
          nodeType: item.node_type,
          nodeLabel: labelData.label,
          metadata: item.metadata,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      })
    );

    return decryptedItems;
  }

  /**
   * Delete vault item
   */
  async deleteItem(itemId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/items/${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete item');
    }
  }

  /**
   * Export all vault data (for backup)
   */
  async exportVault(userId: string, passphrase: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Vault is locked');
    }

    const items = await this.listItems(userId);
    const fullItems = await Promise.all(
      items.map(item => this.getItem(item.id))
    );

    // Create backup object
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      vaultConfig: this.vaultConfig,
      items: fullItems,
    };

    // Encrypt entire backup with passphrase
    const backupKey = await deriveKeyFromPassphrase(
      passphrase,
      hexToBytes(this.vaultConfig!.kdf_salt_hex),
      this.vaultConfig!.kdf_iterations,
      this.vaultConfig!.kdf_hash as 'SHA-256'
    );

    const encrypted = await encryptData(backup, backupKey);

    return JSON.stringify(encrypted);
  }
}

// Singleton instance
export const vaultClient = new VaultClient();
