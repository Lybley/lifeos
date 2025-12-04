/**
 * Admin Dashboard - Main Overview Page
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: {
      status: string;
      latency_ms: number;
      active_connections: number;
    };
    api: {
      status: string;
      uptime_seconds: number;
    };
  };
}

interface MetricsOverview {
  userStats: {
    total_users: string;
    active_users: string;
    suspended_users: string;
  };
  recentMetrics: any[];
  activityTrends: any[];
}

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/admin/health`, {
          headers: { 'x-admin-user-id': 'admin-001' },
        }),
        fetch(`${apiUrl}/api/v1/admin/metrics/overview`, {
          headers: { 'x-admin-user-id': 'admin-001' },
        }),
      ]);

      const healthData = await healthRes.json();
      const metricsData = await metricsRes.json();

      setHealth(healthData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Multi-tenant management, metrics, and support
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => router.push('/admin/users')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics?.userStats.total_users || 0}
                </p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {metrics?.userStats.active_users || 0} active
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/metrics')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Metrics</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics?.recentMetrics.length || 0}
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">System metrics</p>
          </button>

          <button
            onClick={() => router.push('/admin/tickets')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Support</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <div className="text-3xl">🎫</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Open tickets</p>
          </button>

          <button
            onClick={() => router.push('/admin/audit')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Audit Logs</p>
                <p className="text-2xl font-bold text-gray-900">View</p>
              </div>
              <div className="text-3xl">📝</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Admin actions</p>
          </button>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          {health && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Overall Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {health.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="text-sm">
                  {health.services.database.status} ({health.services.database.latency_ms}ms)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Uptime</span>
                <span className="text-sm">
                  {Math.floor(health.services.api.uptime_seconds / 60)} minutes
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {metrics?.activityTrends && metrics.activityTrends.length > 0 ? (
            <div className="space-y-2">
              {metrics.activityTrends.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">{activity.activity_type}</span>
                  <span className="text-sm font-medium">{activity.count} events</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
