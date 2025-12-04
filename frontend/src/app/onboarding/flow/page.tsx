/**
 * Progressive Onboarding Flow
 * Step-by-step user onboarding with interactive tour
 */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Mail,
  Upload,
  FileText,
  Shield,
  Eye,
  Lock,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Brain,
  Calendar,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Info,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

export default function OnboardingFlow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    gmailConnected: false,
    filesImported: false,
    tourCompleted: false,
  });

  const steps: OnboardingStep[] = [
    {
      id: 'signup',
      title: 'Welcome to LifeOS',
      subtitle: 'Your AI-powered personal operating system',
      component: <SignupStep userData={userData} setUserData={setUserData} />,
    },
    {
      id: 'connect-gmail',
      title: 'Connect Your Email',
      subtitle: 'Let LifeOS organize your communications',
      component: <ConnectGmailStep userData={userData} setUserData={setUserData} />,
    },
    {
      id: 'import-files',
      title: 'Import Your Files',
      subtitle: 'Bring your existing knowledge into LifeOS',
      component: <ImportFilesStep userData={userData} setUserData={setUserData} />,
    },
    {
      id: 'tour-1',
      title: 'Your Memory Graph',
      subtitle: 'See how LifeOS connects everything',
      component: <Tour1Step />,
    },
    {
      id: 'tour-2',
      title: 'AI Agents at Work',
      subtitle: 'Your intelligent assistants',
      component: <Tour2Step />,
    },
    {
      id: 'tour-3',
      title: 'Smart Planner',
      subtitle: 'Never miss what matters',
      component: <Tour3Step />,
    },
    {
      id: 'first-query',
      title: 'Try Your First Query',
      subtitle: 'Ask LifeOS anything',
      component: <FirstQueryStep />,
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      subtitle: 'Your data, your control',
      component: <PrivacyStep />,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('onboarding_date', new Date().toISOString());
      router.push('/?onboarding=complete');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (steps[currentStep].id === 'connect-gmail' || steps[currentStep].id === 'import-files') {
      handleNext();
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-gray-700">LifeOS Setup</span>
            </div>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {steps[currentStep].title}
            </h1>
            <p className="text-lg text-gray-600">{steps[currentStep].subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="mb-8">{steps[currentStep].component}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <Button
              onClick={handleBack}
              variant="ghost"
              disabled={currentStep === 0}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>

            <div className="flex items-center space-x-3">
              {(steps[currentStep].id === 'connect-gmail' ||
                steps[currentStep].id === 'import-files') && (
                <Button onClick={handleSkip} variant="outline">
                  Skip for now
                </Button>
              )}
              <Button
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Help Text */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Need help? <a href="#" className="text-blue-600 hover:underline">Contact support</a> or{' '}
          <a href="#" className="text-blue-600 hover:underline">watch tutorial video</a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function SignupStep({ userData, setUserData }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>What you'll build today:</strong> A personal memory system that remembers
          everything you tell it and helps you stay organized effortlessly.
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
          <input
            type="text"
            value={userData.name}
            onChange={(e) => setUserData({ ...userData, name: e.target.value })}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={userData.email}
            onChange={(e) => setUserData({ ...userData, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Brain className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm font-medium">AI Memory</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm font-medium">Encrypted</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium">Auto-Pilot</p>
        </div>
      </div>
    </div>
  );
}

function ConnectGmailStep({ userData, setUserData }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 text-center">
        <Mail className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Gmail (Optional)</h3>
        <p className="text-gray-600 mb-6">
          Let LifeOS organize your emails, extract action items, and remind you of important
          conversations.
        </p>
        <Button
          onClick={() => setUserData({ ...userData, gmailConnected: true })}
          size="lg"
          leftIcon={<Mail className="w-5 h-5" />}
        >
          {userData.gmailConnected ? 'Connected ✓' : 'Connect Gmail'}
        </Button>
      </div>

      {/* What We'll Access */}
      <Card className="p-4 bg-white border-2 border-blue-100">
        <div className="flex items-start space-x-3 mb-4">
          <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">What we'll access:</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                Email subject lines and senders
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                Meeting invitations and calendar events
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                Email body text (for context and summaries)
              </li>
            </ul>
          </div>
        </div>
        <div className="flex items-start space-x-3 pt-3 border-t border-gray-200">
          <Lock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">What we won't do:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>❌ Send emails on your behalf without approval</li>
              <li>❌ Share your data with third parties</li>
              <li>❌ Store emails on our servers (processed in memory only)</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-gray-500">
        You can disconnect anytime from Settings → Integrations
      </div>
    </div>
  );
}

function ImportFilesStep({ userData, setUserData }: any) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          setUserData({ ...userData, filesImported: true });
        }}
      >
        <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Drag & Drop Files</h3>
        <p className="text-gray-600 mb-4">
          Import your notes, documents, PDFs, or text files
        </p>
        <Button variant="outline" leftIcon={<FileText className="w-4 h-4" />}>
          Or Browse Files
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-2 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            Supported Formats
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• PDF, Word, Text files</li>
            <li>• Markdown, Notion exports</li>
            <li>• CSV, Excel spreadsheets</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h4 className="font-semibold mb-2 flex items-center">
            <Sparkles className="w-5 h-5 text-purple-500 mr-2" />
            What Happens Next
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• AI extracts key information</li>
            <li>• Creates connections automatically</li>
            <li>• Builds your knowledge graph</li>
          </ul>
        </Card>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-900">
          <strong>Privacy Note:</strong> Files are processed locally and encrypted before storage.
          We never train AI models on your personal data.
        </div>
      </div>
    </div>
  );
}

function Tour1Step() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg p-8 relative overflow-hidden">
        <div className="relative z-10">
          <Badge variant="info" className="mb-4">Feature Tour 1/3</Badge>
          <h3 className="text-2xl font-bold mb-4">Your Personal Memory Graph</h3>
          <p className="text-gray-700 mb-6">
            LifeOS connects all your information - emails, notes, tasks, and meetings - into an
            intelligent knowledge graph. Think of it as your digital brain.
          </p>
        </div>
        {/* Illustration placeholder */}
        <div className="mt-6 bg-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-2">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm font-medium">Emails</p>
            </div>
            <div className="text-4xl text-gray-300">→</div>
            <div className="text-center">
              <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mb-2">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <p className="text-sm font-medium">Memory Graph</p>
            </div>
            <div className="text-4xl text-gray-300">→</div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-2">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm font-medium">Insights</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm font-medium">Instant Search</p>
          <p className="text-xs text-gray-500 mt-1">Find anything in seconds</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl mb-2">🔗</div>
          <p className="text-sm font-medium">Auto-Linking</p>
          <p className="text-xs text-gray-500 mt-1">Connects related info</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl mb-2">⏰</div>
          <p className="text-sm font-medium">Timeline View</p>
          <p className="text-xs text-gray-500 mt-1">See your history</p>
        </Card>
      </div>
    </div>
  );
}

function Tour2Step() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg p-8">
        <Badge variant="secondary" className="mb-4">Feature Tour 2/3</Badge>
        <h3 className="text-2xl font-bold mb-4">AI Agents Working for You</h3>
        <p className="text-gray-700 mb-6">
          Deploy specialized AI agents that draft emails, schedule meetings, summarize documents,
          and complete tasks automatically while you focus on what matters.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            name: 'Email Assistant',
            desc: 'Drafts replies, triages inbox, flags important messages',
            icon: '📧',
            color: 'blue',
          },
          {
            name: 'Meeting Scheduler',
            desc: 'Finds optimal times, sends invites, prepares agendas',
            icon: '📅',
            color: 'green',
          },
          {
            name: 'Research Agent',
            desc: 'Gathers information, summarizes findings, creates reports',
            icon: '🔬',
            color: 'purple',
          },
        ].map((agent, idx) => (
          <Card key={idx} className="p-4">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{agent.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                <p className="text-sm text-gray-600">{agent.desc}</p>
              </div>
              <Badge variant="success">Ready</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900">
            <strong>You're always in control:</strong> Agents suggest actions, you approve before
            execution. Or enable autopilot for trusted tasks.
          </div>
        </div>
      </div>
    </div>
  );
}

function Tour3Step() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-8">
        <Badge variant="success" className="mb-4">Feature Tour 3/3</Badge>
        <h3 className="text-2xl font-bold mb-4">Smart Planner</h3>
        <p className="text-gray-700 mb-6">
          AI-powered calendar that understands your priorities, energy levels, and preferences.
          Never manually schedule again.
        </p>
      </div>

      <Card className="p-6 bg-white">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-sm">Team meeting prep</p>
                <p className="text-xs text-gray-500">Tomorrow, 9:00 AM - 30 min</p>
              </div>
            </div>
            <Badge variant="info">Auto-scheduled</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Brain className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-sm">Deep work: Project Alpha</p>
                <p className="text-xs text-gray-500">Tomorrow, 10:00 AM - 2 hours</p>
              </div>
            </div>
            <Badge variant="secondary">High priority</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Follow up: Client emails</p>
                <p className="text-xs text-gray-500">Tomorrow, 4:00 PM - 30 min</p>
              </div>
            </div>
            <Badge variant="success">Reminder set</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-2">⚡ Smart Features</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Respects energy levels</li>
            <li>• Avoids meeting fatigue</li>
            <li>• Protects focus time</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h4 className="font-semibold mb-2">🎯 Learns Your Habits</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Peak productivity times</li>
            <li>• Preferred meeting lengths</li>
            <li>• Break patterns</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function FirstQueryStep() {
  const [query, setQuery] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);

  const suggestions = [
    "What did Sarah say about the Q4 budget?",
    "Summarize my meetings from last week",
    "What are my top priorities this month?",
    "Show me all project-related emails",
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Ask LifeOS Anything</h3>
        <p className="text-gray-600">
          Your personal AI knows everything you've told it. Try asking a question!
        </p>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestion(e.target.value.length > 3);
          }}
          placeholder="Type your question here..."
          className="w-full px-6 py-4 pr-12 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        <Button
          className="absolute right-2 top-2"
          onClick={() => setShowSuggestion(true)}
        >
          Ask
        </Button>
      </div>

      {showSuggestion && query.length > 0 && (
        <Card className="p-4 bg-blue-50 border-2 border-blue-200">
          <div className="flex items-start space-x-3">
            <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">
                Great question! In a real session, I'd search through:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your email conversations</li>
                <li>• Meeting notes and transcripts</li>
                <li>• Imported documents</li>
                <li>• Calendar events and context</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Try these examples:</p>
        <div className="grid grid-cols-2 gap-3">
          {suggestions.map((suggestion, idx) => (
            <Card
              key={idx}
              className="p-3 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
              onClick={() => {
                setQuery(suggestion);
                setShowSuggestion(true);
              }}
            >
              <p className="text-sm text-gray-700">{suggestion}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrivacyStep() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-8 text-center">
        <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Your Privacy Matters</h3>
        <p className="text-gray-700">
          LifeOS is built with privacy at its core. Here's exactly what you need to know.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 border-2 border-green-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-bold text-green-900">What We Do</h4>
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <span>Encrypt all sensitive data end-to-end</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <span>Process data locally when possible</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <span>Give you full control of your data</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <span>Allow export and deletion anytime</span>
            </li>
          </ul>
        </Card>

        <Card className="p-6 border-2 border-red-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h4 className="font-bold text-red-900">What We Don't Do</h4>
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-2">❌</span>
              <span>Never sell your data to third parties</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">❌</span>
              <span>Never train AI models on your personal data</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">❌</span>
              <span>Never share data without explicit consent</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">❌</span>
              <span>Never access your encrypted vault data</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="p-6 bg-blue-50 border-2 border-blue-200">
        <div className="flex items-start space-x-3">
          <Lock className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-900 mb-2">Your Data Permissions</h4>
            <p className="text-sm text-blue-800 mb-3">
              You can manage what LifeOS can access at any time from Settings → Privacy.
            </p>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Email subject lines and metadata</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Calendar events and meeting details</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" />
                <span className="text-sm">Email body content (for AI summaries)</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-gray-600">
        Read our full <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a> and{' '}
        <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
      </div>
    </div>
  );
}
