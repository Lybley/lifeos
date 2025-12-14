'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TrendingUp, Database, Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface UsageData {
  embeddings: {
    used: number;
    limit: number;
    percentage: number;
  };
  llm_tokens: {
    used: number;
    limit: number;
    percentage: number;
  };
  storage: {
    used_gb: number;
    limit_gb: number;
    percentage: number;
  };
}

function UsageContent() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = 'test-user-123';

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/usage/${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        // Mock data for display purposes
        setUsage({
          embeddings: {
            used: 25000,
            limit: 50000,
            percentage: 50,
          },
          llm_tokens: {
            used: 350000,
            limit: 500000,
            percentage: 70,
          },
          storage: {
            used_gb: 2.5,
            limit_gb: 10,
            percentage: 25,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/billing">
            <Button variant="ghost" className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Billing
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Usage & Limits</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your monthly usage across all features
          </p>
        </div>
        <Badge variant="info">Current Billing Period</Badge>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading usage data...</div>
      ) : usage ? (
        <>
          {/* Usage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Embeddings Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Database className="w-5 h-5 mr-2 text-blue-600" />
                    Embeddings
                  </span>
                  <Badge 
                    variant={usage.embeddings.percentage >= 90 ? 'warning' : 'default'}
                  >
                    {usage.embeddings.percentage}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Used</span>
                      <span className="font-semibold">
                        {formatNumber(usage.embeddings.used)} / {formatNumber(usage.embeddings.limit)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(usage.embeddings.percentage)} transition-all duration-500`}
                        style={{ width: `${usage.embeddings.percentage}%` }}
                      />
                    </div>
                  </div>
                  {usage.embeddings.percentage >= 75 && (
                    <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                      ⚠️ Approaching limit. Consider upgrading your plan.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* LLM Tokens Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-purple-600" />
                    LLM Tokens
                  </span>
                  <Badge 
                    variant={usage.llm_tokens.percentage >= 90 ? 'warning' : 'default'}
                  >
                    {usage.llm_tokens.percentage}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Used</span>
                      <span className="font-semibold">
                        {formatNumber(usage.llm_tokens.used)} / {formatNumber(usage.llm_tokens.limit)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(usage.llm_tokens.percentage)} transition-all duration-500`}
                        style={{ width: `${usage.llm_tokens.percentage}%` }}
                      />
                    </div>
                  </div>
                  {usage.llm_tokens.percentage >= 75 && (
                    <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                      ⚠️ Approaching limit. Consider upgrading your plan.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Storage Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Storage
                  </span>
                  <Badge 
                    variant={usage.storage.percentage >= 90 ? 'warning' : 'default'}
                  >
                    {usage.storage.percentage}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Used</span>
                      <span className="font-semibold">
                        {usage.storage.used_gb.toFixed(2)}GB / {usage.storage.limit_gb}GB
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(usage.storage.percentage)} transition-all duration-500`}
                        style={{ width: `${usage.storage.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage History Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500">Usage chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade CTA */}
          {(usage.embeddings.percentage >= 75 || usage.llm_tokens.percentage >= 75) && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Need More Resources?</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Upgrade your plan to get higher limits and unlock premium features.
                    </p>
                  </div>
                  <Link href="/billing/plans">
                    <Button size="lg">View Plans</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No usage data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function UsagePage() {
  return (
    <DashboardLayout>
      <UsageContent />
    </DashboardLayout>
  );
}
