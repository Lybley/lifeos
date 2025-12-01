import { UserProvider } from '@auth0/nextjs-auth0/client';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LifeOS Core',
  description: 'Graph-based knowledge management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
