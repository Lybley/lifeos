import { Router } from 'express';
import nodesRouter from './nodes';
import vectorsRouter from './vectors';
import jobsRouter from './jobs';

const router = Router();

// API routes
router.use('/nodes', nodesRouter);
router.use('/vectors', vectorsRouter);
router.use('/jobs', jobsRouter);

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'LifeOS Core API',
    version: '1.0.0',
    endpoints: {
      nodes: '/api/nodes',
      vectors: '/api/vectors',
      jobs: '/api/jobs',
    },
  });
});

export default router;
