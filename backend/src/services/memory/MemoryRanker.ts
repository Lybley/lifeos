/**
 * Memory Ranker Service
 * 
 * Retrieves and ranks memories from multiple layers for RAG queries
 * Implements intelligent selection across working, episodic, and semantic memory
 */

import {
  MemoryType,
  MemoryMetadata,
  calculateMemoryScore,
  updateMemoryScores,
  reinforceMemory,
} from './memoryTypes';
import {
  RetrievalFilter,
  RetrievalStrategy,
  DEFAULT_RETRIEVAL_STRATEGY,
  getContextualStrategy,
  buildPineconeFilter,
  VectorMetadata,
} from './vectorIndexStrategy';
import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RankedMemory {
  memoryId: string;
  memoryType: MemoryType;
  content: string;
  summary?: string;
  
  // Scores
  compositeScore: number;
  relevanceScore: number; // Vector similarity
  finalScore: number; // Combined ranking score
  
  // Metadata
  metadata: VectorMetadata;
  
  // Context
  relatedMemories?: string[];
  accessPath: string; // e.g., "working->episodic"
}

export interface MemoryRetrievalResult {
  memories: RankedMemory[];
  totalSearched: number;
  searchStrategy: string;
  retrievalTime: number;
  layerBreakdown: Record<MemoryType, number>;
}

export interface QueryContext {
  hasEmotionalContent: boolean;
  hasSocialContext: boolean;
  isFactual: boolean;
  isRecent: boolean;
  emotionalKeywords?: string[];
  socialKeywords?: string[];
}

// ============================================================================
// MEMORY RANKER CLASS
// ============================================================================

export class MemoryRanker {
  private pinecone: Pinecone;
  
  constructor(pinecone: Pinecone) {
    this.pinecone = pinecone;
  }
  
  /**
   * Main retrieval method: Search and rank memories for RAG
   */
  async retrieveAndRankMemories(
    userId: string,
    queryEmbedding: number[],
    query: string,
    options: {
      strategy?: RetrievalStrategy;
      filter?: RetrievalFilter;
      queryContext?: QueryContext;
    } = {}
  ): Promise<MemoryRetrievalResult> {
    const startTime = Date.now();
    
    // Determine retrieval strategy
    const strategy = options.strategy ||
      (options.queryContext 
        ? getContextualStrategy(options.queryContext)
        : DEFAULT_RETRIEVAL_STRATEGY);
    
    logger.info('Starting memory retrieval', {
      userId,
      strategy: strategy.searchMemoryTypes.join(' -> '),
    });
    
    // Search each memory type
    const allMemories: RankedMemory[] = [];
    const layerBreakdown: Record<MemoryType, number> = {} as any;
    
    for (const memoryType of strategy.searchMemoryTypes) {
      const memories = await this.searchMemoryLayer(
        userId,
        memoryType,
        queryEmbedding,
        strategy.topKPerType,
        options.filter
      );
      
      allMemories.push(...memories);
      layerBreakdown[memoryType] = memories.length;
      
      logger.info(`Retrieved ${memories.length} memories from ${memoryType} layer`);
    }
    
    // Re-rank memories
    let rankedMemories = strategy.rerankByScore
      ? this.rerankMemories(allMemories, query, options.queryContext)
      : allMemories;
    
    // Limit to max results
    rankedMemories = rankedMemories.slice(0, strategy.maxTotalResults);
    
    // Include related memories if requested
    if (strategy.includeRelated) {
      rankedMemories = await this.enrichWithRelatedMemories(
        userId,
        rankedMemories
      );
    }
    
    const retrievalTime = Date.now() - startTime;
    
    logger.info('Memory retrieval complete', {
      totalMemories: rankedMemories.length,
      retrievalTime,
      layerBreakdown,
    });
    
    return {
      memories: rankedMemories,
      totalSearched: allMemories.length,
      searchStrategy: strategy.searchMemoryTypes.join(' -> '),
      retrievalTime,
      layerBreakdown,
    };
  }
  
  /**
   * Search a specific memory layer (type)
   */
  private async searchMemoryLayer(
    userId: string,
    memoryType: MemoryType,
    queryEmbedding: number[],
    topK: number,
    filter?: RetrievalFilter
  ): Promise<RankedMemory[]> {
    try {
      // Get index for this memory type
      const indexName = this.getIndexName(userId, memoryType);
      const index = this.pinecone.index(indexName);
      
      // Build filter
      const pineconeFilter = filter 
        ? buildPineconeFilter({ ...filter, memoryTypes: [memoryType] })
        : { userId, memoryType };
      
      // Query vector index
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        filter: pineconeFilter,
        includeMetadata: true,
      });
      
      // Convert to RankedMemory
      const memories: RankedMemory[] = (queryResponse.matches || []).map(match => {
        const metadata = match.metadata as VectorMetadata;
        const relevanceScore = match.score || 0;
        
        // Calculate final score (combination of relevance and composite score)
        const finalScore = this.calculateFinalScore(
          relevanceScore,
          metadata.compositeScore
        );
        
        return {
          memoryId: metadata.memoryId,
          memoryType,
          content: '', // Fetch from database in real implementation
          summary: undefined,
          compositeScore: metadata.compositeScore,
          relevanceScore,
          finalScore,
          metadata,
          accessPath: memoryType,
        };
      });
      
      return memories;
      
    } catch (error) {
      logger.error(`Failed to search ${memoryType} layer`, { error });
      return [];
    }
  }
  
  /**
   * Re-rank memories using composite scoring
   */
  private rerankMemories(
    memories: RankedMemory[],
    query: string,
    context?: QueryContext
  ): RankedMemory[] {
    return memories
      .map(memory => {
        // Apply contextual boosts
        let boostedScore = memory.finalScore;
        
        if (context?.hasEmotionalContent && memory.metadata.emotionalScore > 0.5) {
          boostedScore *= 1.2; // 20% boost for emotional relevance
        }
        
        if (context?.hasSocialContext && memory.metadata.socialScore > 0.5) {
          boostedScore *= 1.15; // 15% boost for social relevance
        }
        
        if (context?.isRecent && memory.metadata.recencyScore > 0.7) {
          boostedScore *= 1.1; // 10% boost for recent memories
        }
        
        // Prefer working memory for very recent queries
        if (memory.memoryType === MemoryType.WORKING && context?.isRecent) {
          boostedScore *= 1.25;
        }
        
        return {
          ...memory,
          finalScore: Math.min(1, boostedScore),
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }
  
  /**
   * Calculate final ranking score
   * Combines vector similarity with memory composite score
   */
  private calculateFinalScore(
    relevanceScore: number,
    compositeScore: number
  ): number {
    // Weighted combination: 60% relevance, 40% composite
    return (relevanceScore * 0.6) + (compositeScore * 0.4);
  }
  
  /**
   * Enrich memories with related memories from graph
   */
  private async enrichWithRelatedMemories(
    userId: string,
    memories: RankedMemory[]
  ): Promise<RankedMemory[]> {
    // TODO: Query Neo4j for related memories
    // For now, just return as-is
    return memories;
  }
  
  /**
   * Get index name for memory type
   */
  private getIndexName(userId: string, memoryType: MemoryType): string {
    const userHash = userId.slice(0, 8);
    const suffix = memoryType;
    return `lifeos-${userHash}-${suffix}`;
  }
  
  /**
   * Record memory access and apply reinforcement
   */
  async recordMemoryAccess(
    userId: string,
    memoryId: string,
    memoryType: MemoryType,
    contextualRelevance: number
  ): Promise<void> {
    try {
      // TODO: Update metadata in both Pinecone and Neo4j
      // 1. Increment access count
      // 2. Update lastAccessedAt
      // 3. Apply reinforcement
      // 4. Recalculate scores
      
      logger.info('Memory access recorded', {
        userId,
        memoryId,
        memoryType,
        contextualRelevance,
      });
      
    } catch (error) {
      logger.error('Failed to record memory access', { error });
    }
  }
}

// ============================================================================
// SAMPLE SCORING FUNCTION
// ============================================================================

/**
 * Advanced scoring function with multiple factors
 */
export function advancedMemoryScoring(
  memory: RankedMemory,
  query: string,
  userContext: {
    recentActivity: string[];
    preferences: Record<string, number>;
    currentEmotionalState?: string;
  }
): number {
  let score = memory.finalScore;
  
  // Factor 1: Recency boost (exponential decay)
  const hoursSinceAccess = 
    (Date.now() - memory.metadata.lastAccessedAt * 1000) / (1000 * 60 * 60);
  const recencyBoost = Math.exp(-0.01 * hoursSinceAccess);
  score += recencyBoost * 0.1;
  
  // Factor 2: Frequency boost (logarithmic)
  const accessCount = memory.metadata.frequencyScore * 100; // Denormalize
  const frequencyBoost = Math.log(1 + accessCount) / Math.log(100);
  score += frequencyBoost * 0.08;
  
  // Factor 3: Contextual alignment
  const memoryContext = memory.metadata.context.split(',');
  const contextOverlap = userContext.recentActivity.filter(
    activity => memoryContext.includes(activity)
  ).length;
  const contextBoost = Math.min(1, contextOverlap / 3);
  score += contextBoost * 0.12;
  
  // Factor 4: Emotional state alignment
  if (userContext.currentEmotionalState && memory.metadata.emotionType) {
    if (userContext.currentEmotionalState === memory.metadata.emotionType) {
      score += 0.15; // Strong boost for emotional alignment
    }
  }
  
  // Factor 5: Importance multiplier
  score *= (0.8 + memory.metadata.importanceScore * 0.4);
  
  // Factor 6: Memory type priority
  const typePriorities: Record<MemoryType, number> = {
    [MemoryType.WORKING]: 1.3,
    [MemoryType.EPISODIC]: 1.1,
    [MemoryType.SEMANTIC]: 1.0,
    [MemoryType.SOCIAL]: 1.05,
    [MemoryType.EMOTIONAL]: 1.08,
  };
  score *= typePriorities[memory.memoryType];
  
  // Normalize to 0-1
  return Math.max(0, Math.min(1, score));
}

// ============================================================================
// RETRIEVAL TRACE HELPERS
// ============================================================================

export interface RetrievalTrace {
  query: string;
  timestamp: Date;
  layers: {
    layer: MemoryType;
    queriedAt: Date;
    resultsCount: number;
    topMemory?: {
      id: string;
      score: number;
      reason: string;
    };
  }[];
  finalSelection: {
    memoryId: string;
    memoryType: MemoryType;
    score: number;
    selectionReason: string;
  }[];
  totalTime: number;
}

/**
 * Create detailed retrieval trace for debugging/monitoring
 */
export function createRetrievalTrace(
  query: string,
  result: MemoryRetrievalResult
): RetrievalTrace {
  const now = new Date();
  
  const layers = Object.entries(result.layerBreakdown).map(([layer, count]) => {
    const topMemory = result.memories.find(m => m.memoryType === layer as MemoryType);
    
    return {
      layer: layer as MemoryType,
      queriedAt: now,
      resultsCount: count,
      topMemory: topMemory ? {
        id: topMemory.memoryId,
        score: topMemory.finalScore,
        reason: `Relevance: ${topMemory.relevanceScore.toFixed(2)}, Composite: ${topMemory.compositeScore.toFixed(2)}`,
      } : undefined,
    };
  });
  
  const finalSelection = result.memories.slice(0, 5).map(m => ({
    memoryId: m.memoryId,
    memoryType: m.memoryType,
    score: m.finalScore,
    selectionReason: `${m.memoryType} layer, score=${m.finalScore.toFixed(3)}`,
  }));
  
  return {
    query,
    timestamp: now,
    layers,
    finalSelection,
    totalTime: result.retrievalTime,
  };
}
