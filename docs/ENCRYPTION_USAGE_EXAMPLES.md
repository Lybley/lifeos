# Encryption Usage Examples

## Backend Examples (Node.js/TypeScript)

### 1. Basic Symmetric Encryption

```typescript
import { encrypt, decrypt, generateKey } from '../services/encryption/crypto';

// Generate a random encryption key
const key = generateKey();

// Encrypt data
const plaintext = "Sensitive user data";
const encrypted = encrypt(plaintext, key);
console.log(encrypted);
// {
//   version: 1,
//   algorithm: 'xchacha20poly1305',
//   nonce: 'base64...',
//   ciphertext: 'base64...',
//   tag: 'base64...'
// }

// Decrypt data
const decrypted = decrypt(encrypted, key);
console.log(decrypted.toString('utf8')); // "Sensitive user data"
```

### 2. Passphrase-Based Encryption

```typescript
import { encryptWithPassphrase, decryptWithPassphrase } from '../services/encryption/crypto';

// User's data
const userData = {
  email: 'user@example.com',
  sensitive_notes: 'My private thoughts...'
};

// Encrypt with user's passphrase
const userPassphrase = "MySecurePassphrase123!";
const encrypted = encryptWithPassphrase(
  JSON.stringify(userData),
  userPassphrase
);

// Later... decrypt with same passphrase
const decrypted = decryptWithPassphrase(encrypted, userPassphrase);
const recovered = JSON.parse(decrypted.toString('utf8'));
console.log(recovered.email); // "user@example.com"
```

### 3. KMS Integration (Server-Managed Encryption)

```typescript
import { createKMS } from '../services/encryption/kms';
import { generateKey } from '../services/encryption/crypto';

// Initialize KMS (AWS, GCP, or local)
const kms = createKMS();

// Generate a data encryption key (DEK)
const dek = generateKey();

// Encrypt DEK with key encryption key (KEK) from KMS
const encryptedDEK = await kms.encryptDEK(dek);

// Store encrypted DEK in database
await database.storeKey(userId, encryptedDEK);

// Later... retrieve and decrypt DEK
const retrievedDEK = await database.getKey(userId);
const decryptedDEK = await kms.decryptDEK(retrievedDEK);

// Use DEK to encrypt user data
const userData = "Sensitive information";
const encrypted = encrypt(userData, decryptedDEK);
```

### 4. Vault Node Encryption (Selective Client-Side)

```typescript
import { encrypt, decrypt } from '../services/encryption/crypto';

// API endpoint to create vault node
router.post('/nodes/vault', async (req, res) => {
  const { user_id, content, vault_key_id } = req.body;

  // Client has already encrypted the content
  // Server just stores the encrypted blob
  const node = {
    id: uuid(),
    user_id,
    content, // Already encrypted by client
    is_vault: true,
    vault_key_id,
    created_at: new Date(),
  };

  await database.nodes.insertOne(node);

  res.json({ success: true, node_id: node.id });
});

// API endpoint to retrieve vault node
router.get('/nodes/vault/:id', async (req, res) => {
  const node = await database.nodes.findOne({ id: req.params.id });

  if (node.is_vault) {
    // Return encrypted content as-is
    // Client will decrypt locally
    res.json({
      id: node.id,
      content: node.content, // Encrypted
      is_vault: true,
      vault_key_id: node.vault_key_id,
    });
  }
});
```

---

## Frontend Examples (React/TypeScript)

### 1. Client-Side Encryption (Zero-Knowledge)

```typescript
import { encryptWithPassphrase, decryptWithPassphrase } from '@/lib/encryption';

// During onboarding, user sets a passphrase
async function setupZeroKnowledge(userPassphrase: string) {
  // Encrypt sensitive data before sending to server
  const sensitiveData = {
    emails: ['...'],
    documents: ['...'],
    notes: ['...'],
  };

  const encrypted = await encryptWithPassphrase(
    JSON.stringify(sensitiveData),
    userPassphrase
  );

  // Upload encrypted data to server
  await apiClient.post('/api/upload-encrypted', {
    user_id: userId,
    encrypted_data: encrypted,
  });

  console.log('Data uploaded. Server cannot decrypt it.');
}

// When user needs to access data
async function accessZeroKnowledge(userPassphrase: string) {
  // Fetch encrypted data from server
  const response = await apiClient.get('/api/fetch-encrypted');
  const encrypted = response.data.encrypted_data;

  // Decrypt locally in browser
  const decrypted = await decryptWithPassphrase(encrypted, userPassphrase);
  const data = JSON.parse(decrypted);

  console.log('Decrypted data:', data);
  return data;
}
```

### 2. Vault Feature (Selective Encryption)

```typescript
import { generateKey, encryptJSON, decryptJSON, storeVaultKey, getVaultKey } from '@/lib/encryption';

// Initialize vault for user
async function initializeVault(userId: string, pin: string) {
  // Generate vault encryption key
  const vaultKey = await generateKey();

  // Store encrypted in IndexedDB (unlocked with PIN)
  await storeVaultKey(userId, vaultKey, pin);

  console.log('Vault initialized. Key stored securely.');
}

// Mark a node as sensitive and encrypt
async function markAsSensitive(nodeId: string, nodeData: any, userId: string, pin: string) {
  // Get vault key from IndexedDB
  const vaultKey = await getVaultKey(userId, pin);

  // Encrypt node content
  const encrypted = await encryptJSON(nodeData, vaultKey);

  // Update node on server
  await apiClient.put(`/api/nodes/${nodeId}`, {
    is_vault: true,
    content: encrypted, // Encrypted blob
  });

  console.log('Node marked as sensitive and encrypted');
}

// Access vault node
async function accessVaultNode(nodeId: string, userId: string, pin: string) {
  // Fetch encrypted node from server
  const response = await apiClient.get(`/api/nodes/${nodeId}`);
  const node = response.data;

  if (node.is_vault) {
    // Get vault key and decrypt
    const vaultKey = await getVaultKey(userId, pin);
    const decrypted = await decryptJSON(node.content, vaultKey);
    
    console.log('Vault node decrypted:', decrypted);
    return decrypted;
  }

  // Non-vault node, return as-is
  return node.content;
}
```

### 3. Biometric Vault Unlock

```typescript
import { getVaultKey } from '@/lib/encryption';

async function unlockVaultWithBiometric(userId: string) {
  // Use Web Authentication API
  const challenge = await apiClient.get('/api/webauthn/challenge');

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: Uint8Array.from(challenge.data, c => c.charCodeAt(0)),
      rpId: window.location.hostname,
      userVerification: 'required', // Biometric
    },
  });

  // Verify with server
  const verified = await apiClient.post('/api/webauthn/verify', { credential });

  if (verified.data.success) {
    // Get PIN from secure server session (after biometric auth)
    const pin = verified.data.temp_pin;

    // Unlock vault
    const vaultKey = await getVaultKey(userId, pin);
    
    console.log('Vault unlocked with biometric');
    return vaultKey;
  }

  throw new Error('Biometric authentication failed');
}
```

---

## React Component Example: Vault Toggle

```typescript
'use client';

import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { markAsSensitive, accessVaultNode } from '@/lib/encryption';

interface VaultToggleProps {
  nodeId: string;
  isVault: boolean;
  userId: string;
}

export const VaultToggle: React.FC<VaultToggleProps> = ({ nodeId, isVault, userId }) => {
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggleVault = async () => {
    if (!isVault) {
      // Encrypt and mark as vault
      setShowPinInput(true);
    } else {
      // Decrypt and remove from vault
      // (implementation depends on your flow)
    }
  };

  const handleConfirmPin = async () => {
    setLoading(true);
    try {
      // Fetch node data
      const nodeData = await fetchNodeData(nodeId);

      // Encrypt and mark as sensitive
      await markAsSensitive(nodeId, nodeData, userId, pin);

      alert('Node marked as sensitive and encrypted!');
      setShowPinInput(false);
      setPin('');
    } catch (error) {
      alert('Failed to encrypt node');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleToggleVault}
        variant={isVault ? 'primary' : 'outline'}
        icon={isVault ? <Lock /> : <Unlock />}
      >
        {isVault ? 'Vault Protected' : 'Mark as Sensitive'}
      </Button>

      {showPinInput && (
        <div className=\"mt-4 p-4 border rounded\">
          <Input
            type=\"password\"
            placeholder=\"Enter PIN to encrypt\"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={6}
          />
          <Button onClick={handleConfirmPin} loading={loading} className=\"mt-2\">
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
};
```

---

## Testing Encryption

### Backend Tests

```typescript
import { encrypt, decrypt, generateKey } from '../services/encryption/crypto';

describe('Encryption Service', () => {
  test('should encrypt and decrypt successfully', () => {
    const key = generateKey();
    const plaintext = 'Secret message';
    
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    
    expect(decrypted.toString('utf8')).toBe(plaintext);
  });

  test('should fail with wrong key', () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const plaintext = 'Secret message';
    
    const encrypted = encrypt(plaintext, key1);
    
    expect(() => decrypt(encrypted, key2)).toThrow('Decryption failed');
  });

  test('should use different nonces', () => {
    const key = generateKey();
    const plaintext = 'Secret message';
    
    const encrypted1 = encrypt(plaintext, key);
    const encrypted2 = encrypt(plaintext, key);
    
    expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
  });
});
```

### Frontend Tests

```typescript
import { encrypt, decrypt, generateKey } from '@/lib/encryption';

describe('Client-Side Encryption', () => {
  test('should work with Web Crypto API', async () => {
    const key = await generateKey();
    const plaintext = 'Secret message';
    
    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);
    
    expect(decrypted).toBe(plaintext);
  });

  test('should derive same key from same passphrase', async () => {
    const passphrase = 'MyPassword123';
    
    const { key: key1, salt } = await deriveKeyFromPassphrase(passphrase);
    const { key: key2 } = await deriveKeyFromPassphrase(passphrase, salt);
    
    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);
    
    expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
  });
});
```

---

## Security Best Practices

### 1. Key Rotation

```typescript
// Rotate KMS keys every 90 days
async function rotateKMSKeys() {
  const kms = createKMS();
  
  // Generate new KEK in KMS
  const newKeyId = await kms.createKey();
  
  // Re-encrypt all DEKs with new KEK
  const users = await database.users.find();
  
  for (const user of users) {
    const oldEncryptedDEK = user.encrypted_dek;
    const dek = await kms.decryptDEK(oldEncryptedDEK); // Old KEK
    const newEncryptedDEK = await kms.encryptDEK(dek); // New KEK
    
    await database.users.updateOne(
      { id: user.id },
      { encrypted_dek: newEncryptedDEK }
    );
  }
  
  console.log('Key rotation complete');
}
```

### 2. Secure Key Zeroing

```typescript
import { secureZero } from '../services/encryption/crypto';

async function handleSensitiveData(key: Buffer) {
  try {
    // Use key
    const encrypted = encrypt('data', key);
    
    // ... do work ...
    
  } finally {
    // Always zero out key from memory
    secureZero(key);
  }
}
```

### 3. Constant-Time Comparison

```typescript
import { constantTimeEqual } from '../services/encryption/crypto';

// Prevent timing attacks when comparing secrets
function verifyToken(providedToken: string, actualToken: string): boolean {
  const provided = Buffer.from(providedToken, 'hex');
  const actual = Buffer.from(actualToken, 'hex');
  
  // DON'T use: provided === actual (timing attack vulnerable)
  // DO use: constant-time comparison
  return constantTimeEqual(provided, actual);
}
```

---

## Performance Benchmarks

### Encryption Speed

```
Operation                    | Time (ms) | Throughput
-----------------------------|-----------|------------
Encrypt 1KB (libsodium)      | 0.1ms     | 10 MB/s
Decrypt 1KB (libsodium)      | 0.1ms     | 10 MB/s
Derive key (Argon2id)        | 50ms      | -
Encrypt 1KB (Web Crypto)     | 0.5ms     | 2 MB/s
Decrypt 1KB (Web Crypto)     | 0.5ms     | 2 MB/s
Derive key (PBKDF2)          | 100ms     | -
```

### Recommendations

- **Small data (< 1MB)**: Acceptable overhead
- **Large files (> 10MB)**: Use streaming encryption
- **Real-time chat**: < 10ms latency, use optimized settings
- **Bulk operations**: Parallelize encryption tasks

---

## Troubleshooting

### Common Issues

**Q: "Decryption failed: authentication tag verification failed"**  
A: Wrong key or corrupted data. Verify key derivation and data integrity.

**Q: "IndexedDB not available"**  
A: Browser doesn't support IndexedDB. Fall back to localStorage (less secure) or prompt upgrade.

**Q: "KMS rate limit exceeded"**  
A: Cache decrypted DEKs in memory (securely) to reduce KMS calls.

**Q: "Passphrase too weak"**  
A: Enforce minimum entropy (e.g., 12 characters, mixed case, numbers, symbols).

---

## Additional Resources

- **libsodium docs**: https://doc.libsodium.org/
- **Web Crypto API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- **OWASP Cryptography**: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- **NIST Guidelines**: https://csrc.nist.gov/publications/fips
