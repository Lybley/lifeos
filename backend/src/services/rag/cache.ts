/**
 * RAG Cache Service
 * Caches query results in Redis with configurable TTL
 */

import { queueConnection } from '../../config/queue';
import logger from '../../utils/logger';
import crypto from 'crypto';

export interface CachedRAGResponse {
  answer: string;
  citations: Array<{
    source_id: string;
    score: number;
    title?: string;
  }>;
  used_chunks: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  cached: boolean;
  cached_at?: string;
}

const CACHE_PREFIX = 'rag:query:';
const DEFAULT_TTL = 3600; // 1 hour in seconds

/**
 * Generate cache key from query and parameters
 */
export function generateCacheKey(
  userId: string,
  query: string,
  topK: number,
  additionalParams?: Record<string, any>
): string {
  // Normalize query (lowercase, trim, remove extra spaces)
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Create hash of query parameters
  const paramsStr = JSON.stringify({
    query: normalizedQuery,
    topK,
    ...additionalParams,
  });
  
  const hash = crypto
    .createHash('sha256')
    .update(paramsStr)
    .digest('hex')
    .substring(0, 16);

  return `${CACHE_PREFIX}${userId}:${hash}`;
}

/**
 * Get cached RAG response
 */
export async function getCachedResponse(
  cacheKey: string
): Promise<CachedRAGResponse | null> {
  try {
    const cached = await queueConnection.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    const response = JSON.parse(cached) as CachedRAGResponse;
    response.cached = true;
    
    logger.info(`Cache hit for key: ${cacheKey}`);
    return response;
  } catch (error) {
    logger.error('Failed to get cached response:', error);
    return null;
  }
}

/**
 * Cache RAG response
 */
export async function cacheResponse(
  cacheKey: string,
  response: Omit<CachedRAGResponse, 'cached' | 'cached_at'>,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const cacheData: CachedRAGResponse = {
      ...response,
      cached: false,
      cached_at: new Date().toISOString(),
    };

    await queueConnection.setex(
      cacheKey,
      ttl,
      JSON.stringify(cacheData)
    );

    logger.info(`Cached response for key: ${cacheKey} (TTL: ${ttl}s)`);
  } catch (error) {
    logger.error('Failed to cache response:', error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Invalidate cache for a user
 */
export async function invalidateUserCache(userId: string): Promise<number> {
  try {
    const pattern = `${CACHE_PREFIX}${userId}:*`;
    const keys = await queueConnection.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    const deleted = await queueConnection.del(...keys);
    logger.info(`Invalidated ${deleted} cache entries for user ${userId}`);
    return deleted;
  } catch (error) {
    logger.error('Failed to invalidate user cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(userId?: string): Promise<{
  totalKeys: number;
  pattern: string;
}> {
  try {
    const pattern = userId 
      ? `${CACHE_PREFIX}${userId}:*`
      : `${CACHE_PREFIX}*`;
    
    const keys = await queueConnection.keys(pattern);
    
    return {
      totalKeys: keys.length,
      pattern,
    };
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    return {
      totalKeys: 0,
      pattern: '',
    };
  }
}

/**
 * Clear all RAG cache (use with caution)
 */
export async function clearAllCache(): Promise<number> {
  try {
    const pattern = `${CACHE_PREFIX}*`;
    const keys = await queueConnection.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    const deleted = await queueConnection.del(...keys);
    logger.warn(`Cleared all RAG cache: ${deleted} entries deleted`);
    return deleted;
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    return 0;
  }
}
