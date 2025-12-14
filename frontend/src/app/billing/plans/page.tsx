'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface BillingPlan {
  id: string;
  name: string;
  stripe_price_id: string;
  price_monthly: number;
  features: {
    embeddings_limit: number;
    llm_tokens_limit: number;
    storage_gb: number;
    support_level: string;
    additional_features?: string[];
  };
  is_popular?: boolean;
}

function PlansContent() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/plans`
      );
      if (response.ok) {
        const data = await response.json();
        // Add additional features for display
        const enhancedPlans = data.plans.map((plan: BillingPlan) => ({
          ...plan,
          features: {
            ...plan.features,
            additional_features: getAdditionalFeatures(plan.name),
          },
          is_popular: plan.name === 'Pro',
        }));
        setPlans(enhancedPlans);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAdditionalFeatures = (planName: string) => {
    const features: { [key: string]: string[] } = {
      Free: ['Basic AI features', 'Community support', '7-day data retention'],
      Pro: ['Advanced AI features', 'Priority support', '30-day data retention', 'Custom integrations'],
      Team: ['Team collaboration', '24/7 support', '90-day data retention', 'Advanced analytics', 'API access'],
      Enterprise: ['Dedicated account manager', 'SLA guarantee', 'Unlimited data retention', 'Custom AI training', 'On-premise deployment'],
    };
    return features[planName] || [];
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <Link href="/billing">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Billing
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Select the perfect plan for your needs
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading plans...</div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.is_popular
                    ? 'border-2 border-blue-500 shadow-xl scale-105'
                    : 'border border-gray-200'
                } transition-all duration-300 hover:shadow-2xl`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge variant="info" className="px-4 py-1">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-6">
                  <CardTitle>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {plan.name}
                    </div>
                    <div className="mt-4 flex items-baseline justify-center">
                      <span className="text-5xl font-extrabold">
                        {formatPrice(plan.price_monthly)}
                      </span>
                      <span className="text-xl font-medium text-gray-600 ml-2">/month</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        <strong>{formatNumber(plan.features.embeddings_limit)}</strong> embeddings/month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        <strong>{formatNumber(plan.features.llm_tokens_limit)}</strong> LLM tokens/month
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        <strong>{plan.features.storage_gb}GB</strong> storage
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm"><strong>{plan.features.support_level}</strong> support</span>
                    </li>
                    {plan.features.additional_features?.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.is_popular ? 'primary' : 'outline'}
                    size="lg"
                    disabled={currentPlanId === plan.id}
                  >
                    {currentPlanId === plan.id ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <Card className="mt-12">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">What happens if I exceed my limits?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You'll receive notifications as you approach your limits. You can either upgrade your plan or purchase additional capacity.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Do you offer annual billing?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Yes! Annual plans offer a 20% discount. Contact our sales team for more information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <DashboardLayout>
      <PlansContent />
    </DashboardLayout>
  );
}
