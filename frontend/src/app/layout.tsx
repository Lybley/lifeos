import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LifeOS - Personal Memory Graph',
  description: 'Your AI-powered personal memory graph',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if we're on onboarding page (simplified - in production use proper routing check)
  const isOnboarding = typeof window !== 'undefined' && window.location.pathname === '/onboarding';

  if (isOnboarding) {
    return (
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
