import { Router, Request, Response } from 'express';
import { neo4jDriver } from '../config/neo4j';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Get all nodes
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(
      'MATCH (n) RETURN n LIMIT 100'
    );
    
    const nodes = result.records.map(record => ({
      id: record.get('n').identity.toString(),
      labels: record.get('n').labels,
      properties: record.get('n').properties,
    }));
    
    res.json({ nodes, count: nodes.length });
  } catch (error) {
    logger.error('Error fetching nodes:', error);
    throw new AppError('Failed to fetch nodes', 500);
  } finally {
    await session.close();
  }
});

// Create a node
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { label, properties } = req.body;
  
  if (!label) {
    throw new AppError('Label is required', 400);
  }
  
  const session = neo4jDriver.session();
  try {
    const result = await session.run(
      `CREATE (n:${label} $properties) RETURN n`,
      { properties: properties || {} }
    );
    
    const node = result.records[0].get('n');
    
    res.status(201).json({
      id: node.identity.toString(),
      labels: node.labels,
      properties: node.properties,
    });
  } catch (error) {
    logger.error('Error creating node:', error);
    throw new AppError('Failed to create node', 500);
  } finally {
    await session.close();
  }
});

// Get node by ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = neo4jDriver.session();
  
  try {
    const result = await session.run(
      'MATCH (n) WHERE ID(n) = $id RETURN n',
      { id: parseInt(id) }
    );
    
    if (result.records.length === 0) {
      throw new AppError('Node not found', 404);
    }
    
    const node = result.records[0].get('n');
    
    res.json({
      id: node.identity.toString(),
      labels: node.labels,
      properties: node.properties,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching node:', error);
    throw new AppError('Failed to fetch node', 500);
  } finally {
    await session.close();
  }
});

// Delete node
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = neo4jDriver.session();
  
  try {
    const result = await session.run(
      'MATCH (n) WHERE ID(n) = $id DELETE n RETURN count(n) as deleted',
      { id: parseInt(id) }
    );
    
    const deleted = result.records[0].get('deleted').toNumber();
    
    if (deleted === 0) {
      throw new AppError('Node not found', 404);
    }
    
    res.json({ message: 'Node deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error deleting node:', error);
    throw new AppError('Failed to delete node', 500);
  } finally {
    await session.close();
  }
});

export default router;
