/**
 * LifeOS Encryption Service
 * Multi-tier encryption using libsodium (sodium-native)
 */

import sodium from 'sodium-native';
import crypto from 'crypto';
import logger from '../../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

const ENCRYPTION_VERSION = 1;
const SALT_BYTES = 16;
const NONCE_BYTES = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
const KEY_BYTES = sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES;
const TAG_BYTES = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;

// Key derivation parameters (Argon2id)
const ARGON2_OPSLIMIT = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE; // 2
const ARGON2_MEMLIMIT = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE; // 64MB
const ARGON2_ALG = sodium.crypto_pwhash_ALG_ARGON2ID13;

// ============================================================================
// TYPES
// ============================================================================

export interface EncryptedData {
  version: number;
  algorithm: string;
  nonce: string; // base64
  salt?: string; // base64 (for passphrase-based)
  ciphertext: string; // base64
  tag: string; // base64
}

export interface VaultKeyPair {
  publicKey: string; // base64
  secretKey: string; // base64 (encrypted)
}

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derive encryption key from passphrase using Argon2id
 * Memory-hard function resistant to GPU/ASIC attacks
 */
export function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Buffer
): { key: Buffer; salt: Buffer } {
  const saltBuffer = salt || Buffer.alloc(SALT_BYTES);
  if (!salt) {
    sodium.randombytes_buf(saltBuffer);
  }

  const key = Buffer.alloc(KEY_BYTES);
  
  const result = sodium.crypto_pwhash(
    key,
    Buffer.from(passphrase, 'utf8'),
    saltBuffer,
    ARGON2_OPSLIMIT,
    ARGON2_MEMLIMIT,
    ARGON2_ALG
  );

  if (result !== 0) {
    throw new Error('Key derivation failed');
  }

  return { key, salt: saltBuffer };
}

/**
 * Generate random encryption key
 */
export function generateKey(): Buffer {
  const key = Buffer.alloc(KEY_BYTES);
  sodium.randombytes_buf(key);
  return key;
}

/**
 * Generate vault key pair for asymmetric encryption
 */
export function generateVaultKeyPair(): VaultKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);
  
  sodium.crypto_box_keypair(publicKey, secretKey);

  return {
    publicKey: publicKey.toString('base64'),
    secretKey: secretKey.toString('base64'),
  };
}

// ============================================================================
// SYMMETRIC ENCRYPTION (XChaCha20-Poly1305)
// ============================================================================

/**
 * Encrypt data with key (authenticated encryption)
 * Uses XChaCha20-Poly1305-IETF (AEAD cipher)
 */
export function encrypt(
  plaintext: string | Buffer,
  key: Buffer,
  additionalData?: Buffer
): EncryptedData {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Key must be ${KEY_BYTES} bytes`);
  }

  const plaintextBuffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');

  // Generate random nonce
  const nonce = Buffer.alloc(NONCE_BYTES);
  sodium.randombytes_buf(nonce);

  // Allocate buffer for ciphertext + tag
  const ciphertext = Buffer.alloc(plaintextBuffer.length + TAG_BYTES);

  // Encrypt with AEAD
  sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    ciphertext,
    plaintextBuffer,
    additionalData || null,
    null, // no secret nonce
    nonce,
    key
  );

  // Split ciphertext and tag
  const actualCiphertext = ciphertext.slice(0, plaintextBuffer.length);
  const tag = ciphertext.slice(plaintextBuffer.length);

  return {
    version: ENCRYPTION_VERSION,
    algorithm: 'xchacha20poly1305',
    nonce: nonce.toString('base64'),
    ciphertext: actualCiphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt data with key
 */
export function decrypt(
  encrypted: EncryptedData,
  key: Buffer,
  additionalData?: Buffer
): Buffer {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Key must be ${KEY_BYTES} bytes`);
  }

  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  const nonce = Buffer.from(encrypted.nonce, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  // Combine ciphertext and tag
  const combined = Buffer.concat([ciphertext, tag]);

  // Allocate buffer for plaintext
  const plaintext = Buffer.alloc(ciphertext.length);

  // Decrypt with AEAD
  const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    plaintext,
    null, // no secret nonce
    combined,
    additionalData || null,
    nonce,
    key
  );

  if (result === -1) {
    throw new Error('Decryption failed: authentication tag verification failed');
  }

  return plaintext;
}

// ============================================================================
// PASSPHRASE-BASED ENCRYPTION
// ============================================================================

/**
 * Encrypt with passphrase (derives key using Argon2id)
 */
export function encryptWithPassphrase(
  plaintext: string | Buffer,
  passphrase: string
): EncryptedData {
  const { key, salt } = deriveKeyFromPassphrase(passphrase);
  const encrypted = encrypt(plaintext, key);
  
  // Add salt to encrypted data
  encrypted.salt = salt.toString('base64');
  
  // Zero out key
  sodium.sodium_memzero(key);
  
  return encrypted;
}

/**
 * Decrypt with passphrase
 */
export function decryptWithPassphrase(
  encrypted: EncryptedData,
  passphrase: string
): Buffer {
  if (!encrypted.salt) {
    throw new Error('No salt found in encrypted data');
  }

  const salt = Buffer.from(encrypted.salt, 'base64');
  const { key } = deriveKeyFromPassphrase(passphrase, salt);
  
  try {
    const plaintext = decrypt(encrypted, key);
    return plaintext;
  } finally {
    // Zero out key
    sodium.sodium_memzero(key);
  }
}

// ============================================================================
// ASYMMETRIC ENCRYPTION (Box - Curve25519)
// ============================================================================

/**
 * Encrypt for recipient (using their public key)
 */
export function encryptForRecipient(
  plaintext: string | Buffer,
  recipientPublicKey: string,
  senderSecretKey: string
): EncryptedData {
  const plaintextBuffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');

  const publicKey = Buffer.from(recipientPublicKey, 'base64');
  const secretKey = Buffer.from(senderSecretKey, 'base64');

  const nonce = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);

  const ciphertext = Buffer.alloc(
    plaintextBuffer.length + sodium.crypto_box_MACBYTES
  );

  sodium.crypto_box_easy(ciphertext, plaintextBuffer, nonce, publicKey, secretKey);

  return {
    version: ENCRYPTION_VERSION,
    algorithm: 'box_curve25519',
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: '', // Box includes MAC in ciphertext
  };
}

/**
 * Decrypt from sender (using their public key)
 */
export function decryptFromSender(
  encrypted: EncryptedData,
  senderPublicKey: string,
  recipientSecretKey: string
): Buffer {
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const nonce = Buffer.from(encrypted.nonce, 'base64');
  const publicKey = Buffer.from(senderPublicKey, 'base64');
  const secretKey = Buffer.from(recipientSecretKey, 'base64');

  const plaintext = Buffer.alloc(
    ciphertext.length - sodium.crypto_box_MACBYTES
  );

  const result = sodium.crypto_box_open_easy(
    plaintext,
    ciphertext,
    nonce,
    publicKey,
    secretKey
  );

  if (result === -1) {
    throw new Error('Decryption failed: authentication failed');
  }

  return plaintext;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash data (for checksums, fingerprints)
 */
export function hash(data: string | Buffer): string {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const hash = Buffer.alloc(sodium.crypto_generichash_BYTES);
  sodium.crypto_generichash(hash, dataBuffer);
  return hash.toString('base64');
}

/**
 * Constant-time comparison (prevents timing attacks)
 */
export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return sodium.sodium_memcmp(a, b);
}

/**
 * Generate random bytes
 */
export function randomBytes(length: number): Buffer {
  const buf = Buffer.alloc(length);
  sodium.randombytes_buf(buf);
  return buf;
}

/**
 * Securely zero out buffer
 */
export function secureZero(buffer: Buffer): void {
  sodium.sodium_memzero(buffer);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Encrypt JSON object
 */
export function encryptJSON(obj: any, key: Buffer): EncryptedData {
  const json = JSON.stringify(obj);
  return encrypt(json, key);
}

/**
 * Decrypt to JSON object
 */
export function decryptJSON(encrypted: EncryptedData, key: Buffer): any {
  const plaintext = decrypt(encrypted, key);
  return JSON.parse(plaintext.toString('utf8'));
}

logger.info('Encryption service initialized');
