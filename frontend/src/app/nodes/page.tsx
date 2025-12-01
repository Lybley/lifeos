'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { nodesApi, setAuthToken } from '@/lib/api';

interface Node {
  id: string;
  labels: string[];
  properties: any;
}

export default function NodesPage() {
  const { user, isLoading } = useUser();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      fetchNodes();
    }
  }, [user, isLoading]);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await nodesApi.getAll();
      setNodes(response.data.nodes);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch nodes');
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
        <p>Please login to view nodes</p>
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
          <h1 style={{ fontSize: '2rem' }}>Graph Nodes</h1>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
            Back to Home
          </Link>
        </div>

        {loading && <p>Loading nodes...</p>}
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}

        {!loading && !error && (
          <div>
            <p style={{ marginBottom: '1rem', color: '#666' }}>Total nodes: {nodes.length}</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {nodes.map((node) => (
                <div
                  key={node.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>ID:</strong> {node.id}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Labels:</strong> {node.labels.join(', ')}
                  </div>
                  <div>
                    <strong>Properties:</strong>
                    <pre style={{ marginTop: '0.5rem', background: '#f3f4f6', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>
                      {JSON.stringify(node.properties, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
