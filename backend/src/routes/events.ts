/**
 * Events API Routes
 */

import { Router, Request, Response } from 'express';
import { getEventDispatcher } from '../events/EventDispatcher';
import { EventType } from '../events/types';
import logger from '../utils/logger';

const router = Router();

/**
 * Publish event endpoint (internal use)
 */
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const { eventType, userIds, payload } = req.body;
    
    if (!eventType || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ 
        error: 'Missing required fields: eventType, userIds' 
      });
    }
    
    const dispatcher = getEventDispatcher();
    await dispatcher.publish(eventType as EventType, userIds, payload);
    
    res.json({ 
      success: true,
      message: `Event published to ${userIds.length} users` 
    });
    
  } catch (error) {
    logger.error('Failed to publish event', { error });
    res.status(500).json({ error: 'Failed to publish event' });
  }
});

/**
 * Broadcast event endpoint (internal use)
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { eventType, payload } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ error: 'Missing eventType' });
    }
    
    const dispatcher = getEventDispatcher();
    await dispatcher.broadcast(eventType as EventType, payload);
    
    res.json({ 
      success: true,
      message: 'Event broadcasted' 
    });
    
  } catch (error) {
    logger.error('Failed to broadcast event', { error });
    res.status(500).json({ error: 'Failed to broadcast event' });
  }
});

/**
 * Get event server stats
 */
router.get('/stats', (req: Request, res: Response) => {
  const eventServer = (req.app as any).eventServer;
  
  if (!eventServer) {
    return res.status(503).json({ error: 'Event server not available' });
  }
  
  res.json(eventServer.getStats());
});

export default router;
