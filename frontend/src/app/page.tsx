'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Brain, MessageSquare, Upload, Link as LinkIcon, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { TooltipManager } from '@/components/onboarding/TooltipManager';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalNodes: 0,
    connections: 0,
    recentActions: 0,
    pendingActions: 0,
    recentEvents: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = 'test-user-123'; // Mock user ID

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load nodes
      const nodes = await apiClient.getNodes();
      
      // Load actions
      const actions = await apiClient.getUserActions(userId, 20);
      const pendingActions = actions?.actions?.filter((a: any) => a.status === 'pending') || [];
      
      // Load events
      const events = await apiClient.getEvents(userId, { limit: 10 });
      
      setStats({
        totalNodes: nodes?.length || 0,
        connections: 3, // Static for now
        recentActions: actions?.actions?.length || 0,
        pendingActions: pendingActions.length,
        recentEvents: events?.events?.length || 0,
      });

      // Combine recent activity
      const activity: any[] = [];
      
      // Add recent actions
      if (actions?.actions) {
        actions.actions.slice(0, 3).forEach((action: any) => {
          activity.push({
            id: action.id,
            type: 'action',
            title: `${action.action_type}: ${action.status}`,
            time: new Date(action.created_at).toLocaleString(),
          });
        });
      }

      // Add recent events
      if (events?.events) {
        events.events.slice(0, 2).forEach((event: any) => {
          activity.push({
            id: event.id,
            type: 'event',
            title: `${event.event_type}`,
            time: new Date(event.event_time).toLocaleString(),
          });
        });
      }

      setRecentActivity(activity);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'action':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'sync':
        return <LinkIcon className="w-5 h-5 text-purple-600" />;
      case 'upload':
        return <Upload className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back! Here's what's happening with your LifeOS.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/memory">
          <Card hoverable className="h-full">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Memories</p>
                <p className="text-3xl font-bold">{stats.totalNodes}</p>
                <Badge variant="success" size="sm" className="mt-2">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12% this week
                </Badge>
              </div>
              <Brain className="w-12 h-12 text-primary-600 opacity-50" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/connections">
          <Card hoverable className="h-full">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Connections</p>
                <p className="text-3xl font-bold">{stats.connections}</p>
                <Badge variant="info" size="sm" className="mt-2">
                  Active
                </Badge>
              </div>
              <LinkIcon className="w-12 h-12 text-green-600 opacity-50" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/actions">
          <Card hoverable className="h-full">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Recent Actions</p>
                <p className="text-3xl font-bold">{stats.recentActions}</p>
                <Badge variant="warning" size="sm" className="mt-2">
                  {stats.pendingActions} pending
                </Badge>
              </div>
              <CheckCircle className="w-12 h-12 text-purple-600 opacity-50" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin">
          <Card hoverable className="h-full">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Recent Events</p>
                <p className="text-3xl font-bold">{stats.recentEvents}</p>
                <Badge variant="info" size="sm" className="mt-2">
                  Live
                </Badge>
              </div>
              <TrendingUp className="w-12 h-12 text-green-600 opacity-50" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          Loading dashboard data...
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/chat">
          <Button variant="outline" className="w-full justify-start" size="lg">
            <MessageSquare className="w-5 h-5 mr-2" />
            Ask a Question
          </Button>
        </Link>
        <Link href="/upload">
          <Button variant="outline" className="w-full justify-start" size="lg">
            <Upload className="w-5 h-5 mr-2" />
            Upload Files
          </Button>
        </Link>
        <Link href="/connections">
          <Button variant="outline" className="w-full justify-start" size="lg">
            <LinkIcon className="w-5 h-5 mr-2" />
            Manage Connections
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  Most Active Contact
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  Sarah Johnson
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">47 interactions this month</p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                  Most Referenced Topic
                </p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  Q4 Planning
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300">Mentioned in 23 documents</p>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                  Upcoming Deadline
                </p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  Project Proposal
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">Due in 3 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Onboarding Components */}
      <OnboardingChecklist />
      <TooltipManager />
    </div>
  );
}
