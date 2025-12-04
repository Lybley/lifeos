'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import apiClient from '@/lib/api-client';
import { CheckCircle, XCircle, Clock, AlertCircle, RotateCcw } from 'lucide-react';

interface Action {
  id: string;
  action_type: string;
  status: string;
  payload: any;
  created_at: string;
  requires_approval: boolean;
}

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      const response = await apiClient.getUserActions('user-123', 50, 0);
      setActions(response.actions || []);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (actionId: string) => {
    try {
      await apiClient.approveAction(actionId, 'user-123');
      await loadActions();
    } catch (error) {
      console.error('Failed to approve action:', error);
    }
  };

  const handleReject = async (actionId: string) => {
    try {
      await apiClient.rejectAction(actionId, 'user-123', 'Rejected by user');
      await loadActions();
    } catch (error) {
      console.error('Failed to reject action:', error);
    }
  };

  const handleRollback = async (actionId: string) => {
    try {
      await apiClient.rollbackAction(actionId, 'user-123', 'User requested rollback');
      await loadActions();
    } catch (error) {
      console.error('Failed to rollback action:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'warning', icon: Clock },
      approved: { variant: 'info', icon: CheckCircle },
      completed: { variant: 'success', icon: CheckCircle },
      failed: { variant: 'error', icon: XCircle },
      rejected: { variant: 'error', icon: XCircle },
    };

    const config = variants[status] || { variant: 'default', icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const filteredActions = filter === 'all' 
    ? actions 
    : actions.filter(a => a.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage AI-generated actions and approvals
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'completed', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === status
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Actions List */}
      <div className="space-y-4">
        {filteredActions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              No actions found
            </CardContent>
          </Card>
        ) : (
          filteredActions.map((action) => (
            <Card key={action.id} hoverable>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg capitalize">
                      {action.action_type.replace(/_/g, ' ')}
                    </h3>
                    {getStatusBadge(action.status)}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>Created: {new Date(action.created_at).toLocaleString()}</p>
                    {action.payload && (
                      <details className="mt-2">
                        <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                          View Payload
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-auto">
                          {JSON.stringify(action.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {action.status === 'pending' && action.requires_approval && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(action.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(action.id)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {action.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                      onClick={() => handleRollback(action.id)}
                    >
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
