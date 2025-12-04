'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface ConnectGmailStepProps {
  onNext: () => void;
  onBack?: () => void;
  onConnected?: () => void;
  connected?: boolean;
}

export const ConnectGmailStep: React.FC<ConnectGmailStepProps> = ({
  onNext,
  onBack,
  onConnected,
  connected = false,
}) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();

  const handleConnect = async () => {
    setConnecting(true);
    setError(undefined);

    try {
      // Simulate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would open OAuth window:
      // window.open('/api/auth/gmail', 'gmail-oauth', 'width=600,height=700');
      
      onConnected?.();
    } catch (err) {
      setError('Failed to connect to Gmail. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Your Gmail</CardTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Connect your Gmail account to start building your memory graph from emails.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gmail Card */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
            <Mail className="w-8 h-8 text-red-600" />
          </div>
          
          {connected ? (
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-xl font-semibold">Gmail Connected!</h3>
              </div>
              <Badge variant="success">Ready to ingest</Badge>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-semibold mb-2">Gmail</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                We'll sync your emails, contacts, and labels.
              </p>
              <Button
                onClick={handleConnect}
                loading={connecting}
                leftIcon={<Mail className="w-4 h-4" />}
              >
                Connect Gmail
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-200">What we collect:</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>✓ Email content and metadata</li>
            <li>✓ Sender and recipient information</li>
            <li>✓ Attachments and labels</li>
            <li>✗ We never store your password</li>
            <li>✗ You can disconnect anytime</li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button onClick={onNext} disabled={!connected}>
            Continue →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
