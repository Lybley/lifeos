'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Shield, Lock, Eye, Download, Trash2, Mail } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/landing" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: December 15, 2025</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Key Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardContent className="pt-6">
              <Shield className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Your Data, Your Control</h3>
              <p className="text-sm text-gray-600">You own your data. We never sell it to third parties.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Lock className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">End-to-End Encryption</h3>
              <p className="text-sm text-gray-600">Client-side vault encryption. We can't read your sensitive data.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Eye className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Full Transparency</h3>
              <p className="text-sm text-gray-600">See exactly what data we collect and why.</p>
            </CardContent>
          </Card>
        </div>

        {/* Privacy Policy Content */}
        <Card className="mb-8">
          <CardContent className="prose max-w-none p-8">
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="mb-4">
              Welcome to LifeOS. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, store, and protect your information when you use our service.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, password (encrypted)</li>
              <li><strong>Profile Data:</strong> Optional profile picture, preferences, timezone</li>
              <li><strong>Content:</strong> Documents, notes, tasks, and other information you upload</li>
              <li><strong>Communication:</strong> Messages you send through our platform</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Usage Data:</strong> Pages viewed, features used, time spent</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Log Data:</strong> Error logs, API requests (anonymized)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Connected Services (With Your Permission)</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Gmail:</strong> Email metadata (subject, sender, date) - NOT content unless you explicitly enable</li>
              <li><strong>Google Calendar:</strong> Event titles, times, attendees (read-only by default)</li>
              <li><strong>Google Drive:</strong> File names, types, modification dates</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Service Delivery:</strong> To provide, maintain, and improve LifeOS features</li>
              <li><strong>AI Processing:</strong> To generate embeddings, summaries, and intelligent suggestions</li>
              <li><strong>Personalization:</strong> To tailor the experience to your preferences</li>
              <li><strong>Communication:</strong> To send important updates, security alerts (you can opt-out of marketing)</li>
              <li><strong>Security:</strong> To detect fraud, abuse, and protect your account</li>
              <li><strong>Legal Compliance:</strong> To comply with legal obligations</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">4. Data Storage & Security</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Where We Store Data</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Primary Database:</strong> PostgreSQL (encrypted at rest)</li>
              <li><strong>Vector Embeddings:</strong> Pinecone (secured with API authentication)</li>
              <li><strong>Knowledge Graph:</strong> Neo4j (access-controlled)</li>
              <li><strong>Vault Data:</strong> Client-side encrypted, we cannot decrypt</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Security Measures</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>TLS/SSL encryption for all data in transit</li>
              <li>AES-256 encryption for sensitive data at rest</li>
              <li>Regular security audits and penetration testing</li>
              <li>Multi-factor authentication (MFA) available</li>
              <li>Role-based access control (RBAC)</li>
              <li>Automated threat detection and monitoring</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">5. Data Retention</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Active Accounts:</strong> We retain your data as long as your account is active</li>
              <li><strong>Deleted Accounts:</strong> Data deleted within 30 days (backup copies within 90 days)</li>
              <li><strong>Legal Requirements:</strong> Some data may be retained longer for legal compliance</li>
              <li><strong>Anonymized Analytics:</strong> May be retained indefinitely (cannot identify you)</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">6. Third-Party Services</h2>
            <p className="mb-4">We use the following third-party services:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>OpenAI:</strong> For AI processing (embeddings, completions) - see their privacy policy</li>
              <li><strong>Stripe:</strong> For payment processing - we don't store credit card details</li>
              <li><strong>Pinecone:</strong> For vector database storage - secured with API keys</li>
              <li><strong>Google APIs:</strong> Only with your explicit permission for integrations</li>
            </ul>
            <p className="mb-4"><strong>Important:</strong> We never sell your data to third parties. Period.</p>

            <h2 className="text-2xl font-bold mb-4 mt-8">7. Your Rights (GDPR & CCPA)</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Delete your data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Export your data in machine-readable format</li>
              <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
              <li><strong>Object:</strong> Object to certain types of processing</li>
              <li><strong>Withdraw Consent:</strong> For optional features anytime</li>
            </ul>

            <p className="mb-4">
              To exercise these rights, visit your{' '}
              <Link href="/settings" className="text-blue-600 hover:underline">Settings page</Link>{' '}
              or contact us at{' '}
              <a href="mailto:privacy@lifeos.app" className="text-blue-600 hover:underline">privacy@lifeos.app</a>
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">8. Cookies & Tracking</h2>
            <p className="mb-4">We use minimal cookies:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Essential:</strong> Authentication, security (required for service)</li>
              <li><strong>Functional:</strong> Preferences, language settings</li>
              <li><strong>Analytics:</strong> Usage patterns (anonymized, you can opt-out)</li>
            </ul>
            <p className="mb-4">
              See our <Link href="/legal/cookies" className="text-blue-600 hover:underline">Cookie Policy</Link> for details.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">9. Children's Privacy</h2>
            <p className="mb-4">
              LifeOS is not intended for users under 16. We do not knowingly collect information from children. 
              If you believe we have collected such information, please contact us immediately.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">10. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this policy occasionally. We'll notify you of significant changes via email or in-app notice. 
              Continued use after changes constitutes acceptance.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">11. Contact Us</h2>
            <p className="mb-4">For privacy questions or concerns:</p>
            <ul className="list-none mb-4 space-y-2">
              <li><Mail className="inline w-4 h-4 mr-2" />Email: <a href="mailto:privacy@lifeos.app" className="text-blue-600 hover:underline">privacy@lifeos.app</a></li>
              <li><Mail className="inline w-4 h-4 mr-2" />DPO: <a href="mailto:dpo@lifeos.app" className="text-blue-600 hover:underline">dpo@lifeos.app</a></li>
            </ul>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="border-2 border-blue-200">
            <CardContent className="pt-6">
              <Download className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">Export Your Data</h3>
              <p className="text-sm text-gray-600 mb-4">Download all your data in JSON format</p>
              <Link href="/settings?tab=data-export" className="text-blue-600 hover:underline text-sm font-medium">
                Go to Export →
              </Link>
            </CardContent>
          </Card>
          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <Trash2 className="w-8 h-8 text-red-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">Delete Your Account</h3>
              <p className="text-sm text-gray-600 mb-4">Permanently remove all your data</p>
              <Link href="/settings?tab=delete-account" className="text-red-600 hover:underline text-sm font-medium">
                Go to Delete →
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-sm">© 2025 LifeOS. All rights reserved.</p>
            <div className="flex space-x-6 text-sm">
              <Link href="/legal/terms" className="hover:text-white">Terms of Service</Link>
              <Link href="/legal/cookies" className="hover:text-white">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
