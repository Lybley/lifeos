/**
 * Client-Side Encryption Utilities
 * Uses WebCrypto API for secure encryption/decryption
 * Key NEVER leaves the client
 */

export interface VaultConfig {
  kdf_algorithm: 'PBKDF2' | 'scrypt';
  kdf_iterations: number;
  kdf_salt_hex: string;
  kdf_hash: 'SHA-256' | 'SHA-512';
  encryption_algorithm: 'AES-GCM';
  key_length: 256;
}

export interface EncryptedData {
  ciphertext: string; // Base64
  iv: string; // Base64 
  authTag?: string; // Base64 (for AES-GCM)
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Uint8Array to Base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert Base64 to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive encryption key from passphrase using PBKDF2
 * @param passphrase User's master passphrase
 * @param salt Salt bytes (should be from vault config)
 * @param iterations Number of PBKDF2 iterations
 * @param hashAlgorithm Hash algorithm (SHA-256 or SHA-512)
 * @returns Derived CryptoKey
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100000,
  hashAlgorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<CryptoKey> {
  // Convert passphrase to key material
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the encryption key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: iterations,
      hash: hashAlgorithm,
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable - key stays in WebCrypto
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypt data using AES-GCM
 * @param data Data to encrypt (any JSON-serializable object)
 * @param key CryptoKey for encryption
 * @returns Encrypted data with IV
 */
export async function encryptData(
  data: any,
  key: CryptoKey
): Promise<EncryptedData> {
  // Serialize data
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  // Generate random IV (12 bytes for AES-GCM)
  const iv = generateRandomBytes(12);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    key,
    plaintext
  );

  // AES-GCM includes authentication tag in ciphertext
  const ciphertextBytes = new Uint8Array(ciphertext);

  return {
    ciphertext: bytesToBase64(ciphertextBytes),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData Encrypted data object
 * @param key CryptoKey for decryption
 * @returns Decrypted data
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<any> {
  const ciphertext = base64ToBytes(encryptedData.ciphertext);
  const iv = base64ToBytes(encryptedData.iv);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  // Deserialize
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintext);
  return JSON.parse(jsonString);
}

/**
 * Validate passphrase strength
 */
export function validatePassphraseStrength(passphrase: string): {
  valid: boolean;
  score: number; // 0-100
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (passphrase.length < 12) {
    feedback.push('Passphrase should be at least 12 characters');
  } else if (passphrase.length >= 12) {
    score += 25;
  }
  if (passphrase.length >= 16) score += 10;
  if (passphrase.length >= 20) score += 10;

  // Character variety
  if (/[a-z]/.test(passphrase)) score += 10;
  if (/[A-Z]/.test(passphrase)) score += 10;
  if (/[0-9]/.test(passphrase)) score += 10;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 15;

  // Word count (passphrase style)
  const words = passphrase.split(/\s+/);
  if (words.length >= 4) {
    score += 10;
  }

  // Common patterns
  if (/^(password|123456|qwerty)/i.test(passphrase)) {
    feedback.push('Avoid common patterns');
    score -= 50;
  }

  if (score < 50) {
    feedback.push('Weak passphrase - consider using 4+ random words');
  } else if (score < 70) {
    feedback.push('Moderate passphrase - add more characters or symbols');
  }

  return {
    valid: score >= 50 && passphrase.length >= 12,
    score: Math.max(0, Math.min(100, score)),
    feedback,
  };
}

/**
 * Generate secure recovery key
 */
export function generateRecoveryKey(): string {
  const bytes = generateRandomBytes(32);
  const hex = bytesToHex(bytes);
  // Format as groups of 4 characters
  return hex.match(/.{1,4}/g)?.join('-') || hex;
}

/**
 * Hash passphrase for verification (client-side only)
 * NOT sent to server
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}
