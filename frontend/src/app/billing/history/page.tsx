'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Download, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoice_pdf: string;
  description: string;
}

function BillingHistoryContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      setInvoices([
        {
          id: 'inv_001',
          date: '2025-12-01',
          amount: 29.00,
          status: 'paid',
          invoice_pdf: '#',
          description: 'Pro Plan - December 2025',
        },
        {
          id: 'inv_002',
          date: '2025-11-01',
          amount: 29.00,
          status: 'paid',
          invoice_pdf: '#',
          description: 'Pro Plan - November 2025',
        },
        {
          id: 'inv_003',
          date: '2025-10-01',
          amount: 29.00,
          status: 'paid',
          invoice_pdf: '#',
          description: 'Pro Plan - October 2025',
        },
      ]);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge variant="success">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="warning">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="default">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/billing">
          <Button variant="ghost" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Billing
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Billing History</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and download your past invoices
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading billing history...</div>
      ) : invoices.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoices.map((invoice) => (
                    <tr 
                      key={invoice.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {formatDate(invoice.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {invoice.description}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatAmount(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(invoice.invoice_pdf, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No invoices found</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {invoices.length > 0 && (
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatAmount(
                    invoices
                      .filter(inv => inv.status === 'paid')
                      .reduce((sum, inv) => sum + inv.amount, 0)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Average per Month</p>
                <p className="text-2xl font-bold">
                  {formatAmount(
                    invoices.reduce((sum, inv) => sum + inv.amount, 0) / invoices.length
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingHistoryPage() {
  return (
    <DashboardLayout>
      <BillingHistoryContent />
    </DashboardLayout>
  );
}
