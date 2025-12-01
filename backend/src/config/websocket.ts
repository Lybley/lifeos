/**
 * WebSocket Configuration
 * Provides real-time updates for chat, actions, and sync status
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';

let io: Server | null = null;

export interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  timestamp: string;
}

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.BASE_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    logger.info(`WebSocket client connected: ${socket.id}${userId ? ` (user: ${userId})` : ''}`);

    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`User ${userId} joined their room`);
    }

    // Handle chat message
    socket.on('chat:message', (data) => {
      logger.info('Chat message received:', data);
      // Broadcast to user's room
      if (userId) {
        io?.to(`user:${userId}`).emit('chat:message', {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle typing indicator
    socket.on('chat:typing', (data) => {
      if (userId) {
        socket.to(`user:${userId}`).emit('chat:typing', data);
      }
    });

    // Handle action updates
    socket.on('action:subscribe', (actionId: string) => {
      socket.join(`action:${actionId}`);
      logger.info(`Client subscribed to action: ${actionId}`);
    });

    socket.on('action:unsubscribe', (actionId: string) => {
      socket.leave(`action:${actionId}`);
      logger.info(`Client unsubscribed from action: ${actionId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): Server | null {
  return io;
}

/**
 * Emit event to specific user
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) {
    logger.warn('WebSocket server not initialized');
    return;
  }

  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`Emitted ${event} to user ${userId}`);
}

/**
 * Emit event to specific action
 */
export function emitToAction(actionId: string, event: string, data: any): void {
  if (!io) {
    logger.warn('WebSocket server not initialized');
    return;
  }

  io.to(`action:${actionId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`Emitted ${event} to action ${actionId}`);
}

/**
 * Broadcast to all connected clients
 */
export function broadcast(event: string, data: any): void {
  if (!io) {
    logger.warn('WebSocket server not initialized');
    return;
  }

  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`Broadcasted ${event} to all clients`);
}

/**
 * Send chat response in real-time
 */
export function sendChatResponse(
  userId: string,
  messageId: string,
  chunk: string,
  isComplete: boolean = false
): void {
  emitToUser(userId, 'chat:response', {
    messageId,
    chunk,
    isComplete,
  });
}

/**
 * Send action status update
 */
export function sendActionUpdate(
  actionId: string,
  status: string,
  progress?: number,
  message?: string
): void {
  emitToAction(actionId, 'action:update', {
    actionId,
    status,
    progress,
    message,
  });
}

/**
 * Send sync progress update
 */
export function sendSyncProgress(
  userId: string,
  syncType: string,
  progress: number,
  message?: string
): void {
  emitToUser(userId, 'sync:progress', {
    syncType,
    progress,
    message,
  });
}
