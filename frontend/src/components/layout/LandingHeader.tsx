'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export const LandingHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">Z</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                Zumffer
              </span>
              <span className="text-xs text-gray-500 font-medium tracking-wide">
                LifeOS
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-gray-600 hover:text-primary-600 transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="text-gray-600 hover:text-primary-600 transition-colors">
              Pricing
            </Link>
            <Link href="/legal/privacy" className="text-gray-600 hover:text-primary-600 transition-colors">
              Privacy
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-primary-600 transition-colors">
              Dashboard
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="md">
                Sign In
              </Button>
            </Link>
            <Link href="/#signup">
              <Button variant="primary" size="md">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};
