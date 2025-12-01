'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useState } from 'react';
import Link from 'next/link';

export default function VectorsPage() {
  const { user, isLoading } = useUser();
  const [message, setMessage] = useState<string>('Vector search functionality coming soon...');

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Please login to use vector search</p>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          Go back
        </Link>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem' }}>Vector Search</h1>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
            Back to Home
          </Link>
        </div>

        <div style={{ padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', color: '#666' }}>{message}</p>
          <p style={{ marginTop: '1rem', color: '#999' }}>Requires Pinecone API key configuration</p>
        </div>
      </div>
    </main>
  );
}
