/**
 * Client-Side Encryption Library
 * Uses Web Crypto API for browser-native encryption
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EncryptedData {
  version: number;
  algorithm: string;
  iv: string; // base64
  salt?: string; // base64 (for passphrase-based)
  ciphertext: string; // base64
}

export interface VaultKey {
  id: string;
  key: CryptoKey;
  publicKey?: CryptoKey;
  privateKey?: CryptoKey;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 600000; // OWASP recommended
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // for AES-GCM

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derive encryption key from passphrase using PBKDF2
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const saltBytes = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return { key, salt: saltBytes };
}

/**
 * Generate random encryption key
 */
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate RSA key pair for asymmetric encryption
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// SYMMETRIC ENCRYPTION (AES-GCM)
// ============================================================================

/**
 * Encrypt data with key (authenticated encryption)
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const ciphertextBytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  return {
    version: ENCRYPTION_VERSION,
    algorithm: 'aes-256-gcm',
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBytes),
  };
}

/**
 * Decrypt data with key
 */
export async function decrypt(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<string> {
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  try {
    const plaintextBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintextBytes);
  } catch (error) {
    throw new Error('Decryption failed: authentication tag verification failed');
  }
}

// ============================================================================
// PASSPHRASE-BASED ENCRYPTION
// ============================================================================

/**
 * Encrypt with passphrase
 */
export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string
): Promise<EncryptedData> {
  const { key, salt } = await deriveKeyFromPassphrase(passphrase);
  const encrypted = await encrypt(plaintext, key);
  encrypted.salt = arrayBufferToBase64(salt);
  return encrypted;
}

/**
 * Decrypt with passphrase
 */
export async function decryptWithPassphrase(
  encrypted: EncryptedData,
  passphrase: string
): Promise<string> {
  if (!encrypted.salt) {
    throw new Error('No salt found in encrypted data');
  }

  const salt = base64ToArrayBuffer(encrypted.salt);
  const { key } = await deriveKeyFromPassphrase(passphrase, new Uint8Array(salt));
  return await decrypt(encrypted, key);
}

// ============================================================================
// KEY STORAGE (IndexedDB)
// ============================================================================

const DB_NAME = 'LifeOS-Vault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/**
 * Open IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Store vault key in IndexedDB (encrypted)
 */
export async function storeVaultKey(
  userId: string,
  key: CryptoKey,
  pin: string
): Promise<void> {
  // Encrypt the key with PIN before storing
  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  const encrypted = await encryptWithPassphrase(JSON.stringify(exportedKey), pin);

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      id: `vault-key-${userId}`,
      encrypted,
      created: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  db.close();
}

/**
 * Retrieve vault key from IndexedDB
 */
export async function getVaultKey(userId: string, pin: string): Promise<CryptoKey> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  const data = await new Promise<any>((resolve, reject) => {
    const request = store.get(`vault-key-${userId}`);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  db.close();

  if (!data) {
    throw new Error('Vault key not found');
  }

  // Decrypt the key with PIN
  const decrypted = await decryptWithPassphrase(data.encrypted, pin);
  const jwk = JSON.parse(decrypted);

  // Import as CryptoKey
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Delete vault key from IndexedDB
 */
export async function deleteVaultKey(userId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const request = store.delete(`vault-key-${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  db.close();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Hash data (for fingerprints)
 */
export async function hash(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return arrayBufferToBase64(hashBuffer);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Encrypt JSON object
 */
export async function encryptJSON(obj: any, key: CryptoKey): Promise<EncryptedData> {
  const json = JSON.stringify(obj);
  return await encrypt(json, key);
}

/**
 * Decrypt to JSON object
 */
export async function decryptJSON(encrypted: EncryptedData, key: CryptoKey): Promise<any> {
  const json = await decrypt(encrypted, key);
  return JSON.parse(json);
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoSupported(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}
