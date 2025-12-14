'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreditCard, TrendingUp, Package, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface BillingPlan {
  id: string;
  plan_name: string;
  display_name: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  vector_quota: number | null;
  agent_quota: number | null;
  auto_actions_enabled: boolean;
  max_team_seats: number;
  features: string[];
  is_popular?: boolean;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

function BillingContent() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = 'test-user-123'; // Replace with actual user ID from auth

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      // Load available plans
      const plansResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/plans`);
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans || []);
      }

      // Load user's current subscription
      const subResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/subscription?userId=${userId}`);
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'past_due':
        return <Badge variant="warning"><AlertCircle className="w-3 h-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="default"><Clock className="w-3 h-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return 'Unlimited';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your subscription, payment methods, and billing history
        </p>
      </div>

      {/* Current Subscription Card */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold">
                    {plans.find(p => p.id === subscription.plan_id)?.display_name || 'Loading...'}
                  </h3>
                  {getStatusBadge(subscription.status)}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {subscription.cancel_at_period_end
                    ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/billing/manage">
                  <Button variant="outline">Manage Subscription</Button>
                </Link>
                <Link href="/billing/history">
                  <Button variant="outline">View History</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/billing/usage">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Usage</p>
                  <p className="text-2xl font-bold mt-1">View Details</p>
                </div>
                <TrendingUp className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing/payment-methods">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payment Methods</p>
                  <p className="text-2xl font-bold mt-1">Manage</p>
                </div>
                <CreditCard className="w-12 h-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing/plans">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Available Plans</p>
                  <p className="text-2xl font-bold mt-1">Upgrade</p>
                </div>
                <Package className="w-12 h-12 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.is_popular ? 'border-2 border-blue-500' : ''}`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge variant="info">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{plan.display_name}</div>
                    <div className="text-3xl font-bold mt-2">
                      {formatPrice(parseFloat(plan.monthly_price))}
                      <span className="text-sm font-normal text-gray-600">/month</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {formatNumber(plan.features.embeddings_limit)} embeddings/month
                    </li>
                    <li className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {formatNumber(plan.features.llm_tokens_limit)} LLM tokens/month
                    </li>
                    <li className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {plan.features.storage_gb}GB storage
                    </li>
                    <li className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {plan.features.support_level} support
                    </li>
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.is_popular ? 'primary' : 'outline'}
                    disabled={subscription?.plan_id === plan.id}
                  >
                    {subscription?.plan_id === plan.id ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <DashboardLayout>
      <BillingContent />
    </DashboardLayout>
  );
}
