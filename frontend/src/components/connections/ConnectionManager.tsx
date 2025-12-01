'use client';

import React, { useState } from 'react';
import { ConnectionCard, Connection } from './ConnectionCard';
import { Plus, Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface ConnectionManagerProps {
  connections: Connection[];
  onConnect: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  onSync: (connectionId: string) => void;
  onAddNew?: () => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connections,
  onConnect,
  onDisconnect,
  onSync,
  onAddNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'connected' | 'disconnected'>('all');

  const filteredConnections = connections.filter((conn) => {
    const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'connected' && conn.status === 'connected') ||
      (filter === 'disconnected' && conn.status !== 'connected');
    return matchesSearch && matchesFilter;
  });

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connections</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {connectedCount} of {connections.length} services connected
          </p>
        </div>
        {onAddNew && (
          <Button onClick={onAddNew} icon={<Plus className="w-4 h-4" />}>
            Add Connection
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('connected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'connected'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Connected
          </button>
          <button
            onClick={() => setFilter('disconnected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'disconnected'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Disconnected
          </button>
        </div>
      </div>

      {/* Connections Grid */}
      {filteredConnections.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No connections found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredConnections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onConnect={() => onConnect(connection.id)}
              onDisconnect={() => onDisconnect(connection.id)}
              onSync={() => onSync(connection.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
