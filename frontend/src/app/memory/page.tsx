'use client';

import React, { useState, useEffect } from 'react';
import { MemoryGraph, GraphData, GraphNode } from '@/components/memory/MemoryGraph';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import apiClient from '@/lib/api-client';
import { X } from 'lucide-react';

export default function MemoryPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = async () => {
    try {
      const nodes = await apiClient.getNodes();
      
      // Transform backend nodes to graph format
      const graphNodes: GraphNode[] = nodes.map((node: any) => ({
        id: node.id,
        label: node.properties?.name || node.label || 'Untitled',
        type: node.labels?.[0]?.toLowerCase() || 'note',
        properties: node.properties,
        size: 5,
      }));

      // For now, create mock links (would come from backend relationships)
      const graphLinks = [];
      for (let i = 0; i < graphNodes.length - 1; i++) {
        if (Math.random() > 0.5) {
          graphLinks.push({
            source: graphNodes[i].id,
            target: graphNodes[i + 1].id,
            strength: Math.random(),
          });
        }
      }

      setGraphData({ nodes: graphNodes, links: graphLinks });
    } catch (error) {
      console.error('Failed to load graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-6 gap-6">
      <div>
        <h1 className="text-3xl font-bold">Memory Graph</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Visualize and explore your Personal Memory Graph
        </p>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Graph */}
        <div className="flex-1">
          <MemoryGraph
            data={graphData}
            onNodeClick={handleNodeClick}
            height={600}
          />
        </div>

        {/* Node Details Sidebar */}
        {selectedNode && (
          <Card className="w-80 flex-shrink-0">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Node Details</CardTitle>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <Badge className="mt-1 capitalize">{selectedNode.type}</Badge>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Label</label>
                  <p className="mt-1 font-medium">{selectedNode.label}</p>
                </div>

                {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Properties</label>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.properties).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-500">{key}:</span>{' '}
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Nodes</p>
          <p className="text-2xl font-bold">{graphData.nodes.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Links</p>
          <p className="text-2xl font-bold">{graphData.links.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Node Types</p>
          <p className="text-2xl font-bold">{new Set(graphData.nodes.map(n => n.type)).size}</p>
        </Card>
      </div>
    </div>
  );
}
