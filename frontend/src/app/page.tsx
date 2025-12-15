'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Brain, MessageSquare, Upload, Link as LinkIcon, TrendingUp, Clock, CheckCircle, Heart, Mail, Sparkles, Activity } from 'lucide-react';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { TooltipManager } from '@/components/onboarding/TooltipManager';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

function DashboardContent() {
  const [stats, setStats] = useState({
    totalNodes: 0,
    connections: 0,
    recentActions: 0,
    pendingActions: 0,
    recentEvents: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [healthData, setHealthData] = useState({
    sleep: 7.5,
    steps: 8500,
    mood: 'Good',
    stress: 'Low',
  });
  const [inboxSummary, setInboxSummary] = useState({
    unread: 12,
    important: 3,
    needsReply: 5,
  });
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

      // Mock recent activity
      setRecentActivity([
        { id: 1, type: 'memory', title: 'Added new memory: Project planning notes', timestamp: '2 hours ago' },
        { id: 2, type: 'action', title: 'Completed task: Review Q4 metrics', timestamp: '5 hours ago' },
        { id: 3, type: 'connection', title: 'Gmail synced successfully', timestamp: '1 day ago' },
        { id: 4, type: 'memory', title: 'Created note: Meeting with Sarah', timestamp: '1 day ago' },
      ]);

      // Mock recent memories
      setRecentMemories([
        { id: 1, title: 'Q4 Business Strategy', type: 'document', created: '2024-12-10', tags: ['business', 'strategy'] },
        { id: 2, title: 'Team Meeting Notes', type: 'note', created: '2024-12-12', tags: ['meeting', 'team'] },
        { id: 3, title: 'Product Roadmap 2025', type: 'document', created: '2024-12-14', tags: ['product', 'planning'] },
      ]);

      // Mock health data (in production, integrate with health APIs)
      setHealthData({
        sleep: 7.5,
        steps: 8500,
        mood: 'Good',
        stress: 'Low',
      });

      // Mock inbox summary (in production, sync with Gmail)
      setInboxSummary({
        unread: 12,
        important: 3,
        needsReply: 5,
      });

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
        <Link href="/memory" className="memory-graph-link">
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

        <Link href="/actions" className="actions-link">
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
        <Link href="/chat" className="chat-link">
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

      {/* New Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Health Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sleep</span>
                <span className="font-semibold">{healthData.sleep}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Steps</span>
                <span className="font-semibold">{healthData.steps.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Mood</span>
                <Badge variant="success">{healthData.mood}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Stress Level</span>
                <Badge variant="default">{healthData.stress}</Badge>
              </div>
              <Link href="/settings?tab=health" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  <Activity className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Inbox Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Inbox Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Unread</span>
                <span className="text-2xl font-bold text-blue-600">{inboxSummary.unread}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Important</span>
                <span className="text-2xl font-bold text-orange-600">{inboxSummary.important}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Needs Reply</span>
                <span className="text-2xl font-bold text-purple-600">{inboxSummary.needsReply}</span>
              </div>
              <Link href="/connections" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  Connect Gmail
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Memories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Recent Memories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <h4 className="font-semibold text-sm mb-1">{memory.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Badge variant="default" size="sm">{memory.type}</Badge>
                    <span>{memory.created}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {memory.tags.map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <Link href="/memory" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  View All Memories
                </Button>
              </Link>
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

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
