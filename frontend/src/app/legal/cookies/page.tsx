'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Cookie, CheckCircle, XCircle, Settings } from 'lucide-react';
import Link from 'next/link';

export default function CookiePolicyPage() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [functionalEnabled, setFunctionalEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSavePreferences = () => {
    // Save to localStorage
    localStorage.setItem('cookie_preferences', JSON.stringify({
      analytics: analyticsEnabled,
      functional: functionalEnabled,
      essential: true, // Always required
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/landing" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Cookie Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: December 15, 2025</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Overview */}
        <Card className="mb-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Cookie className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">What Are Cookies?</h3>
                <p className="text-sm text-gray-700">
                  Cookies are small text files stored on your device when you visit a website. 
                  They help us remember your preferences, keep you logged in, and understand how you use our service.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cookie Preferences */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Your Cookie Preferences
            </h2>

            {/* Essential Cookies */}
            <div className="mb-6 pb-6 border-b">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Essential Cookies</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Required for the website to function. Cannot be disabled.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Always Active</span>
                </div>
              </div>
              <ul className="text-sm text-gray-600 space-y-1 mt-3">
                <li>• Authentication (keeping you logged in)</li>
                <li>• Security (CSRF protection, session management)</li>
                <li>• Load balancing</li>
              </ul>
            </div>

            {/* Functional Cookies */}
            <div className="mb-6 pb-6 border-b">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Functional Cookies</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Remember your preferences and settings for a better experience.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={functionalEnabled}
                    onChange={(e) => setFunctionalEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <ul className="text-sm text-gray-600 space-y-1 mt-3">
                <li>• Language preferences</li>
                <li>• Theme selection (dark/light mode)</li>
                <li>• Dashboard layout preferences</li>
                <li>• Notification settings</li>
              </ul>
            </div>

            {/* Analytics Cookies */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Analytics Cookies</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Help us understand how you use the service so we can improve it. Data is anonymized.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <ul className="text-sm text-gray-600 space-y-1 mt-3">
                <li>• Page views and navigation paths</li>
                <li>• Feature usage statistics</li>
                <li>• Error tracking (anonymized)</li>
                <li>• Performance metrics</li>
              </ul>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <Button onClick={handleSavePreferences}>
                {saved ? '✓ Preferences Saved!' : 'Save Preferences'}
              </Button>
              <Button variant="outline" onClick={() => {
                setAnalyticsEnabled(false);
                setFunctionalEnabled(false);
              }}>
                Reject All Non-Essential
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Cookie Information */}
        <Card className="mb-8">
          <CardContent className="prose max-w-none p-8">
            <h2 className="text-2xl font-bold mb-4">Detailed Cookie Information</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">1. Essential Cookies</h3>
            <table className="min-w-full text-sm mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Purpose</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2"><code>lifeos_session</code></td>
                  <td className="px-4 py-2">Maintains your login session</td>
                  <td className="px-4 py-2">7 days</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>csrf_token</code></td>
                  <td className="px-4 py-2">Security protection</td>
                  <td className="px-4 py-2">Session</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>load_balancer</code></td>
                  <td className="px-4 py-2">Routes requests to servers</td>
                  <td className="px-4 py-2">Session</td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-xl font-semibold mb-3 mt-6">2. Functional Cookies</h3>
            <table className="min-w-full text-sm mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Purpose</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2"><code>user_preferences</code></td>
                  <td className="px-4 py-2">Stores your settings</td>
                  <td className="px-4 py-2">1 year</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>theme</code></td>
                  <td className="px-4 py-2">Dark/light mode preference</td>
                  <td className="px-4 py-2">1 year</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>language</code></td>
                  <td className="px-4 py-2">Your language selection</td>
                  <td className="px-4 py-2">1 year</td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-xl font-semibold mb-3 mt-6">3. Analytics Cookies</h3>
            <table className="min-w-full text-sm mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Purpose</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2"><code>_ga</code></td>
                  <td className="px-4 py-2">Google Analytics (anonymized)</td>
                  <td className="px-4 py-2">2 years</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>_gid</code></td>
                  <td className="px-4 py-2">Google Analytics session</td>
                  <td className="px-4 py-2">24 hours</td>
                </tr>
                <tr>
                  <td className="px-4 py-2"><code>analytics_id</code></td>
                  <td className="px-4 py-2">Internal analytics</td>
                  <td className="px-4 py-2">90 days</td>
                </tr>
              </tbody>
            </table>

            <h2 className="text-2xl font-bold mb-4 mt-8">Managing Cookies</h2>
            <p className="mb-4">You can control cookies through:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>This page:</strong> Use the preferences above</li>
              <li><strong>Browser settings:</strong> Block or delete cookies (may affect functionality)</li>
              <li><strong>Opt-out tools:</strong> Google Analytics opt-out browser addon</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Third-Party Cookies</h2>
            <p className="mb-4">We do not use third-party advertising cookies. Analytics cookies may be set by:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Google Analytics (anonymized IP addresses)</li>
              <li>These are subject to their respective privacy policies</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Updates to This Policy</h2>
            <p className="mb-4">
              We may update this Cookie Policy. Changes will be posted on this page with an updated revision date.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Contact</h2>
            <p className="mb-4">
              Questions about cookies? Email us at{' '}
              <a href="mailto:privacy@lifeos.app" className="text-blue-600 hover:underline">privacy@lifeos.app</a>
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-sm">© 2025 LifeOS. All rights reserved.</p>
            <div className="flex space-x-6 text-sm">
              <Link href="/legal/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/legal/terms" className="hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
