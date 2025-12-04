/**
 * LifeOS Landing Page
 * High-converting marketing page with A/B test variants
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Brain, 
  Zap, 
  Lock, 
  Calendar,
  MessageSquare,
  Shield,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';

// A/B Test Variants
const HERO_VARIANTS = {
  variant_a: {
    headline: "Your AI-Powered Second Brain",
    subheadline: "Remember everything. Automate anything. Never lose track of what matters.",
  },
  variant_b: {
    headline: "Stop Forgetting. Start Achieving.",
    subheadline: "LifeOS turns your scattered notes, emails, and tasks into an intelligent system that works for you 24/7.",
  },
  variant_c: {
    headline: "The Last Productivity Tool You'll Ever Need",
    subheadline: "AI agents that remember, organize, and act on your behalf. Your personal operating system for life.",
  },
};

export default function LandingPage() {
  const router = useRouter();
  const [variant, setVariant] = useState<keyof typeof HERO_VARIANTS>('variant_a');
  const [email, setEmail] = useState('');
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  // A/B test variant selection
  useEffect(() => {
    const variants = Object.keys(HERO_VARIANTS) as Array<keyof typeof HERO_VARIANTS>;
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];
    setVariant(randomVariant);
  }, []);

  const heroContent = HERO_VARIANTS[variant];

  const handleEmailCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with Mailchimp/HubSpot
    console.log('Email captured:', email);
    setShowEmailCapture(false);
    // Redirect to signup
    router.push('/signup?email=' + encodeURIComponent(email));
  };

  return (
    <>
      <Head>
        <title>LifeOS - Your AI-Powered Second Brain | Personal Memory & Productivity System</title>
        <meta name="description" content="Transform your scattered information into an intelligent system. AI agents that remember, organize, and act on your behalf. Never forget important details again." />
        <meta name="keywords" content="AI personal assistant, second brain, memory system, productivity tool, AI agents, task automation" />
        <meta property="og:title" content="LifeOS - Your AI-Powered Second Brain" />
        <meta property="og:description" content="Remember everything. Automate anything. Your personal operating system for life." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://lifeos.app" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-md fixed w-full z-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  LifeOS
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
                <a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
                <Button onClick={() => router.push('/signup')} variant="primary">
                  Get Started Free
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="info" className="mb-4">🚀 Powered by GPT-5 & Advanced AI</Badge>
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  {heroContent.headline}
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  {heroContent.subheadline}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={() => router.push('/signup')} 
                    size="lg"
                    className="text-lg px-8 py-4"
                  >
                    Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button 
                    onClick={() => setShowEmailCapture(true)} 
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 py-4"
                  >
                    Watch Demo
                  </Button>
                </div>
                <div className="mt-8 flex items-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    No credit card required
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    Free forever plan
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-8 shadow-2xl">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <Brain className="w-8 h-8 text-blue-600" />
                      <div>
                        <div className="font-semibold">AI Agent Active</div>
                        <div className="text-sm text-gray-500">Processing your life...</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm">✓ 247 memories organized</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm">⚡ 12 tasks auto-scheduled</span>
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm">🔒 End-to-end encrypted</span>
                        <Shield className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600">10K+</div>
                <div className="text-gray-600 mt-2">Active Users</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600">1M+</div>
                <div className="text-gray-600 mt-2">Memories Stored</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600">99.9%</div>
                <div className="text-gray-600 mt-2">Uptime SLA</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600">4.9/5</div>
                <div className="text-gray-600 mt-2">User Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                The Problem We All Face
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                In today's information overload, important details slip through the cracks
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8 text-center hover:shadow-xl transition-shadow">
                <div className="text-6xl mb-4">😓</div>
                <h3 className="text-xl font-bold mb-3">Information Overload</h3>
                <p className="text-gray-600">
                  Emails, meetings, notes, and messages scattered across dozens of apps. Nothing connects.
                </p>
              </Card>
              <Card className="p-8 text-center hover:shadow-xl transition-shadow">
                <div className="text-6xl mb-4">🤯</div>
                <h3 className="text-xl font-bold mb-3">Forgotten Context</h3>
                <p className="text-gray-600">
                  "When did we last discuss this?" "What was that idea I had?" Important details vanish.
                </p>
              </Card>
              <Card className="p-8 text-center hover:shadow-xl transition-shadow">
                <div className="text-6xl mb-4">⏰</div>
                <h3 className="text-xl font-bold mb-3">Manual Everything</h3>
                <p className="text-gray-600">
                  Copying data, setting reminders, updating tasks. Hours wasted on busywork every week.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">
                Meet Your AI-Powered Personal OS
              </h2>
              <p className="text-xl opacity-90 max-w-3xl mx-auto">
                LifeOS connects everything, remembers everything, and acts on your behalf
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Unified Memory Graph</h3>
                      <p className="opacity-90">
                        All your information - emails, notes, meetings, tasks - connected in one intelligent knowledge graph.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">AI Agents That Act</h3>
                      <p className="opacity-90">
                        Intelligent agents draft emails, schedule meetings, summarize documents, and complete tasks automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Privacy-First Design</h3>
                      <p className="opacity-90">
                        End-to-end encryption. Your data never leaves your control. We can't read it, nobody can.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🚀</div>
                  <h3 className="text-2xl font-bold">10x Your Productivity</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Time saved per week</span>
                    <span className="text-2xl font-bold">8 hours</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Information retained</span>
                    <span className="text-2xl font-bold">100%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Automated actions</span>
                    <span className="text-2xl font-bold">Unlimited</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="features" className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                How LifeOS Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Seven simple steps to transform your digital life
              </p>
            </div>
            <div className="space-y-8">
              {[
                { step: 1, title: "Connect Your Data Sources", desc: "Link Gmail, Calendar, Slack, notes apps, and more in seconds.", icon: "🔗" },
                { step: 2, title: "AI Analyzes & Organizes", desc: "Our AI automatically extracts entities, relationships, and context from everything.", icon: "🧠" },
                { step: 3, title: "Build Your Memory Graph", desc: "Watch as your personal knowledge graph grows, connecting people, projects, and ideas.", icon: "🕸️" },
                { step: 4, title: "Deploy AI Agents", desc: "Configure intelligent agents for different tasks - email management, scheduling, research.", icon: "🤖" },
                { step: 5, title: "Agents Act Automatically", desc: "They draft responses, schedule meetings, summarize documents, and remind you of important details.", icon: "⚡" },
                { step: 6, title: "Review & Approve", desc: "Stay in control - review agent actions before they execute (or let them run on autopilot).", icon: "✅" },
                { step: 7, title: "Never Forget Again", desc: "Ask anything. \"What did John say about the project?\" Get instant, contextual answers.", icon: "💡" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start space-x-6 p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                  <div className="text-5xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant="info">Step {item.step}</Badge>
                      <h3 className="text-2xl font-bold text-gray-900">{item.title}</h3>
                    </div>
                    <p className="text-gray-600 text-lg">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Powerful Features
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Everything you need to master your digital life
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Brain, title: "AI Agents", desc: "Deploy specialized agents for email, scheduling, research, and more" },
                { icon: MessageSquare, title: "Memory Graph", desc: "Your personal knowledge graph that connects everything" },
                { icon: Calendar, title: "Smart Planner", desc: "AI-powered calendar that understands your priorities" },
                { icon: Lock, title: "Vault Security", desc: "Client-side encryption for your most sensitive data" },
                { icon: Zap, title: "Auto-Actions", desc: "Automate repetitive tasks with intelligent workflows" },
                { icon: Users, title: "Team Collaboration", desc: "Share memory spaces and collaborate with your team" },
                { icon: TrendingUp, title: "Analytics", desc: "Insights into your productivity and time usage" },
                { icon: Shield, title: "Privacy First", desc: "Your data stays yours. We can't access it, ever." },
              ].map((feature, idx) => (
                <Card key={idx} className="p-6 text-center hover:shadow-xl transition-shadow">
                  <feature.icon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Start free, scale as you grow
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { 
                  name: "Free", 
                  price: "$0", 
                  period: "forever",
                  features: ["1,000 memories", "1 AI agent", "10K tokens/month", "Basic features"],
                  cta: "Start Free",
                  popular: false
                },
                { 
                  name: "Pro", 
                  price: "$29", 
                  period: "/month",
                  features: ["50K memories", "5 AI agents", "500K tokens/month", "Auto-actions", "Priority support"],
                  cta: "Start Trial",
                  popular: true
                },
                { 
                  name: "Team", 
                  price: "$99", 
                  period: "/month",
                  features: ["200K memories", "20 AI agents", "2M tokens/month", "10 team seats", "Team analytics"],
                  cta: "Start Trial",
                  popular: false
                },
                { 
                  name: "Enterprise", 
                  price: "$499", 
                  period: "/month",
                  features: ["Unlimited memories", "Unlimited agents", "10M+ tokens/month", "100 team seats", "SSO & custom integrations"],
                  cta: "Contact Sales",
                  popular: false
                },
              ].map((plan, idx) => (
                <Card key={idx} className={`p-8 ${plan.popular ? 'border-4 border-blue-600 shadow-2xl' : ''} relative`}>
                  {plan.popular && (
                    <Badge variant="info" className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-4xl font-bold text-blue-600 mb-1">{plan.price}</div>
                    <div className="text-gray-500">{plan.period}</div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => router.push('/signup')} 
                    variant={plan.popular ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Loved by Productive People
              </h2>
              <p className="text-xl text-gray-600">
                Don't just take our word for it
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Sarah Chen",
                  role: "Product Manager",
                  image: "👩‍💼",
                  quote: "LifeOS is like having a photographic memory. I never lose track of important conversations or details anymore.",
                  rating: 5
                },
                {
                  name: "Marcus Rodriguez",
                  role: "Startup Founder",
                  image: "👨‍💻",
                  quote: "The AI agents save me 10+ hours every week. It's like having a personal assistant for $29/month.",
                  rating: 5
                },
                {
                  name: "Emily Taylor",
                  role: "Executive Coach",
                  image: "👩‍🏫",
                  quote: "Finally, a tool that actually delivers on the 'second brain' promise. The memory graph is mind-blowing.",
                  rating: 5
                },
              ].map((testimonial, idx) => (
                <Card key={idx} className="p-8">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-5xl">{testimonial.image}</div>
                    <div>
                      <div className="font-bold">{testimonial.name}</div>
                      <div className="text-sm text-gray-500">{testimonial.role}</div>
                    </div>
                  </div>
                  <div className="flex space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 italic">"{testimonial.quote}"</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-6">
              {[
                {
                  q: "How does LifeOS keep my data private?",
                  a: "We use end-to-end encryption. Your sensitive data is encrypted in your browser before it ever reaches our servers. We physically cannot access your encrypted data - only you hold the keys."
                },
                {
                  q: "What AI models power LifeOS?",
                  a: "We use GPT-5 for language understanding, custom-trained models for entity extraction, and vector embeddings for semantic search. All powered by our intelligent memory graph architecture."
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Absolutely. No contracts, no commitments. Cancel anytime with one click. Your data remains accessible for 30 days after cancellation."
                },
                {
                  q: "Do you integrate with my existing tools?",
                  a: "Yes! We integrate with Gmail, Google Calendar, Slack, Notion, Obsidian, and many more. More integrations added every week."
                },
                {
                  q: "What happens if I exceed my usage limits?",
                  a: "We'll notify you as you approach limits. On Pro and above, overage is billed at low per-unit rates. The Free plan simply pauses non-essential features until next month."
                },
                {
                  q: "Is there a free trial?",
                  a: "The Free plan is free forever - no trial needed! Pro, Team, and Enterprise plans include a 14-day free trial. No credit card required."
                },
              ].map((faq, idx) => (
                <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
                  <h3 className="text-xl font-bold mb-3">{faq.q}</h3>
                  <p className="text-gray-600">{faq.a}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to 10x Your Productivity?
            </h2>
            <p className="text-xl opacity-90 mb-8">
              Join thousands of productive people who never forget important details
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => router.push('/signup')} 
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4"
              >
                Start Free Trial
              </Button>
              <Button 
                onClick={() => setShowEmailCapture(true)} 
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-4"
              >
                Schedule Demo
              </Button>
            </div>
            <p className="mt-6 text-sm opacity-75">
              No credit card required • Free forever plan available • Cancel anytime
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <Brain className="w-6 h-6 text-blue-400" />
                  <span className="text-white font-bold text-xl">LifeOS</span>
                </div>
                <p className="text-sm">
                  Your AI-powered personal operating system.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#features" className="hover:text-white">Features</a></li>
                  <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                  <li><a href="/admin" className="hover:text-white">Admin</a></li>
                  <li><a href="/vault" className="hover:text-white">Vault</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-white">About</a></li>
                  <li><a href="#" className="hover:text-white">Blog</a></li>
                  <li><a href="#" className="hover:text-white">Careers</a></li>
                  <li><a href="#" className="hover:text-white">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-white">Privacy</a></li>
                  <li><a href="#" className="hover:text-white">Terms</a></li>
                  <li><a href="#" className="hover:text-white">Security</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 text-center text-sm">
              <p>&copy; 2025 LifeOS. All rights reserved.</p>
            </div>
          </div>
        </footer>

        {/* Email Capture Modal */}
        {showEmailCapture && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-8 relative">
              <button
                onClick={() => setShowEmailCapture(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
              <h3 className="text-2xl font-bold mb-4">Get Early Access</h3>
              <p className="text-gray-600 mb-6">
                Join our waitlist and be the first to experience LifeOS
              </p>
              <form onSubmit={handleEmailCapture} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <Button type="submit" className="w-full" size="lg">
                  Join Waitlist
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "LifeOS",
            "applicationCategory": "ProductivityApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "10000"
            },
            "description": "AI-powered personal memory and productivity system"
          })
        }}
      />
    </>
  );
}
