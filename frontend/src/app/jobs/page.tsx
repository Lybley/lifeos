'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jobsApi } from '@/lib/api';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export default function JobsPage() {
  const { user, isLoading } = useUser();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      fetchStats();
    }
  }, [user, isLoading]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await jobsApi.getStats();
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch job stats');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Please login to view jobs</p>
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
          <h1 style={{ fontSize: '2rem' }}>Background Jobs</h1>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
            Back to Home
          </Link>
        </div>

        {loading && <p>Loading stats...</p>}
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}

        {!loading && !error && stats && (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>{stats.waiting}</div>
              <div style={{ marginTop: '0.5rem', color: '#666' }}>Waiting</div>
            </div>
            <div style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.active}</div>
              <div style={{ marginTop: '0.5rem', color: '#666' }}>Active</div>
            </div>
            <div style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{stats.completed}</div>
              <div style={{ marginTop: '0.5rem', color: '#666' }}>Completed</div>
            </div>
            <div style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>{stats.failed}</div>
              <div style={{ marginTop: '0.5rem', color: '#666' }}>Failed</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
