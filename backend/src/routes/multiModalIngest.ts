/**
 * Multi-Modal Ingestion API Routes
 * 
 * Handles voice, image, screenshot, and browser history ingestion
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { voiceProcessor } from '../services/ingestion/voiceProcessor';
import { imageProcessor } from '../services/ingestion/imageProcessor';
import { screenshotProcessor } from '../services/ingestion/screenshotProcessor';
import { postgresClient } from '../config/postgres';
import logger from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// ============================================================================
// VOICE MESSAGE INGESTION
// ============================================================================

/**
 * POST /api/v1/ingest/voice
 * Upload and process voice message
 */
router.post('/voice', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const userId = req.body.user_id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    logger.info('Voice ingestion request', {
      userId,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
    
    // Detect format from mimetype
    const format = req.file.mimetype.split('/')[1] || 'mp3';
    
    // Process voice message
    const voiceMessage = await voiceProcessor.processVoiceMessage(
      req.file.buffer,
      userId,
      {
        format,
        source: req.body.source || 'api',
        capturedAt: req.body.captured_at ? new Date(req.body.captured_at) : undefined,
      }
    );
    
    // Store in database
    await storeIngestion(voiceMessage);
    
    res.json({
      success: true,
      ingestionId: voiceMessage.id,
      transcription: voiceMessage.transcription?.text,
      language: voiceMessage.transcription?.language,
      duration: voiceMessage.audioMetadata.duration,
    });
    
  } catch (error) {
    logger.error('Voice ingestion failed', { error });
    res.status(500).json({
      error: 'Failed to process voice message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// IMAGE INGESTION
// ============================================================================

/**
 * POST /api/v1/ingest/image
 * Upload and process image
 */
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const userId = req.body.user_id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    logger.info('Image ingestion request', {
      userId,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
    
    const format = req.file.mimetype.split('/')[1] || 'jpeg';
    
    // Process image
    const imageIngestion = await imageProcessor.processImage(
      req.file.buffer,
      userId,
      {
        format,
        source: req.body.source || 'api',
        capturedAt: req.body.captured_at ? new Date(req.body.captured_at) : undefined,
      }
    );
    
    // Store in database
    await storeIngestion(imageIngestion);
    
    res.json({
      success: true,
      ingestionId: imageIngestion.id,
      caption: imageIngestion.visionAnalysis?.caption,
      objects: imageIngestion.visionAnalysis?.objects.map(o => o.name),
      text: imageIngestion.visionAnalysis?.text.map(t => t.text),
      classification: imageIngestion.classification,
    });
    
  } catch (error) {
    logger.error('Image ingestion failed', { error });
    res.status(500).json({
      error: 'Failed to process image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SCREENSHOT INGESTION
// ============================================================================

/**
 * POST /api/v1/ingest/screenshot
 * Upload and process screenshot
 */
router.post('/screenshot', upload.single('screenshot'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No screenshot file provided' });
    }
    
    const userId = req.body.user_id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    logger.info('Screenshot ingestion request', {
      userId,
      size: req.file.size,
      deviceType: req.body.device_type,
    });
    
    // Process screenshot
    const screenshotIngestion = await screenshotProcessor.processScreenshot(
      req.file.buffer,
      userId,
      {
        deviceType: req.body.device_type || 'desktop',
        application: req.body.application,
        source: req.body.source || 'api',
        capturedAt: req.body.captured_at ? new Date(req.body.captured_at) : undefined,
      }
    );
    
    // Store in database
    await storeIngestion(screenshotIngestion);
    
    res.json({
      success: true,
      ingestionId: screenshotIngestion.id,
      textExtracted: screenshotIngestion.ocrResults?.fullText.length || 0,
      classification: screenshotIngestion.classification,
      chunks: screenshotIngestion.chunks?.length || 0,
    });
    
  } catch (error) {
    logger.error('Screenshot ingestion failed', { error });
    res.status(500).json({
      error: 'Failed to process screenshot',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// BROWSER HISTORY INGESTION
// ============================================================================

/**
 * POST /api/v1/ingest/browser
 * Ingest browser history from Chrome extension
 */
router.post('/browser', async (req: Request, res: Response) => {
  try {
    const { userId, entries, browserMetadata } = req.body;
    
    if (!userId || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ 
        error: 'userId and entries array are required' 
      });
    }
    
    logger.info('Browser history ingestion request', {
      userId,
      entriesCount: entries.length,
      browser: browserMetadata?.browser,
    });
    
    // Create browser history ingestion record
    const ingestionId = require('uuid').v4();
    
    const browserIngestion = {
      id: ingestionId,
      userId,
      type: 'browser_history',
      source: 'chrome_extension',
      capturedAt: new Date(),
      rawContent: JSON.stringify(entries),
      status: 'completed',
      browserMetadata,
      entries,
      metadata: {
        entriesCount: entries.length,
        processedAt: new Date(),
      },
      tags: extractBrowserHistoryTags(entries),
    };
    
    // Store in database
    await storeIngestion(browserIngestion);
    
    // Process entries individually (could be background job)
    const uniqueDomains = new Set(entries.map((e: any) => e.domain)).size;
    
    res.json({
      success: true,
      ingestionId,
      entriesProcessed: entries.length,
      uniqueDomains,
    });
    
  } catch (error) {
    logger.error('Browser history ingestion failed', { error });
    res.status(500).json({
      error: 'Failed to process browser history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET INGESTION STATUS
// ============================================================================

/**
 * GET /api/v1/ingest/:id
 * Get ingestion status and results
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ingestionId = req.params.id;
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await postgresClient.query(
      'SELECT * FROM ingestions WHERE id = $1 AND user_id = $2',
      [ingestionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingestion not found' });
    }
    
    const ingestion = result.rows[0];
    
    res.json({
      id: ingestion.id,
      type: ingestion.type,
      status: ingestion.status,
      capturedAt: ingestion.captured_at,
      processedAt: ingestion.processed_at,
      metadata: ingestion.metadata,
      error: ingestion.error,
    });
    
  } catch (error) {
    logger.error('Failed to get ingestion status', { error });
    res.status(500).json({ error: 'Failed to retrieve ingestion' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function storeIngestion(ingestion: any) {
  try {
    // Store in PostgreSQL
    await postgresClient.query(
      `INSERT INTO ingestions 
       (id, user_id, type, source, captured_at, processed_at, status, raw_content, processed_content, metadata, tags, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        ingestion.id,
        ingestion.userId,
        ingestion.type,
        ingestion.source,
        ingestion.capturedAt,
        new Date(),
        ingestion.status,
        ingestion.rawContent?.substring(0, 1000), // Store sample
        JSON.stringify(ingestion.processedContent || {}),
        JSON.stringify(ingestion.metadata || {}),
        ingestion.tags || [],
        ingestion.error,
      ]
    );
    
    logger.info('Ingestion stored', { id: ingestion.id, type: ingestion.type });
    
  } catch (error) {
    logger.error('Failed to store ingestion', { error });
    throw error;
  }
}

function extractBrowserHistoryTags(entries: any[]): string[] {
  const domains = new Set<string>();
  
  entries.forEach((entry: any) => {
    if (entry.domain) {
      domains.add(entry.domain);
    }
  });
  
  return Array.from(domains).slice(0, 10);
}

export default router;
