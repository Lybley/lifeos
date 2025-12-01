/**
 * Graph Context Retrieval Service
 * Fetches related context from Neo4j knowledge graph
 */

import { neo4jDriver } from '../../config/neo4j';
import logger from '../../utils/logger';

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  type: string;
  from: GraphNode;
  to: GraphNode;
  properties?: Record<string, any>;
}

export interface GraphContextResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  contextSummary: string;
}

/**
 * Get graph context for a list of chunk/document IDs
 * Retrieves relationships up to 2 hops away
 */
export async function getGraphContext(
  chunkIds: string[],
  userId: string,
  maxHops: number = 2
): Promise<GraphContextResult> {
  const session = neo4jDriver.session();

  try {
    // Query to get context around chunks
    // Retrieves: Chunk -> Document -> Related entities (Person, Event, etc.)
    const query = `
      // Find chunks and their relationships
      MATCH (c:Chunk)
      WHERE c.id IN $chunkIds
      
      // Get parent documents
      OPTIONAL MATCH (c)-[:BELONGS_TO]->(d:Document)
      
      // Get 2-hop relationships from chunks
      OPTIONAL MATCH path = (c)-[r*1..${maxHops}]-(related)
      WHERE NOT related:Chunk // Exclude other chunks
        AND (related:Person OR related:Event OR related:Task OR related:Message)
      
      // Collect all nodes and relationships
      WITH c, d, related, relationships(path) as rels
      
      RETURN 
        c as chunk,
        d as document,
        collect(DISTINCT related) as relatedNodes,
        collect(DISTINCT rels) as relationships
      LIMIT 50
    `;

    const result = await session.run(query, { chunkIds });

    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];
    const seenNodeIds = new Set<string>();

    // Process results
    for (const record of result.records) {
      // Add chunk node
      const chunk = record.get('chunk');
      if (chunk && !seenNodeIds.has(chunk.properties.id)) {
        nodes.push({
          id: chunk.properties.id,
          labels: chunk.labels,
          properties: chunk.properties,
        });
        seenNodeIds.add(chunk.properties.id);
      }

      // Add document node
      const document = record.get('document');
      if (document && !seenNodeIds.has(document.properties.id)) {
        nodes.push({
          id: document.properties.id,
          labels: document.labels,
          properties: document.properties,
        });
        seenNodeIds.add(document.properties.id);
      }

      // Add related nodes
      const relatedNodes = record.get('relatedNodes') || [];
      for (const node of relatedNodes) {
        if (node && !seenNodeIds.has(node.properties.id)) {
          nodes.push({
            id: node.properties.id,
            labels: node.labels,
            properties: node.properties,
          });
          seenNodeIds.add(node.properties.id);
        }
      }

      // Process relationships (simplified for now)
      const rels = record.get('relationships') || [];
      for (const relArray of rels) {
        if (Array.isArray(relArray)) {
          // Handle relationship arrays from path
          for (const rel of relArray) {
            if (rel && rel.start && rel.end) {
              // Note: Full relationship processing would require more context
              // This is a simplified version
            }
          }
        }
      }
    }

    // Build context summary
    const contextSummary = buildContextSummary(nodes);

    logger.info(`Retrieved graph context: ${nodes.length} nodes, ${relationships.length} relationships`);

    return {
      nodes,
      relationships,
      contextSummary,
    };
  } catch (error) {
    logger.error('Failed to retrieve graph context:', error);
    // Don't fail the whole request if graph context fails
    return {
      nodes: [],
      relationships: [],
      contextSummary: '',
    };
  } finally {
    await session.close();
  }
}

/**
 * Build a human-readable summary of graph context
 */
function buildContextSummary(nodes: GraphNode[]): string {
  if (nodes.length === 0) {
    return '';
  }

  const summary: string[] = [];

  // Group nodes by type
  const nodesByType = nodes.reduce((acc, node) => {
    const primaryLabel = node.labels[0] || 'Unknown';
    if (!acc[primaryLabel]) {
      acc[primaryLabel] = [];
    }
    acc[primaryLabel].push(node);
    return acc;
  }, {} as Record<string, GraphNode[]>);

  // Build summary for each type
  for (const [type, typeNodes] of Object.entries(nodesByType)) {
    if (type === 'Chunk') continue; // Skip chunks in summary

    summary.push(`\n**Related ${type}s:**`);

    for (const node of typeNodes.slice(0, 5)) { // Limit to 5 per type
      const props = node.properties;
      
      switch (type) {
        case 'Document':
          summary.push(`- "${props.title || props.name || 'Untitled'}" (${props.source || 'unknown source'})`);
          break;
        
        case 'Person':
          summary.push(`- ${props.name || props.email || 'Unknown'} ${props.email ? `(${props.email})` : ''}`);
          break;
        
        case 'Event':
          const eventDate = props.start_time ? new Date(props.start_time).toLocaleDateString() : '';
          summary.push(`- "${props.title}" ${eventDate ? `on ${eventDate}` : ''}`);
          break;
        
        case 'Task':
          summary.push(`- ${props.title} (${props.status || 'status unknown'})`);
          break;
        
        case 'Message':
          summary.push(`- Message from ${props.sender || 'unknown'}`);
          break;
        
        default:
          summary.push(`- ${props.title || props.name || node.id}`);
      }
    }

    if (typeNodes.length > 5) {
      summary.push(`  ... and ${typeNodes.length - 5} more`);
    }
  }

  return summary.join('\n');
}

/**
 * Get document metadata for chunks
 */
export async function getDocumentMetadata(chunkIds: string[]): Promise<Map<string, any>> {
  const session = neo4jDriver.session();

  try {
    const query = `
      MATCH (c:Chunk)-[:BELONGS_TO]->(d:Document)
      WHERE c.id IN $chunkIds
      RETURN c.id as chunkId, d.id as docId, d.title as title, 
             d.source as source, d.created_at as createdAt
    `;

    const result = await session.run(query, { chunkIds });
    const metadataMap = new Map<string, any>();

    for (const record of result.records) {
      const chunkId = record.get('chunkId');
      metadataMap.set(chunkId, {
        documentId: record.get('docId'),
        title: record.get('title'),
        source: record.get('source'),
        createdAt: record.get('createdAt'),
      });
    }

    return metadataMap;
  } catch (error) {
    logger.error('Failed to get document metadata:', error);
    return new Map();
  } finally {
    await session.close();
  }
}
