/**
 * Vault Manager Component
 * Main interface for managing encrypted vault items
 */
import React, { useState, useEffect } from 'react';
import { VaultClient, type VaultItem } from '@/lib/vault/vaultClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface VaultManagerProps {
  userId: string;
  vaultClient: VaultClient;
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
}

export const VaultManager: React.FC<VaultManagerProps> = ({
  userId,
  vaultClient,
  isUnlocked,
  onUnlock,
  onLock,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', type: 'note', data: '' });

  useEffect(() => {
    if (isUnlocked) {
      loadItems();
    }
  }, [isUnlocked]);

  const handleUnlock = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await vaultClient.unlock(userId, { passphrase });
      if (result.success) {
        onUnlock();
        setPassphrase('');
      } else {
        setError(result.message || 'Failed to unlock vault');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    vaultClient.lock();
    setItems([]);
    onLock();
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const loadedItems = await vaultClient.listItems(userId);
      setItems(loadedItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.label || !newItem.data) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await vaultClient.storeItem(userId, {
        nodeType: newItem.type,
        nodeLabel: newItem.label,
        data: { content: newItem.data },
      });
      setNewItem({ label: '', type: 'note', data: '' });
      setShowAddForm(false);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setLoading(true);
    try {
      await vaultClient.deleteItem(itemId);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  // Unlock Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold mb-2">Unlock Your Vault</h2>
            <p className="text-gray-600">Enter your master passphrase to access your encrypted data</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Master Passphrase</label>
              <Input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleUnlock()}
                placeholder="Enter your passphrase"
                autoFocus
              />
            </div>

            <Button
              onClick={handleUnlock}
              disabled={loading || !passphrase}
              loading={loading}
              className="w-full"
            >
              Unlock Vault
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main Vault Interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔐 Secure Vault</h1>
              <p className="mt-1 text-sm text-gray-600">
                Client-side encrypted storage
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success">🔓 Unlocked</Badge>
              <Button onClick={handleLock} variant="ghost" size="sm">
                Lock Vault
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Add Item Button */}
        <div className="mb-6">
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Item'}
          </Button>
        </div>

        {/* Add Item Form */}
        {showAddForm && (
          <Card className="mb-6 p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={newItem.type}
                  onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="note">Note</option>
                  <option value="password">Password</option>
                  <option value="api_key">API Key</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Label</label>
                <Input
                  value={newItem.label}
                  onChange={e => setNewItem({ ...newItem, label: e.target.value })}
                  placeholder="e.g., AWS API Key, Bank Password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data</label>
                <textarea
                  value={newItem.data}
                  onChange={e => setNewItem({ ...newItem, data: e.target.value })}
                  placeholder="Enter sensitive data here..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button onClick={handleAddItem} loading={loading} disabled={loading}>
                Add to Vault
              </Button>
            </div>
          </Card>
        )}

        {/* Items List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Vault Items ({items.length})</h3>

          {loading && items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🔒</div>
              <p className="text-gray-600 mb-2">Your vault is empty</p>
              <p className="text-sm text-gray-500">Add your first encrypted item above</p>
            </Card>
          ) : (
            items.map(item => (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg">{item.nodeLabel}</h4>
                      <Badge variant="outline">{item.nodeType}</Badge>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm break-all">
                      {item.data?.content || 'No data'}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDeleteItem(item.id)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
