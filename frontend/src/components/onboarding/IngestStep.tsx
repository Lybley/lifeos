'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { CheckCircle, Clock, Database } from 'lucide-react';

interface IngestStepProps {
  onNext: () => void;
  onBack?: () => void;
  onComplete?: () => void;
  complete?: boolean;
}

export const IngestStep: React.FC<IngestStepProps> = ({
  onNext,
  onBack,
  onComplete,
  complete = false,
}) => {
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    emails: 0,
    contacts: 0,
    attachments: 0,
  });

  useEffect(() => {
    if (ingesting) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIngesting(false);
            onComplete?.();
            return 100;
          }
          
          // Update stats as progress increases
          setStats({
            emails: Math.floor((prev / 100) * 1547),
            contacts: Math.floor((prev / 100) * 234),
            attachments: Math.floor((prev / 100) * 89),
          });
          
          return prev + 2;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [ingesting]);

  const handleStartIngest = () => {
    setIngesting(true);
    setProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingest Your Data</CardTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          We'll process your Gmail data and build your personal memory graph.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!complete && !ingesting && (
          <div className="text-center py-8">
            <Database className="w-16 h-16 text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click below to start ingesting your Gmail data. This may take a few minutes.
            </p>
            <Button onClick={handleStartIngest} size="lg">
              Start Ingestion
            </Button>
          </div>
        )}

        {ingesting && (
          <div className="space-y-6">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Processing your data...</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Building nodes, extracting entities, and creating relationships
              </p>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{stats.emails}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Emails</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-accent-600">{stats.contacts}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Contacts</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.attachments}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attachments</p>
              </div>
            </div>
          </div>
        )}

        {complete && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Ingestion Complete!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your memory graph is ready. Let's try your first query.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{stats.emails}</p>
                <p className="text-sm text-gray-600">Emails</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-600">{stats.contacts}</p>
                <p className="text-sm text-gray-600">Contacts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.attachments}</p>
                <p className="text-sm text-gray-600">Attachments</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onBack} disabled={ingesting}>
            ← Back
          </Button>
          <Button onClick={onNext} disabled={!complete}>
            Continue →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
