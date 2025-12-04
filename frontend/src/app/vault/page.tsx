/**
 * Vault Management Page
 * Secure client-side encrypted storage
 */
'use client';

import React, { useEffect, useState } from 'react';
import { VaultClient } from '@/lib/vault/vaultClient';
import { VaultSetup } from '@/components/vault/VaultSetup';
import { VaultManager } from '@/components/vault/VaultManager';

export default function VaultPage() {
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultClient] = useState(() => new VaultClient());
  const [loading, setLoading] = useState(true);

  // Mock user ID - in production, get from auth
  const userId = 'test-user-123';

  useEffect(() => {
    checkVaultStatus();
  }, []);

  const checkVaultStatus = async () => {
    try {
      const exists = await vaultClient.checkVaultExists(userId);
      setVaultExists(exists);
    } catch (error) {
      console.error('Failed to check vault status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setVaultExists(true);
    setIsUnlocked(true);
  };

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  const handleLock = () => {
    setIsUnlocked(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show setup if vault doesn't exist
  if (vaultExists === false) {
    return <VaultSetup userId={userId} onComplete={handleSetupComplete} />;
  }

  // Show manager if vault exists
  return (
    <VaultManager
      userId={userId}
      vaultClient={vaultClient}
      isUnlocked={isUnlocked}
      onUnlock={handleUnlock}
      onLock={handleLock}
    />
  );
}
