/**
 * Tooltip Manager for First 7 Days
 * Shows contextual help tooltips for new users
 */
'use client';

import React, { useState, useEffect } from 'react';
import { X, Lightbulb, ArrowRight } from 'lucide-react';

interface Tooltip {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // ms
}

const DASHBOARD_TOOLTIPS: Tooltip[] = [
  {
    id: 'welcome',
    target: '.dashboard-header',
    title: '👋 Welcome to LifeOS!',
    content: 'This is your command center. All your memories, tasks, and AI agents in one place.',
    position: 'bottom',
    delay: 1000,
  },
  {
    id: 'search',
    target: '.search-bar',
    title: '🔍 Instant Search',
    content: 'Search across all your data. Try typing a person\'s name or a topic you discussed.',
    position: 'bottom',
    delay: 3000,
  },
  {
    id: 'chat',
    target: '.chat-link',
    title: '💬 AI Chat',
    content: 'Ask questions about your data. "When did I last talk to John?" or "What are my priorities?"',
    position: 'right',
    delay: 5000,
  },
  {
    id: 'memory-graph',
    target: '.memory-graph-link',
    title: '🧠 Memory Graph',
    content: 'Visualize how your information is connected. See relationships between people, projects, and ideas.',
    position: 'right',
    delay: 7000,
  },
  {
    id: 'actions',
    target: '.actions-link',
    title: '⚡ Actions',
    content: 'AI-suggested tasks and automations. Review and approve what your agents propose.',
    position: 'right',
    delay: 9000,
  },
];

export function TooltipManager() {
  const [activeTooltip, setActiveTooltip] = useState<Tooltip | null>(null);
  const [dismissedTooltips, setDismissedTooltips] = useState<string[]>([]);
  const [onboardingDate, setOnboardingDate] = useState<Date | null>(null);

  useEffect(() => {
    // Check if user completed onboarding
    const completed = localStorage.getItem('onboarding_completed');
    const dateStr = localStorage.getItem('onboarding_date');
    
    if (!completed || !dateStr) return;

    const date = new Date(dateStr);
    setOnboardingDate(date);

    // Check if within 7 days
    const daysSinceOnboarding = Math.floor(
      (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceOnboarding > 7) return;

    // Load dismissed tooltips
    const dismissed = JSON.parse(localStorage.getItem('dismissed_tooltips') || '[]');
    setDismissedTooltips(dismissed);

    // Show tooltips in sequence
    const showNextTooltip = (index: number) => {
      if (index >= DASHBOARD_TOOLTIPS.length) return;

      const tooltip = DASHBOARD_TOOLTIPS[index];
      if (dismissed.includes(tooltip.id)) {
        showNextTooltip(index + 1);
        return;
      }

      setTimeout(() => {
        // Check if element exists
        const element = document.querySelector(tooltip.target);
        if (element) {
          setActiveTooltip(tooltip);
        } else {
          showNextTooltip(index + 1);
        }
      }, tooltip.delay || 0);
    };

    showNextTooltip(0);
  }, []);

  const dismissTooltip = (tooltipId: string) => {
    const updated = [...dismissedTooltips, tooltipId];
    setDismissedTooltips(updated);
    localStorage.setItem('dismissed_tooltips', JSON.stringify(updated));
    setActiveTooltip(null);

    // Show next tooltip
    const currentIndex = DASHBOARD_TOOLTIPS.findIndex(t => t.id === tooltipId);
    if (currentIndex < DASHBOARD_TOOLTIPS.length - 1) {
      const nextTooltip = DASHBOARD_TOOLTIPS[currentIndex + 1];
      setTimeout(() => {
        const element = document.querySelector(nextTooltip.target);
        if (element && !dismissedTooltips.includes(nextTooltip.id)) {
          setActiveTooltip(nextTooltip);
        }
      }, 1000);
    }
  };

  if (!activeTooltip || !onboardingDate) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Tooltip */}
      <TooltipBubble
        tooltip={activeTooltip}
        onDismiss={() => dismissTooltip(activeTooltip.id)}
      />
    </div>
  );
}

function TooltipBubble({
  tooltip,
  onDismiss,
}: {
  tooltip: Tooltip;
  onDismiss: () => void;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const element = document.querySelector(tooltip.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 150;
      const padding = 16;

      let top = 0;
      let left = 0;

      switch (tooltip.position) {
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          break;
      }

      // Keep within viewport
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (top < padding) top = padding;

      setPosition({ top, left });

      // Highlight target element
      element.classList.add('onboarding-highlight');
      return () => {
        element.classList.remove('onboarding-highlight');
      };
    }
  }, [tooltip]);

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '320px',
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-4 animate-fade-in">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold text-gray-900">{tooltip.title}</h3>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">{tooltip.content}</p>
        <button
          onClick={onDismiss}
          className="flex items-center space-x-2 text-sm text-blue-600 font-medium hover:text-blue-700"
        >
          <span>Got it</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {/* Arrow */}
      <div
        className="absolute w-0 h-0"
        style={{
          ...(tooltip.position === 'bottom' && {
            top: '-8px',
            left: '50%',
            marginLeft: '-8px',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid #3b82f6',
          }),
          ...(tooltip.position === 'right' && {
            left: '-8px',
            top: '50%',
            marginTop: '-8px',
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '8px solid #3b82f6',
          }),
        }}
      />
    </div>
  );
}
