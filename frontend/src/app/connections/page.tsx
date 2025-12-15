'use client';

import React, { useState } from 'react';
import { ConnectionManager } from '@/components/connections/ConnectionManager';
import { Connection } from '@/components/connections/ConnectionCard';

export default function ConnectionsPage() {
  // Available connections - all start as disconnected for new users
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: '1',
      name: 'Gmail',
      type: 'gmail',
      status: 'disconnected',
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
      status: 'disconnected',
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
    // TODO: Implement real OAuth flow with backend
    // For now, show user that connections need to be set up
    alert('Connection setup not yet implemented. This will integrate with real OAuth providers once configured.');
    
    // Placeholder for future implementation:
    // 1. Call backend API to initiate OAuth flow
    // 2. Redirect to provider's authorization page
    // 3. Handle OAuth callback
    // 4. Update connection status in backend
  };

  const handleDisconnect = async (id: string) => {
    // TODO: Implement real disconnection with backend
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'disconnected' as const, lastSync: undefined, itemsCount: undefined } : c))
    );
  };

  const handleSync = async (id: string) => {
    // TODO: Implement real sync with backend
    alert('Sync functionality will be available once connections are properly configured with OAuth.');
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
