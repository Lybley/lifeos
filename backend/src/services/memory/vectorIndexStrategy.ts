/**
 * Vector Indexing Strategy for Multi-Layer Memory
 * 
 * Defines separate Pinecone indexes for each memory type with
 * optimized metadata filtering and retrieval strategies
 */

import { MemoryType, MEMORY_TYPE_CONFIGS } from './memoryTypes';

// ============================================================================
// INDEX NAMING STRATEGY
// ============================================================================

export function getIndexName(userId: string, memoryType: MemoryType): string {
  const suffix = MEMORY_TYPE_CONFIGS[memoryType].vectorIndexSuffix;
  // Use hash of userId for privacy and consistent naming
  const userHash = hashUserId(userId);
  return `lifeos-${userHash}-${suffix}`;
}

function hashUserId(userId: string): string {
  // Simple hash for demo - use crypto hash in production
  return userId.slice(0, 8);
}

// ============================================================================
// INDEX SPECIFICATIONS
// ============================================================================

export interface VectorIndexSpec {
  name: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  pods: number;
  podType: string;
  metadataConfig: {
    indexed: string[]; // Fields to index for filtering
  };
  description: string;
}

/**
 * Get index specification for a memory type
 */
export function getIndexSpec(
  userId: string,
  memoryType: MemoryType
): VectorIndexSpec {
  const baseSpec = {
    dimension: 1536, // OpenAI text-embedding-3-small
    metric: 'cosine' as const,
    pods: 1,
    podType: 'p1.x1',
  };
  
  const indexName = getIndexName(userId, memoryType);
  
  switch (memoryType) {
    case MemoryType.WORKING:
      return {
        ...baseSpec,
        name: indexName,
        metadataConfig: {
          indexed: [
            'userId',
            'memoryType',
            'compositeScore',
            'recencyScore',
            'importanceScore',
            'context',
            'createdAt',
            'expiresAt',
          ],
        },
        description: 'Working memory - short-term, high-priority items',
      };
      
    case MemoryType.EPISODIC:
      return {
        ...baseSpec,
        name: indexName,
        metadataConfig: {
          indexed: [
            'userId',
            'memoryType',
            'compositeScore',
            'recencyScore',
            'emotionalScore',
            'context',
            'createdAt',
            'source',
          ],
        },
        description: 'Episodic memory - personal experiences and events',
      };
      
    case MemoryType.SEMANTIC:
      return {
        ...baseSpec,
        name: indexName,
        metadataConfig: {
          indexed: [
            'userId',
            'memoryType',
            'importanceScore',
            'frequencyScore',
            'context',
            'category',
          ],
        },
        description: 'Semantic memory - facts, knowledge, concepts',
      };
      
    case MemoryType.SOCIAL:
      return {
        ...baseSpec,
        name: indexName,
        metadataConfig: {
          indexed: [
            'userId',
            'memoryType',
            'socialScore',
            'compositeScore',
            'personId',
            'relationshipType',
            'context',
          ],
        },
        description: 'Social memory - people, relationships, interactions',
      };
      
    case MemoryType.EMOTIONAL:
      return {
        ...baseSpec,
        name: indexName,
        metadataConfig: {
          indexed: [
            'userId',
            'memoryType',
            'emotionalScore',
            'emotionType',
            'valence',
            'arousal',
            'recencyScore',
          ],
        },
        description: 'Emotional memory - feelings, emotional states',
      };
  }
}

// ============================================================================
// VECTOR METADATA STRUCTURE
// ============================================================================

export interface VectorMetadata {
  // Core identifiers
  memoryId: string;
  userId: string;
  memoryType: MemoryType;
  
  // Scores
  compositeScore: number;
  importanceScore: number;
  recencyScore: number;
  frequencyScore: number;
  emotionalScore: number;
  socialScore: number;
  
  // Temporal
  createdAt: number; // Unix timestamp
  lastAccessedAt: number;
  expiresAt?: number;
  
  // Context
  context: string; // Comma-separated tags
  source: string;
  
  // Type-specific metadata
  personId?: string; // For social memories
  relationshipType?: string; // For social memories
  emotionType?: string; // For emotional memories (joy, sadness, anger, etc.)
  valence?: number; // For emotional memories (-1 to 1)
  arousal?: number; // For emotional memories (0 to 1)
  category?: string; // For semantic memories
  
  // Neo4j reference
  neo4jId?: string;
  
  // Original content reference
  contentHash: string;
}

// ============================================================================
// RETRIEVAL FILTERS
// ============================================================================

export interface RetrievalFilter {
  memoryTypes?: MemoryType[];
  minCompositeScore?: number;
  minRecencyScore?: number;
  minImportanceScore?: number;
  context?: string[];
  source?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  personId?: string;
  emotionTypes?: string[];
}

/**
 * Convert retrieval filter to Pinecone metadata filter
 */
export function buildPineconeFilter(filter: RetrievalFilter): Record<string, any> {
  const pineconeFilter: Record<string, any> = {};
  
  if (filter.memoryTypes && filter.memoryTypes.length > 0) {
    pineconeFilter.memoryType = { $in: filter.memoryTypes };
  }
  
  if (filter.minCompositeScore !== undefined) {
    pineconeFilter.compositeScore = { $gte: filter.minCompositeScore };
  }
  
  if (filter.minRecencyScore !== undefined) {
    pineconeFilter.recencyScore = { $gte: filter.minRecencyScore };
  }
  
  if (filter.minImportanceScore !== undefined) {
    pineconeFilter.importanceScore = { $gte: filter.minImportanceScore };
  }
  
  if (filter.context && filter.context.length > 0) {
    // Context stored as comma-separated string
    // Use $in for any match
    pineconeFilter.context = { $in: filter.context };
  }
  
  if (filter.source && filter.source.length > 0) {
    pineconeFilter.source = { $in: filter.source };
  }
  
  if (filter.dateRange) {
    pineconeFilter.createdAt = {
      $gte: Math.floor(filter.dateRange.start.getTime() / 1000),
      $lte: Math.floor(filter.dateRange.end.getTime() / 1000),
    };
  }
  
  if (filter.personId) {
    pineconeFilter.personId = filter.personId;
  }
  
  if (filter.emotionTypes && filter.emotionTypes.length > 0) {
    pineconeFilter.emotionType = { $in: filter.emotionTypes };
  }
  
  return pineconeFilter;
}

// ============================================================================
// RETRIEVAL ORDERING LOGIC
// ============================================================================

export interface RetrievalStrategy {
  searchMemoryTypes: MemoryType[];
  topKPerType: number;
  rerankByScore: boolean;
  includeRelated: boolean;
  maxTotalResults: number;
}

/**
 * Default retrieval strategy: Working → Episodic → Semantic
 */
export const DEFAULT_RETRIEVAL_STRATEGY: RetrievalStrategy = {
  searchMemoryTypes: [
    MemoryType.WORKING,
    MemoryType.EPISODIC,
    MemoryType.SEMANTIC,
    MemoryType.SOCIAL,
  ],
  topKPerType: 5,
  rerankByScore: true,
  includeRelated: true,
  maxTotalResults: 10,
};

/**
 * Context-aware retrieval strategy
 */
export function getContextualStrategy(
  queryContext: {
    hasEmotionalContent: boolean;
    hasSocialContext: boolean;
    isFactual: boolean;
    isRecent: boolean;
  }
): RetrievalStrategy {
  const memoryTypes: MemoryType[] = [];
  
  // Always search working memory first for recent context
  memoryTypes.push(MemoryType.WORKING);
  
  if (queryContext.hasSocialContext) {
    memoryTypes.push(MemoryType.SOCIAL);
  }
  
  if (queryContext.hasEmotionalContent) {
    memoryTypes.push(MemoryType.EMOTIONAL);
  }
  
  if (queryContext.isFactual) {
    memoryTypes.push(MemoryType.SEMANTIC);
  }
  
  // Always include episodic for comprehensive coverage
  memoryTypes.push(MemoryType.EPISODIC);
  
  return {
    searchMemoryTypes: memoryTypes,
    topKPerType: queryContext.isRecent ? 8 : 5,
    rerankByScore: true,
    includeRelated: true,
    maxTotalResults: 15,
  };
}

// ============================================================================
// VECTOR UPSERT HELPERS
// ============================================================================

export interface VectorUpsertData {
  id: string;
  values: number[]; // Embedding vector
  metadata: VectorMetadata;
}

/**
 * Prepare vector data for upsert to Pinecone
 */
export function prepareVectorUpsert(
  memoryId: string,
  userId: string,
  memoryType: MemoryType,
  embedding: number[],
  metadata: Partial<VectorMetadata>
): VectorUpsertData {
  const now = Date.now();
  
  const fullMetadata: VectorMetadata = {
    memoryId,
    userId,
    memoryType,
    compositeScore: metadata.compositeScore ?? 0.5,
    importanceScore: metadata.importanceScore ?? 0.5,
    recencyScore: metadata.recencyScore ?? 1.0,
    frequencyScore: metadata.frequencyScore ?? 0.0,
    emotionalScore: metadata.emotionalScore ?? 0.0,
    socialScore: metadata.socialScore ?? 0.0,
    createdAt: metadata.createdAt ?? Math.floor(now / 1000),
    lastAccessedAt: metadata.lastAccessedAt ?? Math.floor(now / 1000),
    context: metadata.context ?? '',
    source: metadata.source ?? 'manual',
    contentHash: metadata.contentHash ?? '',
    ...metadata,
  };
  
  return {
    id: `${memoryType}_${memoryId}`,
    values: embedding,
    metadata: fullMetadata,
  };
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

/**
 * Pinecone index creation script (for setup)
 */
export function generateIndexCreationScript(
  userId: string
): string {
  const scripts: string[] = [];
  
  for (const memoryType of Object.values(MemoryType)) {
    const spec = getIndexSpec(userId, memoryType);
    
    scripts.push(`
# Create ${spec.description}
pinecone.create_index(
    name="${spec.name}",
    dimension=${spec.dimension},
    metric="${spec.metric}",
    pod_type="${spec.podType}",
    pods=${spec.pods},
    metadata_config={
        "indexed": ${JSON.stringify(spec.metadataConfig.indexed)}
    }
)
print("Created index: ${spec.name}")
`);
  }
  
  return scripts.join('\n');
}
