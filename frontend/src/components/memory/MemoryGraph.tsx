'use client';

import React, { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface GraphNode {
  id: string;
  label: string;
  type: 'person' | 'document' | 'event' | 'task' | 'email' | 'note';
  properties?: Record<string, any>;
  size?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  strength?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface MemoryGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  height?: number;
}

export const MemoryGraph: React.FC<MemoryGraphProps> = ({
  data,
  onNodeClick,
  onNodeHover,
  height = 600,
}) => {
  const graphRef = useRef<any>();
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const nodeColors: Record<string, string> = {
    person: '#3b82f6',
    document: '#10b981',
    event: '#f59e0b',
    task: '#8b5cf6',
    email: '#ef4444',
    note: '#6366f1',
  };

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleNodeHover = (node: any) => {
    if (node) {
      const neighbors = new Set();
      const links = new Set();
      
      data.links.forEach(link => {
        if (link.source === node.id) {
          neighbors.add(link.target);
          links.add(link);
        } else if (link.target === node.id) {
          neighbors.add(link.source);
          links.add(link);
        }
      });

      setHighlightNodes(neighbors);
      setHighlightLinks(links);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }

    if (onNodeHover) {
      onNodeHover(node);
    }
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.3, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.3, 400);
    }
  };

  const handleCenter = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  const filteredData = filterType
    ? {
        nodes: data.nodes.filter(n => n.type === filterType),
        links: data.links.filter(l => {
          const sourceNode = data.nodes.find(n => n.id === l.source);
          const targetNode = data.nodes.find(n => n.id === l.target);
          return sourceNode?.type === filterType || targetNode?.type === filterType;
        }),
      }
    : data;

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Card padding="sm" className="flex flex-col gap-2">
          <Button size="sm" variant="ghost" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCenter}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </Card>
      </div>

      {/* Type Filter */}
      <div className="absolute top-4 left-4 z-10">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter by type</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterType(null)}
              className={`px-2 py-1 text-xs rounded ${
                !filterType ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {Object.entries(nodeColors).map(([type, color]) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 text-xs rounded capitalize ${
                  filterType === type ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{
                  borderLeft: `3px solid ${color}`,
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Graph */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        {typeof window !== 'undefined' && (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            nodeLabel="label"
            nodeAutoColorBy="type"
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.label;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

            // Node circle
            ctx.fillStyle = nodeColors[node.type] || '#94a3b8';
            ctx.beginPath();
            ctx.arc(node.x, node.y, (node.size || 5), 0, 2 * Math.PI, false);
            ctx.fill();

            // Highlight if hovered
            if (highlightNodes.has(node.id) || selectedNode?.id === node.id) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }

            // Label
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 + (node.size || 5) + 2,
              bckgDimensions[0],
              bckgDimensions[1]
            );

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, node.x, node.y + (node.size || 5) + 2 + fontSize / 2);
          }}
          linkWidth={(link: any) => (highlightLinks.has(link) ? 3 : 1)}
          linkColor={(link: any) => (highlightLinks.has(link) ? '#fbbf24' : '#94a3b8')}
          linkDirectionalParticles={(link: any) => (highlightLinks.has(link) ? 4 : 0)}
          linkDirectionalParticleWidth={2}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
            width={typeof window !== 'undefined' ? window.innerWidth - 100 : 800}
            height={height}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400)}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-4">
        <Card padding="sm">
          <div className="flex flex-wrap gap-4">
            {Object.entries(nodeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm capitalize">{type}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
