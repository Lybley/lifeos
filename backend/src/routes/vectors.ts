import { Router, Request, Response } from 'express';
import { pineconeClient } from '../config/pinecone';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Upsert vectors
router.post('/upsert', authMiddleware, async (req: Request, res: Response) => {
  if (!pineconeClient) {
    throw new AppError('Pinecone is not configured', 503);
  }
  
  const { vectors, namespace } = req.body;
  
  if (!vectors || !Array.isArray(vectors)) {
    throw new AppError('Vectors array is required', 400);
  }
  
  try {
    const indexName = process.env.PINECONE_INDEX || 'lifeos-vectors';
    const index = pineconeClient.index(indexName);
    
    await index.namespace(namespace || '').upsert(vectors);
    
    res.json({ message: 'Vectors upserted successfully', count: vectors.length });
  } catch (error) {
    logger.error('Error upserting vectors:', error);
    throw new AppError('Failed to upsert vectors', 500);
  }
});

// Query vectors
router.post('/query', authMiddleware, async (req: Request, res: Response) => {
  if (!pineconeClient) {
    throw new AppError('Pinecone is not configured', 503);
  }
  
  const { vector, topK, namespace, filter } = req.body;
  
  if (!vector || !Array.isArray(vector)) {
    throw new AppError('Query vector is required', 400);
  }
  
  try {
    const indexName = process.env.PINECONE_INDEX || 'lifeos-vectors';
    const index = pineconeClient.index(indexName);
    
    const queryResponse = await index.namespace(namespace || '').query({
      vector,
      topK: topK || 10,
      includeMetadata: true,
      ...(filter && { filter }),
    });
    
    res.json({
      matches: queryResponse.matches,
      namespace: queryResponse.namespace,
    });
  } catch (error) {
    logger.error('Error querying vectors:', error);
    throw new AppError('Failed to query vectors', 500);
  }
});

// Delete vectors
router.post('/delete', authMiddleware, async (req: Request, res: Response) => {
  if (!pineconeClient) {
    throw new AppError('Pinecone is not configured', 503);
  }
  
  const { ids, namespace } = req.body;
  
  if (!ids || !Array.isArray(ids)) {
    throw new AppError('IDs array is required', 400);
  }
  
  try {
    const indexName = process.env.PINECONE_INDEX || 'lifeos-vectors';
    const index = pineconeClient.index(indexName);
    
    await index.namespace(namespace || '').deleteMany(ids);
    
    res.json({ message: 'Vectors deleted successfully', count: ids.length });
  } catch (error) {
    logger.error('Error deleting vectors:', error);
    throw new AppError('Failed to delete vectors', 500);
  }
});

export default router;
