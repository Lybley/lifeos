'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Clock, Settings } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface Connection {
  id: string;
  name: string;
  type: 'gmail' | 'google-drive' | 'google-calendar' | 'slack' | 'notion';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: Date;
  itemsCount?: number;
  icon: string;
  description?: string;
}

interface ConnectionCardProps {
  connection: Connection;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfigure?: () => void;
  onSync?: () => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onConnect,
  onDisconnect,
  onConfigure,
  onSync,
}) => {
  const getStatusBadge = () => {
    switch (connection.status) {
      case 'connected':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Connected
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="info" className="gap-1">
            <Clock className="w-3 h-3 animate-spin" />
            Syncing
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="error" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="default">Disconnected</Badge>;
    }
  };

  return (
    <Card hover className="relative">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
            {connection.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{connection.name}</h3>
              {getStatusBadge()}
            </div>
            {connection.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {connection.description}
              </p>
            )}
            {connection.lastSync && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Last synced: {new Date(connection.lastSync).toLocaleString()}
              </p>
            )}
            {connection.itemsCount !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {connection.itemsCount.toLocaleString()} items
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onConfigure}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        {connection.status === 'connected' ? (
          <>
            <Button size="sm" variant="outline" onClick={onSync}>
              Sync Now
            </Button>
            <Button size="sm" variant="ghost" onClick={onDisconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onConnect}>
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
};
