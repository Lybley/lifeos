/**
 * Vault Setup Component
 * Guides user through vault initialization
 */
import React, { useState } from 'react';
import { VaultClient } from '@/lib/vault/vaultClient';
import { validatePassphraseStrength, generateRandomBytes, bytesToHex } from '@/lib/vault/encryption';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface VaultSetupProps {
  userId: string;
  onComplete: () => void;
}

export const VaultSetup: React.FC<VaultSetupProps> = ({ userId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [passphraseHint, setPassphraseHint] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const passphraseStrength = validatePassphraseStrength(passphrase);
  const vaultClient = new VaultClient();

  const handleCreateVault = async () => {
    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match');
      return;
    }

    if (!passphraseStrength.valid) {
      setError('Passphrase is too weak');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await vaultClient.initializeVault(userId, passphrase, {
        passphraseHint,
        require2FA: false,
        autoLockMinutes: 15,
      });

      // Generate recovery key
      const recoveryBytes = generateRandomBytes(32);
      const recovery = bytesToHex(recoveryBytes);
      setRecoveryKey(recovery);

      setStep(3); // Show recovery key
    } catch (err: any) {
      setError(err.message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (confirmed) {
      onComplete();
    } else {
      setError('Please confirm you have saved your recovery key');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {i}
              </div>
              {i < 3 && (
                <div
                  className={`w-24 h-1 mx-2 ${
                    step > i ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Introduction */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">🔐 Secure Vault Setup</h2>
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  ✅ What is the Vault?
                </h3>
                <p className="text-blue-800 text-sm">
                  A client-side encrypted storage for your most sensitive data.
                  Your encryption key <strong>never leaves your device</strong>.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  🔒 How it works:
                </h3>
                <ul className="text-green-800 text-sm space-y-1 list-disc list-inside">
                  <li>You create a master passphrase</li>
                  <li>Encryption happens in your browser using WebCrypto</li>
                  <li>Server only stores encrypted ciphertext</li>
                  <li>Only you can decrypt with your passphrase</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  ⚠️ Important:
                </h3>
                <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
                  <li>If you forget your passphrase, data cannot be recovered</li>
                  <li>Use a strong, memorable passphrase</li>
                  <li>Save your recovery key securely</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full"
            >
              Continue →
            </Button>
          </div>
        )}

        {/* Step 2: Create Passphrase */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Create Master Passphrase</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Master Passphrase *
                </label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase"
                />
                {passphrase && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            passphraseStrength.score < 50
                              ? 'bg-red-500'
                              : passphraseStrength.score < 70
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${passphraseStrength.score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {passphraseStrength.score}%
                      </span>
                    </div>
                    {passphraseStrength.feedback.length > 0 && (
                      <ul className="mt-2 text-sm text-gray-600 space-y-1">
                        {passphraseStrength.feedback.map((fb, i) => (
                          <li key={i}>• {fb}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirm Passphrase *
                </label>
                <Input
                  type="password"
                  value={passphraseConfirm}
                  onChange={e => setPassphraseConfirm(e.target.value)}
                  placeholder="Re-enter your passphrase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Passphrase Hint (Optional)
                </label>
                <Input
                  type="text"
                  value={passphraseHint}
                  onChange={e => setPassphraseHint(e.target.value)}
                  placeholder="A hint to help you remember"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Make it memorable but not obvious to others
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                ← Back
              </Button>
              <Button
                onClick={handleCreateVault}
                disabled={loading || !passphraseStrength.valid || passphrase !== passphraseConfirm}
                loading={loading}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Create Vault →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Recovery Key */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">✅ Vault Created!</h2>

            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
              <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Save Your Recovery Key
              </h3>
              <p className="text-red-800 mb-4">
                This recovery key can restore access if you forget your passphrase.
                Store it securely - you won't see it again!
              </p>

              <div className="bg-white p-4 rounded border border-red-300 font-mono text-sm break-all">
                {recoveryKey}
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(recoveryKey)}
                className="mt-3 text-red-900 font-semibold hover:underline"
              >
                📋 Copy to Clipboard
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">Recommended: Store in multiple secure locations</h3>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Password manager</li>
                <li>Encrypted USB drive</li>
                <li>Secure physical location</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <input
                type="checkbox"
                id="confirm-saved"
                className="w-5 h-5"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              <label htmlFor="confirm-saved" className="text-sm font-medium">
                I have saved my recovery key in a secure location
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <Button
              onClick={handleFinish}
              disabled={!confirmed}
              className="w-full"
              variant="success"
            >
              Complete Setup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
