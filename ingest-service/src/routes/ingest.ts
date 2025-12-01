import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { processDocument, processTextContent } from '../services/documentProcessor';
import { chunkDocument } from '../services/chunker';
import { getDefaultEmbeddingClient } from '../services/embeddings';
import { storeDocument } from '../services/storage';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /ingest/upload
 * Upload and process a document file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate file
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Get user ID from request (in production, extract from JWT)
    const userId = req.body.userId || 'user-001';
    const documentTitle = req.body.title || req.file.originalname;

    logger.info(`Processing upload: ${req.file.originalname}`);

    // 1. Extract text from document
    const processed = await processDocument(req.file.path, req.file.mimetype);

    logger.info(
      `Extracted ${processed.metadata.characterCount} characters using ${processed.metadata.processingMethod}`
    );

    // 2. Chunk the document
    const chunked = chunkDocument(processed.text, {
      maxTokens: parseInt(req.body.maxTokens || '512'),
      overlapTokens: parseInt(req.body.overlapTokens || '50'),
      minChunkSize: parseInt(req.body.minChunkSize || '100'),
    });

    logger.info(`Created ${chunked.totalChunks} chunks`);

    // 3. Generate embeddings
    const embeddingClient = getDefaultEmbeddingClient();
    const chunkTexts = chunked.chunks.map((c) => c.content);
    const embeddingResult = await embeddingClient.embedBatch(chunkTexts);

    logger.info(
      `Generated ${embeddingResult.embeddings.length} embeddings using ${embeddingResult.model}`
    );

    // 4. Store in all databases
    const storageResult = await storeDocument(
      userId,
      documentTitle,
      processed.text,
      chunked.chunks,
      embeddingResult.embeddings,
      {
        ...processed.metadata,
        originalFileName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
      }
    );

    const processingTime = Date.now() - startTime;

    logger.info(`Document processed successfully in ${processingTime}ms`);

    res.status(201).json({
      success: true,
      data: {
        documentId: storageResult.documentId,
        documentTitle,
        chunks: chunked.totalChunks,
        embeddings: embeddingResult.embeddings.length,
        processingTime,
        metadata: {
          ...processed.metadata,
          embeddingModel: embeddingResult.model,
          embeddingDimensions: embeddingResult.embeddings[0]?.dimensions,
          storageResult,
        },
      },
    });
  } catch (error) {
    logger.error('Upload processing failed:', error);
    throw error;
  }
});

/**
 * POST /ingest/text
 * Process text content directly (no file upload)
 */
router.post('/text', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { text, title, userId = 'user-001' } = req.body;

    if (!text || typeof text !== 'string') {
      throw new AppError('Text content is required', 400);
    }

    if (!title || typeof title !== 'string') {
      throw new AppError('Title is required', 400);
    }

    logger.info(`Processing text input: ${title}`);

    // 1. Process text
    const processed = await processTextContent(text);

    // 2. Chunk the text
    const chunked = chunkDocument(processed.text, {
      maxTokens: parseInt(req.body.maxTokens || '512'),
      overlapTokens: parseInt(req.body.overlapTokens || '50'),
      minChunkSize: parseInt(req.body.minChunkSize || '100'),
    });

    logger.info(`Created ${chunked.totalChunks} chunks`);

    // 3. Generate embeddings
    const embeddingClient = getDefaultEmbeddingClient();
    const chunkTexts = chunked.chunks.map((c) => c.content);
    const embeddingResult = await embeddingClient.embedBatch(chunkTexts);

    logger.info(
      `Generated ${embeddingResult.embeddings.length} embeddings using ${embeddingResult.model}`
    );

    // 4. Store in all databases
    const storageResult = await storeDocument(
      userId,
      title,
      processed.text,
      chunked.chunks,
      embeddingResult.embeddings,
      {
        ...processed.metadata,
        submittedAt: new Date().toISOString(),
      }
    );

    const processingTime = Date.now() - startTime;

    logger.info(`Text processed successfully in ${processingTime}ms`);

    res.status(201).json({
      success: true,
      data: {
        documentId: storageResult.documentId,
        documentTitle: title,
        chunks: chunked.totalChunks,
        embeddings: embeddingResult.embeddings.length,
        processingTime,
        metadata: {
          ...processed.metadata,
          embeddingModel: embeddingResult.model,
          embeddingDimensions: embeddingResult.embeddings[0]?.dimensions,
          storageResult,
        },
      },
    });
  } catch (error) {
    logger.error('Text processing failed:', error);
    throw error;
  }
});

export default router;
