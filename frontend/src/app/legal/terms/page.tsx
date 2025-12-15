'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/landing" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-gray-600 mt-2">Last updated: December 15, 2025</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Summary */}
        <Card className="mb-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Plain English Summary</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li><CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />You own your data, we just store and process it for you</li>
                  <li><CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />Use the service responsibly and legally</li>
                  <li><CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />We provide the service "as-is" with reasonable effort</li>
                  <li><CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />You can cancel anytime, we'll delete your data</li>
                  <li><CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />Disputes are resolved through arbitration</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms Content */}
        <Card className="mb-8">
          <CardContent className="prose max-w-none p-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing or using LifeOS ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of these terms, you may not access the Service.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">2. Description of Service</h2>
            <p className="mb-4">
              LifeOS is an AI-powered personal memory and productivity platform that helps you:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Store and organize information from various sources</li>
              <li>Generate intelligent summaries and insights</li>
              <li>Automate tasks through AI agents</li>
              <li>Retrieve information through natural language queries</li>
              <li>Connect with external services (Gmail, Calendar, Drive)</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">3. User Accounts</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">3.1 Account Creation</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You must be at least 16 years old to create an account</li>
              <li>You must provide accurate and complete information</li>
              <li>You are responsible for maintaining account security</li>
              <li>You must not share your account credentials</li>
              <li>One person or entity per account</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Security</h3>
            <p className="mb-4">You are responsible for:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Choosing a strong password</li>
              <li>Enabling multi-factor authentication (recommended)</li>
              <li>Notifying us immediately of unauthorized access</li>
              <li>All activities that occur under your account</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">4. Acceptable Use</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Permitted Use</h3>
            <p className="mb-4">You may use LifeOS for:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Personal productivity and knowledge management</li>
              <li>Business purposes within your organization</li>
              <li>Educational and research purposes</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Prohibited Activities</h3>
            <p className="mb-4">You must NOT:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Violate any laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Upload malicious code, viruses, or malware</li>
              <li>Attempt to access other users' data</li>
              <li>Reverse engineer, decompile, or hack the Service</li>
              <li>Use automated tools to scrape or mine data (except API)</li>
              <li>Resell or redistribute the Service without permission</li>
              <li>Use the Service to store or distribute illegal content</li>
              <li>Impersonate others or provide false information</li>
              <li>Harass, threaten, or harm other users</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">5. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Your Content</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>You Own It:</strong> You retain all rights to content you upload</li>
              <li><strong>License to Us:</strong> You grant us a license to store, process, and display your content to provide the Service</li>
              <li><strong>AI Processing:</strong> You consent to AI analysis of your content for features like summaries, embeddings, and suggestions</li>
              <li><strong>No Sharing:</strong> We will not share your content with third parties (except as required by law)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Our Content</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>LifeOS platform, code, and design are owned by us</li>
              <li>Trademarks, logos, and branding are protected</li>
              <li>You may not copy, modify, or distribute our intellectual property</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">6. Subscription & Billing</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">6.1 Plans</h3>
            <p className="mb-4">We offer multiple subscription tiers:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Free:</strong> Limited features and usage quotas</li>
              <li><strong>Pro:</strong> Enhanced features and higher quotas</li>
              <li><strong>Team:</strong> Multi-user collaboration</li>
              <li><strong>Enterprise:</strong> Custom solutions</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">6.2 Payment</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Subscriptions are billed monthly or annually</li>
              <li>Prices are in USD unless otherwise stated</li>
              <li>Payment processing via Stripe (PCI compliant)</li>
              <li>Auto-renewal unless you cancel</li>
              <li>No refunds for partial months</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">6.3 Cancellation</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Cancel anytime from your account settings</li>
              <li>Access continues until end of billing period</li>
              <li>Data retained for 30 days after cancellation</li>
              <li>Export your data before account deletion</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">7. Service Availability</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">7.1 Uptime</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>We strive for 99.9% uptime (not guaranteed for Free tier)</li>
              <li>Scheduled maintenance will be announced in advance</li>
              <li>Emergency maintenance may occur without notice</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">7.2 Changes to Service</h3>
            <p className="mb-4">We reserve the right to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Modify or discontinue features</li>
              <li>Change subscription prices (with 30 days notice)</li>
              <li>Update system requirements</li>
              <li>Improve and evolve the platform</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">8. Data & Privacy</h2>
            <p className="mb-4">
              Your privacy is governed by our{' '}
              <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
              Key points:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>We encrypt data in transit and at rest</li>
              <li>You can export or delete your data anytime</li>
              <li>We comply with GDPR, CCPA, and other privacy laws</li>
              <li>Client-side vault encryption for sensitive data</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">9. Disclaimers & Limitations</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">9.1 "As-Is" Service</h3>
            <p className="mb-4">
              THE SERVICE IS PROVIDED "AS-IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. 
              We do not guarantee error-free, uninterrupted, or secure operation.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">9.2 AI Accuracy</h3>
            <p className="mb-4">
              AI-generated content (summaries, suggestions, etc.) may contain errors. 
              Always verify important information. We are not liable for decisions made based on AI outputs.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">9.3 Limitation of Liability</h3>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Indirect, incidental, or consequential damages</li>
              <li>Loss of data, profits, or business opportunities</li>
              <li>Damages exceeding the amount you paid in the last 12 months</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">10. Indemnification</h2>
            <p className="mb-4">
              You agree to indemnify and hold us harmless from claims arising from:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your content or data</li>
              <li>Your infringement of third-party rights</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">11. Termination</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">11.1 By You</h3>
            <p className="mb-4">You may terminate by canceling your subscription and deleting your account.</p>

            <h3 className="text-xl font-semibold mb-3 mt-6">11.2 By Us</h3>
            <p className="mb-4">We may suspend or terminate your account if:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You violate these Terms</li>
              <li>You engage in fraudulent activity</li>
              <li>Your account is inactive for 2+ years</li>
              <li>Required by law</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">12. Dispute Resolution</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">12.1 Informal Resolution</h3>
            <p className="mb-4">
              Please contact us at{' '}
              <a href="mailto:support@lifeos.app" className="text-blue-600 hover:underline">support@lifeos.app</a>{' '}
              before initiating formal proceedings. We'll work to resolve disputes informally.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">12.2 Arbitration</h3>
            <p className="mb-4">
              If informal resolution fails, disputes will be resolved through binding arbitration (not court), 
              except for small claims court matters. Arbitration is conducted individually, not as a class action.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">12.3 Governing Law</h3>
            <p className="mb-4">
              These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">13. Changes to Terms</h2>
            <p className="mb-4">
              We may update these Terms occasionally. Significant changes will be notified via email or in-app. 
              Continued use after changes constitutes acceptance. Check this page periodically for updates.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">14. Contact Information</h2>
            <p className="mb-4">For questions about these Terms:</p>
            <ul className="list-none mb-4 space-y-2">
              <li>Email: <a href="mailto:legal@lifeos.app" className="text-blue-600 hover:underline">legal@lifeos.app</a></li>
              <li>Support: <a href="mailto:support@lifeos.app" className="text-blue-600 hover:underline">support@lifeos.app</a></li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">15. Miscellaneous</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Entire Agreement:</strong> These Terms constitute the entire agreement between you and LifeOS</li>
              <li><strong>Severability:</strong> If any provision is unenforceable, the rest remains in effect</li>
              <li><strong>Waiver:</strong> Our failure to enforce a right doesn't waive that right</li>
              <li><strong>Assignment:</strong> You may not assign these Terms; we may assign to affiliates or successors</li>
            </ul>
          </CardContent>
        </Card>

        {/* Alert Box */}
        <Card className="mb-8 bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Important Legal Notice</h3>
                <p className="text-sm text-gray-700">
                  This is a binding legal agreement. By using LifeOS, you acknowledge that you have read, 
                  understood, and agree to be bound by these Terms of Service. If you do not agree, 
                  please do not use the Service.
                </p>
              </div>
            </div>
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
              <Link href="/legal/cookies" className="hover:text-white">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
