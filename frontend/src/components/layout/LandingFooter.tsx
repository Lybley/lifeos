'use client';

import React from 'react';
import Link from 'next/link';
import { Brain, Twitter, Github, Linkedin, Mail } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">Z</span>
              </div>
              <div className="flex flex-col -space-y-1">
                <span className="text-xl font-bold text-white">Zumffer</span>
                <span className="text-xs text-gray-400 font-medium tracking-wide">LifeOS</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Zumffer LifeOS - Your AI-powered second brain. Remember everything, automate anything.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/zumffer" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://github.com/zumffer" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com/company/zumffer" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="mailto:hello@zumffer.com" className="hover:text-primary-400 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/#features" className="text-sm hover:text-primary-400 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-sm hover:text-primary-400 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm hover:text-primary-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/chat" className="text-sm hover:text-primary-400 transition-colors">
                  AI Chat
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/privacy" className="text-sm hover:text-primary-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-sm hover:text-primary-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/cookies" className="text-sm hover:text-primary-400 transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm hover:text-primary-400 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-primary-400 transition-colors">
                  API Reference
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-primary-400 transition-colors">
                  Support
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-primary-400 transition-colors">
                  Status
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Zumffer LifeOS. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Built with ❤️ by Zumffer for productivity enthusiasts
          </p>
        </div>
      </div>
    </footer>
  );
};
