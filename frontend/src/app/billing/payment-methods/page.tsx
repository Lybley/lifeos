'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreditCard, Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

function PaymentMethodsContent() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'pm_001',
      brand: 'Visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2025,
      is_default: true,
    },
  ]);
  const [showAddCard, setShowAddCard] = useState(false);

  const getBrandIcon = (brand: string) => {
    return <CreditCard className="w-8 h-8" />;
  };

  const formatExpiry = (month: number, year: number) => {
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(
      paymentMethods.map((pm) => ({
        ...pm,
        is_default: pm.id === id,
      }))
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      setPaymentMethods(paymentMethods.filter((pm) => pm.id !== id));
    }
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
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your payment methods
          </p>
        </div>
        <Button onClick={() => setShowAddCard(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      {/* Payment Methods List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentMethods.map((method) => (
          <Card key={method.id} className="relative">
            {method.is_default && (
              <div className="absolute -top-3 right-4">
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Default
                </Badge>
              </div>
            )}
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                {getBrandIcon(method.brand)}
                <span className="text-lg font-semibold uppercase">{method.brand}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Card Number</span>
                  <span className="font-mono">•••• {method.last4}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Expires</span>
                  <span className="font-mono">
                    {formatExpiry(method.exp_month, method.exp_year)}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                {!method.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSetDefault(method.id)}
                  >
                    Set as Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(method.id)}
                  disabled={method.is_default && paymentMethods.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Card Placeholder */}
        {paymentMethods.length === 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-6 text-center">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No payment methods added yet
              </p>
              <Button onClick={() => setShowAddCard(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Card Modal */}
      {showAddCard && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Add Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Card Number</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">CVC</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1">Add Card</Button>
                <Button variant="outline" onClick={() => setShowAddCard(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Note */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Secure Payment Processing
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                All payment information is encrypted and processed securely through Stripe.
                We never store your full card details on our servers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentMethodsPage() {
  return (
    <DashboardLayout>
      <PaymentMethodsContent />
    </DashboardLayout>
  );
}
