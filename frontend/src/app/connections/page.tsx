'use client';

import React, { useState } from 'react';
import { ConnectionManager } from '@/components/connections/ConnectionManager';
import { Connection } from '@/components/connections/ConnectionCard';

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: '1',
      name: 'Gmail',
      type: 'gmail',
      status: 'connected',
      lastSync: new Date(),
      itemsCount: 1547,
      icon: '📧',
      description: 'Sync emails and contacts from your Gmail account',
    },
    {
      id: '2',
      name: 'Google Drive',
      type: 'google-drive',
      status: 'disconnected',
      icon: '📁',
      description: 'Sync files and documents from Google Drive',
    },
    {
      id: '3',
      name: 'Google Calendar',
      type: 'google-calendar',
      status: 'connected',
      lastSync: new Date(Date.now() - 3600000),
      itemsCount: 234,
      icon: '📅',
      description: 'Sync calendar events and meetings',
    },
    {
      id: '4',
      name: 'Slack',
      type: 'slack',
      status: 'disconnected',
      icon: '💬',
      description: 'Sync messages and channels from Slack workspaces',
    },
    {
      id: '5',
      name: 'Notion',
      type: 'notion',
      status: 'disconnected',
      icon: '📝',
      description: 'Sync pages and databases from Notion',
    },
  ]);

  const handleConnect = async (id: string) => {
    console.log('Connecting:', id);
    // Simulate OAuth flow
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'syncing' as const } : c))
    );
    
    setTimeout(() => {
      setConnections(prev =>
        prev.map(c =>
          c.id === id
            ? { ...c, status: 'connected' as const, lastSync: new Date(), itemsCount: 0 }
            : c
        )
      );
    }, 2000);
  };

  const handleDisconnect = async (id: string) => {
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'disconnected' as const } : c))
    );
  };

  const handleSync = async (id: string) => {
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'syncing' as const } : c))
    );
    
    // Simulate sync
    setTimeout(() => {
      setConnections(prev =>
        prev.map(c =>
          c.id === id
            ? {
                ...c,
                status: 'connected' as const,
                lastSync: new Date(),
                itemsCount: (c.itemsCount || 0) + Math.floor(Math.random() * 50),
              }
            : c
        )
      );
    }, 3000);
  };

  return (
    <div className="p-6">
      <ConnectionManager
        connections={connections}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
      />
    </div>
  );
}
