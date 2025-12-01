/**
 * Agent API Routes - Summarizer and Drafting
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  createSummarizerAgent,
  SUMMARIZER_CONFIG,
  SummaryInput,
} from '../services/agents/summarizerAgent';
import {
  createDraftingAgent,
  DRAFTING_CONFIG,
  DraftInput,
  EmailTone,
} from '../services/agents/draftingAgent';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// SUMMARIZER ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/agents/summarize
 * Generate TL;DR and bullet summary
 */
router.post(
  '/summarize',
  [
    body('text').isString().notEmpty().withMessage('text is required'),
    body('metadata').optional().isObject(),
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

      const input: SummaryInput = {
        text: req.body.text,
        metadata: req.body.metadata,
      };

      // Validate input
      const validation = SUMMARIZER_CONFIG.validate(input);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid input',
          message: validation.error,
        });
      }

      logger.info(`Summarization request (${input.text.length} chars)`);

      const agent = createSummarizerAgent();
      const summary = await agent.summarize(input);

      logger.info(
        `Summarization complete: ${summary.metadata.compression_ratio}% compression`
      );

      res.json(summary);
    } catch (error) {
      logger.error('Summarization endpoint error:', error);
      res.status(500).json({
        error: 'Summarization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/agents/summarize/batch
 * Batch summarization
 */
router.post(
  '/summarize/batch',
  [
    body('items').isArray({ min: 1, max: 10 }).withMessage('items must be an array of 1-10 items'),
    body('items.*.text').isString().notEmpty(),
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

      const inputs: SummaryInput[] = req.body.items;

      logger.info(`Batch summarization request: ${inputs.length} items`);

      const agent = createSummarizerAgent();
      const summaries = await agent.summarizeBatch(inputs);

      res.json({
        success: true,
        total: inputs.length,
        succeeded: summaries.length,
        summaries,
      });
    } catch (error) {
      logger.error('Batch summarization error:', error);
      res.status(500).json({
        error: 'Batch summarization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ============================================================================
// DRAFTING ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/agents/draft
 * Draft email reply
 */
router.post(
  '/draft',
  [
    body('thread').isObject().withMessage('thread is required'),
    body('thread.messages').isArray({ min: 1 }).withMessage('thread must have at least one message'),
    body('tone').optional().isIn(['professional', 'casual', 'friendly', 'formal']),
    body('max_length').optional().isIn(['short', 'medium', 'long']),
    body('key_points').optional().isArray(),
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

      const input: DraftInput = {
        thread: req.body.thread,
        tone: req.body.tone as EmailTone,
        max_length: req.body.max_length,
        key_points: req.body.key_points,
        user_name: req.body.user_name,
        user_email: req.body.user_email,
      };

      // Validate input
      const validation = DRAFTING_CONFIG.validate(input);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid input',
          message: validation.error,
        });
      }

      logger.info(
        `Email draft request (tone: ${input.tone || 'professional'}, ` +
        `${input.thread.messages.length} messages in thread)`
      );

      const agent = createDraftingAgent();
      const draft = await agent.draftReply(input);

      logger.info(`Draft complete: ${draft.metadata.word_count} words`);

      res.json(draft);
    } catch (error) {
      logger.error('Email drafting endpoint error:', error);
      res.status(500).json({
        error: 'Email drafting failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v1/agents/draft/with-alternatives
 * Draft email with multiple tone alternatives
 */
router.post(
  '/draft/with-alternatives',
  [
    body('thread').isObject().withMessage('thread is required'),
    body('thread.messages').isArray({ min: 1 }),
    body('tone').optional().isIn(['professional', 'casual', 'friendly', 'formal']),
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

      const input: DraftInput = {
        thread: req.body.thread,
        tone: req.body.tone as EmailTone,
        max_length: req.body.max_length,
        key_points: req.body.key_points,
        user_name: req.body.user_name,
        user_email: req.body.user_email,
      };

      logger.info('Email draft with alternatives request');

      const agent = createDraftingAgent();
      const draft = await agent.draftWithAlternatives(input);

      logger.info(
        `Draft with ${Object.keys(draft.alternatives || {}).length} alternatives complete`
      );

      res.json(draft);
    } catch (error) {
      logger.error('Draft with alternatives error:', error);
      res.status(500).json({
        error: 'Draft with alternatives failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/agents/health
 * Health check for agent services
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    agents: {
      summarizer: 'available',
      drafting: 'available',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
