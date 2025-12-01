'use client';

import React from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface UploadProgressProps {
  items: UploadItem[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  items,
  onRetry,
  onCancel,
}) => {
  if (items.length === 0) return null;

  return (
    <Card padding="sm" className="mt-4">
      <h3 className="text-sm font-semibold mb-3">Upload Progress</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                )}
                {item.status === 'error' && (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                {(item.status === 'uploading' || item.status === 'processing') && (
                  <Loader2 className="w-4 h-4 text-primary-600 animate-spin flex-shrink-0" />
                )}
                <span className="text-sm truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.status === 'error' && onRetry && (
                  <button
                    onClick={() => onRetry(item.id)}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Retry
                  </button>
                )}
                {(item.status === 'uploading' || item.status === 'pending') && onCancel && (
                  <button
                    onClick={() => onCancel(item.id)}
                    className="text-xs text-gray-600 hover:underline"
                  >
                    Cancel
                  </button>
                )}
                <span className="text-xs text-gray-500">{item.progress}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  item.status === 'error'
                    ? 'bg-red-600'
                    : item.status === 'completed'
                    ? 'bg-green-600'
                    : 'bg-primary-600'
                }`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {item.error && (
              <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
