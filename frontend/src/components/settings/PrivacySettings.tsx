'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, Lock, Key, Download, AlertTriangle } from 'lucide-react';
import * as encryption from '@/lib/encryption';

interface EncryptionSettings {
  userId: string;
  encryptionTier: 'standard' | 'zero-knowledge' | 'vault';
  vaultEnabled: boolean;
  kmsKeyId?: string;
}

interface PrivacySettingsProps {
  userId: string;
}

export default function PrivacySettings({ userId }: PrivacySettingsProps) {
  const [settings, setSettings] = useState<EncryptionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showZKModal, setShowZKModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [pin, setPin] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/privacy/encryption-settings?user_id=${userId}`
      );
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch encryption settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const enableZeroKnowledge = async () => {
    if (!passphrase || passphrase !== confirmPassphrase) {
      alert('Passphrases do not match');
      return;
    }

    if (passphrase.length < 12) {
      alert('Passphrase must be at least 12 characters');
      return;
    }

    try {
      // Generate master key from passphrase
      const { key: masterKey, salt } = await encryption.deriveKeyFromPassphrase(passphrase);

      // Export and encrypt master key for server storage
      const exportedKey = await crypto.subtle.exportKey('jwk', masterKey);
      const encryptedMasterKey = await encryption.encryptWithPassphrase(
        JSON.stringify(exportedKey),
        passphrase
      );

      // Send to backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/privacy/enable-zero-knowledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            master_key_encrypted: JSON.stringify(encryptedMasterKey),
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        // Generate recovery codes
        await generateRecoveryCodes(masterKey);
        
        setShowZKModal(false);
        fetchSettings();
      } else {
        alert('Failed to enable zero-knowledge encryption');
      }
    } catch (error) {
      console.error('Failed to enable zero-knowledge:', error);
      alert('An error occurred');
    }
  };

  const generateRecoveryCodes = async (masterKey: CryptoKey) => {
    try {
      const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
      const masterKeyBase64 = btoa(
        String.fromCharCode(...new Uint8Array(exportedKey))
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/privacy/generate-recovery-codes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            master_key: masterKeyBase64,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setRecoveryCodes(data.recovery_codes);
      }
    } catch (error) {
      console.error('Failed to generate recovery codes:', error);
    }
  };

  const enableVault = async () => {
    if (!pin || pin.length < 4) {
      alert('PIN must be at least 4 characters');
      return;
    }

    try {
      // Generate vault key
      const vaultKey = await encryption.generateKey();

      // Store vault key in IndexedDB (encrypted with PIN)
      await encryption.storeVaultKey(userId, vaultKey, pin);

      // Export and encrypt vault key for server
      const exportedKey = await crypto.subtle.exportKey('jwk', vaultKey);
      const encryptedVaultKey = await encryption.encryptWithPassphrase(
        JSON.stringify(exportedKey),
        pin
      );

      // Send to backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/privacy/enable-vault`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            vault_key_encrypted: JSON.stringify(encryptedVaultKey),
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setShowVaultModal(false);
        setPin('');
        fetchSettings();
        alert('Vault enabled successfully! You can now mark sensitive data as vault items.');
      } else {
        alert('Failed to enable vault');
      }
    } catch (error) {
      console.error('Failed to enable vault:', error);
      alert('An error occurred');
    }
  };

  const downloadRecoveryCodes = () => {
    const blob = new Blob(
      [
        'LifeOS Zero-Knowledge Encryption Recovery Codes\n',
        '================================================\n\n',
        'IMPORTANT: Store these codes in a safe place!\n',
        'Each code can only be used once.\n\n',
        recoveryCodes.map((code, i) => `${i + 1}. ${code}`).join('\n'),
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Loading encryption settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Encryption Tier */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Encryption Settings</CardTitle>
            </div>
            <Badge
              variant={
                settings?.encryptionTier === 'zero-knowledge'
                  ? 'success'
                  : settings?.encryptionTier === 'vault'
                  ? 'info'
                  : 'default'
              }
            >
              {settings?.encryptionTier === 'standard' && 'Standard'}
              {settings?.encryptionTier === 'zero-knowledge' && 'Zero-Knowledge'}
              {settings?.encryptionTier === 'vault' && 'Vault'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Standard Tier */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4" />
                <h3 className="font-medium">Standard</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Server-managed encryption. Best for most users.
              </p>
              <Badge variant="success">✓ Active</Badge>
            </div>

            {/* Zero-Knowledge Tier */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
                <h3 className="font-medium">Zero-Knowledge</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                End-to-end encryption. Only you can decrypt your data.
              </p>
              {settings?.encryptionTier === 'zero-knowledge' ? (
                <Badge variant="success">✓ Enabled</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowZKModal(true)}
                >
                  Enable
                </Button>
              )}
            </div>

            {/* Vault Tier */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4" />
                <h3 className="font-medium">Vault</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Selective encryption for sensitive data.
              </p>
              {settings?.vaultEnabled ? (
                <Badge variant="success">✓ Enabled</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVaultModal(true)}
                >
                  Enable
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zero-Knowledge Modal */}
      {showZKModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-lg w-full m-4">
            <CardHeader>
              <CardTitle>Enable Zero-Knowledge Encryption</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900 dark:text-yellow-100">
                      Important Warning
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                      If you forget your passphrase, you will permanently lose access to
                      your data. We cannot recover it for you.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Master Passphrase (min 12 characters)
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter a strong passphrase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirm Passphrase
                </label>
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Re-enter your passphrase"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowZKModal(false)}>
                  Cancel
                </Button>
                <Button onClick={enableZeroKnowledge}>Enable</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vault Modal */}
      {showVaultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-lg w-full m-4">
            <CardHeader>
              <CardTitle>Enable Vault Feature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The Vault allows you to selectively encrypt sensitive data (passwords,
                private notes, etc.) with client-side encryption while keeping most data
                searchable.
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Vault PIN (min 4 characters)
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter a PIN for vault access"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You'll need this PIN to access vault items
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowVaultModal(false)}>
                  Cancel
                </Button>
                <Button onClick={enableVault}>Enable Vault</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recovery Codes Modal */}
      {recoveryCodes.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-lg w-full m-4">
            <CardHeader>
              <CardTitle>Save Your Recovery Codes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                  Store these codes in a safe place! They are your only way to recover
                  your data if you forget your passphrase.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2 font-mono text-sm">
                  {recoveryCodes.map((code, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-500">{i + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={downloadRecoveryCodes}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setRecoveryCodes([])}>
                  I've Saved Them
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
