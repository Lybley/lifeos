'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Brain, MessageSquare, Zap, Lock } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <Card className="text-center p-12">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 mb-4">
          <Brain className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
          Welcome to LifeOS
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Your Personal Memory Graph powered by AI. Connect your data sources, and get intelligent insights from everything you know.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <MessageSquare className="w-8 h-8 text-primary-600 mb-3" />
          <h3 className="font-semibold mb-2">Natural Conversations</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Chat with your data naturally. Get answers with citations and sources.
          </p>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Zap className="w-8 h-8 text-accent-600 mb-3" />
          <h3 className="font-semibold mb-2">AI Actions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Let AI take actions on your behalf - with your approval.
          </p>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Lock className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-semibold mb-2">Private & Secure</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your data stays yours. End-to-end encryption and local processing.
          </p>
        </div>
      </div>

      <Button size="lg" onClick={onNext} className="px-12">
        Get Started →
      </Button>
    </Card>
  );
};
