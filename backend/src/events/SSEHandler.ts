/**
 * Server-Sent Events (SSE) Handler
 * 
 * Fallback for clients that don't support WebSocket
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import ConnectionManager from './ConnectionManager';
import { ConnectionMetadata, ServerMessage } from './types';

interface AuthPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export class SSEHandler {
  private connectionManager: ConnectionManager;
  private connections: Map<string, Response>;
  
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.connections = new Map();
    this.setupMessageHandler();
  }
  
  /**
   * Handle SSE connection
   */
  async handleConnection(req: Request, res: Response): Promise<void> {
    try {
      // Authenticate
      const token = req.query.token as string || 
                   req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }
      
      const user = await this.verifyToken(token);
      
      // Setup SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();
      
      const connectionId = uuidv4();
      
      // Store connection
      this.connections.set(connectionId, res);
      
      // Add to connection manager
      const metadata: ConnectionMetadata = {
        userId: user.sub,
        connectionId,
        connectedAt: Date.now(),
        channels: new Set(),
        transport: 'sse'
      };
      
      this.connectionManager.addConnection(connectionId, metadata);
      
      // Send initial message
      this.sendSSE(res, {
        type: 'subscribed',
        data: {
          connectionId,
          userId: user.sub
        }
      });
      
      // Setup heartbeat
      const heartbeat = setInterval(() => {
        this.sendSSE(res, {
          type: 'pong',
          data: { timestamp: Date.now() }
        });
      }, 30000);
      
      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        this.connectionManager.removeConnection(connectionId);
        this.connections.delete(connectionId);
        logger.info('SSE connection closed', { connectionId });
      });
      
      logger.info('SSE connection established', {
        connectionId,
        userId: user.sub
      });
      
    } catch (error) {
      logger.error('SSE connection failed', { error });
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
  
  /**
   * Setup message handler from connection manager
   */
  private setupMessageHandler(): void {
    this.connectionManager.on('message', (connectionId: string, event: any) => {
      const res = this.connections.get(connectionId);
      if (!res) return;
      
      this.sendSSE(res, {
        type: 'event',
        data: event
      });
    });
  }
  
  /**
   * Send SSE message
   */
  private sendSSE(res: Response, message: ServerMessage): void {
    try {
      const data = JSON.stringify(message);
      res.write(`data: ${data}\n\n`);
    } catch (error) {
      logger.error('Failed to send SSE message', { error });
    }
  }
  
  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<AuthPayload> {
    return new Promise((resolve, reject) => {
      const secret = process.env.JWT_SECRET || process.env.AUTH0_CLIENT_SECRET || 'secret';
      
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(new Error('Invalid token'));
        } else {
          resolve(decoded as AuthPayload);
        }
      });
    });
  }
}

export default SSEHandler;
