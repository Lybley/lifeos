import { Router } from 'express';
import nodesRouter from './nodes';
import vectorsRouter from './vectors';
import jobsRouter from './jobs';
import ragRouter from './rag';
import taskExtractorRouter from './taskExtractor';
import agentsRouter from './agents';
import actionsRouter from './actions';
import privacyRouter from './privacy';
import permissionsRouter from './permissions';
import eventsRouter from './events';
import ingestionRouter from './ingestion';
import plannerRouter from './planner';
import vaultRouter from './vault';
import adminRouter from './admin';
import billingRouter from './billing';
import marketingRouter from './marketing';
import gdprRouter from './gdpr';
import authRouter from './auth';

const router = Router();

// API routes
router.use('/auth', authRouter);
router.use('/nodes', nodesRouter);
router.use('/vectors', vectorsRouter);
router.use('/jobs', jobsRouter);
router.use('/v1/rag', ragRouter);
router.use('/v1/tasks', taskExtractorRouter);
router.use('/v1/agents', agentsRouter);
router.use('/actions', actionsRouter);
router.use('/v1/privacy', privacyRouter);
router.use('/v1/permissions', permissionsRouter);
router.use('/v1/events', eventsRouter);
router.use('/v1/ingestion', ingestionRouter);
router.use('/v1/planner', plannerRouter);
router.use('/v1/vault', vaultRouter);
router.use('/v1/admin', adminRouter);
router.use('/v1/billing', billingRouter);
router.use('/v1/marketing', marketingRouter);
router.use('/v1/gdpr', gdprRouter);

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
      agents: '/api/v1/agents',
      actions: '/api/actions',
      privacy: '/api/v1/privacy',
      permissions: '/api/v1/permissions',
      events: '/api/v1/events',
      ingestion: '/api/v1/ingestion',
      planner: '/api/v1/planner',
      vault: '/api/v1/vault',
      admin: '/api/v1/admin',
      billing: '/api/v1/billing',
    },
  });
});

export default router;
