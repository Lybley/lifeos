import { Router } from 'express';
import nodesRouter from './nodes';
import vectorsRouter from './vectors';
import jobsRouter from './jobs';
import ragRouter from './rag';
import taskExtractorRouter from './taskExtractor';

const router = Router();

// API routes
router.use('/nodes', nodesRouter);
router.use('/vectors', vectorsRouter);
router.use('/jobs', jobsRouter);
router.use('/v1/rag', ragRouter);
router.use('/v1/tasks', taskExtractorRouter);

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'LifeOS Core API',
    version: '1.0.0',
    endpoints: {
      nodes: '/api/nodes',
      vectors: '/api/vectors',
      jobs: '/api/jobs',
      rag: '/api/v1/rag',
      tasks: '/api/v1/tasks',
    },
  });
});

export default router;
