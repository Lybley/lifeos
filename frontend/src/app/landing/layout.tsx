import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LifeOS - Your AI-Powered Second Brain | Personal Memory & Productivity System',
  description: 'Transform your scattered information into an intelligent system. AI agents that remember, organize, and act on your behalf. Never forget important details again.',
  keywords: ['AI personal assistant', 'second brain', 'memory system', 'productivity tool', 'AI agents', 'task automation'],
  openGraph: {
    title: 'LifeOS - Your AI-Powered Second Brain',
    description: 'Remember everything. Automate anything. Your personal operating system for life.',
    type: 'website',
    url: 'https://lifeos.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LifeOS - Your AI-Powered Second Brain',
    description: 'Remember everything. Automate anything. Your personal operating system for life.',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
