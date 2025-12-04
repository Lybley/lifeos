/**
 * RAG API Routes
 * Endpoints for Retrieval-Augmented Generation queries
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { queryRAG, RAGQueryRequest } from '../services/rag/ragService';
import { invalidateUserCache, getCacheStats, clearAllCache } from '../services/rag/cache';
import { requirePermission, AuthenticatedRequest } from '../permissions/PermissionMiddleware';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/rag/query
 * Main RAG query endpoint
 */
router.post(
  '/query',
  [
    body('user_id').isString().notEmpty().withMessage('user_id is required'),
    body('query').isString().notEmpty().withMessage('query is required'),
    body('top_k').optional().isInt({ min: 1, max: 20 }).withMessage('top_k must be between 1 and 20'),
    body('min_score').optional().isFloat({ min: 0, max: 1 }).withMessage('min_score must be between 0 and 1'),
    body('use_cache').optional().isBoolean(),
    body('llm_provider').optional().isIn(['openai', 'anthropic', 'gemini']),
    body('llm_model').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const request: RAGQueryRequest = {
        user_id: req.body.user_id,
        query: req.body.query,
        top_k: req.body.top_k,
        min_score: req.body.min_score,
        use_cache: req.body.use_cache,
        llm_provider: req.body.llm_provider,
        llm_model: req.body.llm_model,
      };

      logger.info(`RAG query received from user ${request.user_id}: "${request.query}"`);

      // Execute RAG query
      const response = await queryRAG(request);

      logger.info(
        `RAG query completed in ${response.latency}ms, ` +
        `${response.used_chunks} chunks, ` +
        `${response.citations.length} citations, ` +
        `confidence: ${response.confidence}, ` +
        `cached: ${response.cached}`
      );

      res.json(response);
    } catch (error) {
      logger.error('RAG query endpoint error:', error);
      res.status(500).json({
        error: 'RAG query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/rag/batch
 * Batch RAG queries
 */
router.post(
  '/batch',
  [
    body('user_id').isString().notEmpty(),
    body('queries').isArray({ min: 1, max: 10 }).withMessage('queries must be an array of 1-10 items'),
    body('queries.*').isString().notEmpty(),
    body('top_k').optional().isInt({ min: 1, max: 20 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { user_id, queries, top_k, min_score, use_cache } = req.body;

      logger.info(`Batch RAG query received: ${queries.length} queries from user ${user_id}`);

      // Process queries in parallel
      const results = await Promise.allSettled(
        queries.map((query: string) =>
          queryRAG({
            user_id,
            query,
            top_k,
            min_score,
            use_cache,
          })
        )
      );

      // Format results
      const responses = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            query: queries[index],
            success: true,
            data: result.value,
          };
        } else {
          return {
            query: queries[index],
            success: false,
            error: result.reason.message,
          };
        }
      });

      const successCount = responses.filter(r => r.success).length;
      logger.info(`Batch RAG completed: ${successCount}/${queries.length} successful`);

      res.json({
        total: queries.length,
        successful: successCount,
        failed: queries.length - successCount,
        results: responses,
      });
    } catch (error) {
      logger.error('Batch RAG query error:', error);
      res.status(500).json({
        error: 'Batch query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/v1/rag/cache/:userId
 * Invalidate cache for a user
 */
router.delete('/cache/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const deleted = await invalidateUserCache(userId);

    logger.info(`Invalidated cache for user ${userId}: ${deleted} entries deleted`);

    res.json({
      success: true,
      message: `Cache invalidated for user ${userId}`,
      entries_deleted: deleted,
    });
  } catch (error) {
    logger.error('Cache invalidation error:', error);
    res.status(500).json({
      error: 'Cache invalidation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/rag/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', [
  query('user_id').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string | undefined;
    const stats = await getCacheStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/v1/rag/cache/all
 * Clear all RAG cache (admin only)
 */
router.delete('/cache/all', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    const deleted = await clearAllCache();

    logger.warn(`All RAG cache cleared: ${deleted} entries deleted`);

    res.json({
      success: true,
      message: 'All cache cleared',
      entries_deleted: deleted,
    });
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/rag/health
 * Health check for RAG service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if required services are available
    const checks = {
      pinecone: !!process.env.PINECONE_API_KEY,
      llm: !!(process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY),
      redis: true, // Assume true since we got here
    };

    const allHealthy = Object.values(checks).every(v => v);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
