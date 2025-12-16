import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import AuthProvider from '@/components/auth/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Zumffer LifeOS - AI-Powered Personal Operating System',
  description: 'Zumffer LifeOS: Your intelligent second brain that remembers everything, automates tasks, and connects your digital life. AI-powered memory graph, smart task management, and seamless integrations.',
  keywords: 'personal AI, second brain, memory graph, task automation, productivity tool, AI assistant, knowledge management, Zumffer',
  openGraph: {
    title: 'Zumffer LifeOS - Your AI-Powered Second Brain',
    description: 'Remember everything. Automate anything. Never lose track of what matters with Zumffer LifeOS.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zumffer LifeOS - AI-Powered Personal Operating System',
    description: 'Your intelligent second brain that remembers everything and automates your life.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
