'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>LifeOS Core</h1>
          <p style={{ fontSize: '1.25rem', color: '#666' }}>
            Graph-based knowledge management with AI-powered search
          </p>
        </header>

        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          {user ? (
            <div>
              <p style={{ marginBottom: '1rem' }}>Welcome, {user.name}!</p>
              <Link
                href="/api/auth/logout"
                style={{
                  padding: '0.75rem 2rem',
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: '0.5rem',
                  display: 'inline-block',
                }}
              >
                Logout
              </Link>
            </div>
          ) : (
            <Link
              href="/api/auth/login"
              style={{
                padding: '0.75rem 2rem',
                background: '#2563eb',
                color: 'white',
                borderRadius: '0.5rem',
                display: 'inline-block',
              }}
            >
              Login with Auth0
            </Link>
          )}
        </div>

        {user && (
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div style={{ padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Graph Nodes</h2>
              <p style={{ color: '#666', marginBottom: '1rem' }}>Manage your knowledge graph with Neo4j</p>
              <Link
                href="/nodes"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '0.375rem',
                  display: 'inline-block',
                }}
              >
                View Nodes
              </Link>
            </div>

            <div style={{ padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Vector Search</h2>
              <p style={{ color: '#666', marginBottom: '1rem' }}>Semantic search powered by Pinecone</p>
              <Link
                href="/vectors"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#8b5cf6',
                  color: 'white',
                  borderRadius: '0.375rem',
                  display: 'inline-block',
                }}
              >
                Search Vectors
              </Link>
            </div>

            <div style={{ padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Background Jobs</h2>
              <p style={{ color: '#666', marginBottom: '1rem' }}>Monitor queue with BullMQ</p>
              <Link
                href="/jobs"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f59e0b',
                  color: 'white',
                  borderRadius: '0.375rem',
                  display: 'inline-block',
                }}
              >
                View Jobs
              </Link>
            </div>
          </div>
        )}

        <footer style={{ marginTop: '4rem', textAlign: 'center', color: '#666' }}>
          <p>Powered by Node.js, Express, Next.js, PostgreSQL, Neo4j, Pinecone, and BullMQ</p>
        </footer>
      </div>
    </main>
  );
}
