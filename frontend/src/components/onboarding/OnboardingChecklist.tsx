/**
 * Onboarding Checklist UI
 * Shows progress and next steps for new users
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle,
  Circle,
  X,
  Mail,
  Upload,
  MessageSquare,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  link?: string;
  action?: () => void;
}

export function OnboardingChecklist() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    // Check if onboarding is completed
    const completed = localStorage.getItem('onboarding_completed');
    if (!completed) {
      setVisible(false);
      return;
    }

    // Check if checklist was dismissed
    const dismissed = localStorage.getItem('checklist_dismissed');
    if (dismissed) {
      setVisible(false);
      return;
    }

    // Check if within 7 days
    const dateStr = localStorage.getItem('onboarding_date');
    if (dateStr) {
      const date = new Date(dateStr);
      const daysSince = Math.floor(
        (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince > 7) {
        setVisible(false);
        return;
      }
    }

    // Load checklist state
    const savedState = JSON.parse(
      localStorage.getItem('checklist_state') || '{}'
    );

    setItems([
      {
        id: 'connect-email',
        title: 'Connect your email',
        description: 'Let LifeOS organize your inbox',
        icon: <Mail className="w-5 h-5" />,
        completed: savedState.connect_email || false,
        link: '/settings/integrations',
      },
      {
        id: 'import-files',
        title: 'Import your files',
        description: 'Add notes, documents, or PDFs',
        icon: <Upload className="w-5 h-5" />,
        completed: savedState.import_files || false,
        link: '/upload',
      },
      {
        id: 'first-chat',
        title: 'Ask your first question',
        description: 'Try the AI chat feature',
        icon: <MessageSquare className="w-5 h-5" />,
        completed: savedState.first_chat || false,
        link: '/chat',
      },
      {
        id: 'setup-calendar',
        title: 'Connect your calendar',
        description: 'Enable smart scheduling',
        icon: <Calendar className="w-5 h-5" />,
        completed: savedState.setup_calendar || false,
        link: '/settings/integrations',
      },
      {
        id: 'deploy-agent',
        title: 'Deploy your first AI agent',
        description: 'Automate a repetitive task',
        icon: <Sparkles className="w-5 h-5" />,
        completed: savedState.deploy_agent || false,
        link: '/actions',
      },
      {
        id: 'explore-memory',
        title: 'Explore your memory graph',
        description: 'See how your data connects',
        icon: <TrendingUp className="w-5 h-5" />,
        completed: savedState.explore_memory || false,
        link: '/memory',
      },
    ]);
  }, []);

  const completedCount = items.filter(item => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  const handleDismiss = () => {
    localStorage.setItem('checklist_dismissed', 'true');
    setVisible(false);
  };

  const handleItemClick = (item: ChecklistItem) => {
    if (item.action) {
      item.action();
    } else if (item.link) {
      router.push(item.link);
    }
  };

  const markComplete = (itemId: string) => {
    const savedState = JSON.parse(
      localStorage.getItem('checklist_state') || '{}'
    );
    savedState[itemId] = true;
    localStorage.setItem('checklist_state', JSON.stringify(savedState));

    setItems(items.map(item => 
      item.id === itemId ? { ...item, completed: true } : item
    ));
  };

  if (!visible) return null;

  return (
    <Card className="fixed bottom-6 right-6 w-96 p-6 shadow-2xl z-40 border-2 border-blue-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900 mb-1">
            🚀 Getting Started
          </h3>
          <p className="text-sm text-gray-600">
            {completedCount} of {items.length} completed
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            disabled={item.completed}
          >
            <div className="flex-shrink-0 mt-0.5">
              {item.completed ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <div className="text-gray-600">{item.icon}</div>
                <h4
                  className={`font-medium text-sm ${
                    item.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                >
                  {item.title}
                </h4>
              </div>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            {!item.completed && (
              <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
            )}
          </button>
        ))}
      </div>

      {/* Completion Message */}
      {completedCount === items.length && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-green-900">All done!</h4>
          </div>
          <p className="text-sm text-green-800">
            Great job! You're all set to master your productivity with LifeOS.
          </p>
        </div>
      )}

      {/* Help Link */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
        <a
          href="#"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Need help? Watch tutorial →
        </a>
      </div>
    </Card>
  );
}
