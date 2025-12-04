/**
 * Event Server
 * 
 * WebSocket + SSE server with JWT authentication
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import url from 'url';
import logger from '../utils/logger';
import ConnectionManager from './ConnectionManager';
import { ConnectionMetadata, SubscriptionMessage, ServerMessage } from './types';

interface AuthPayload {
  sub: string; // user ID
  email?: string;
  iat?: number;
  exp?: number;
}

export class EventServer {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private httpServer: HttpServer;
  private connections: Map<string, WebSocket>;
  
  constructor(httpServer: HttpServer) {
    this.httpServer = httpServer;
    this.connectionManager = new ConnectionManager({
      maxEventsPerSecond: 10,
      burstSize: 20
    });
    
    this.connections = new Map();
    
    // WebSocket server
    this.wss = new WebSocketServer({ 
      noServer: true,
      perMessageDeflate: false
    });
    
    this.setupWebSocketServer();
    this.setupMessageHandler();
  }
  
  /**
   * Setup WebSocket server
   */
  private setupWebSocketServer(): void {
    // Handle upgrade for /events/subscribe
    this.httpServer.on('upgrade', async (request, socket, head) => {
      const { pathname, query } = url.parse(request.url || '', true);
      
      if (pathname !== '/events/subscribe') {
        socket.destroy();
        return;
      }
      
      try {
        // Authenticate
        const token = query.token as string || 
                     request.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        const user = await this.verifyToken(token);
        
        // Upgrade to WebSocket
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, user);
        });
        
      } catch (error) {
        logger.error('WebSocket upgrade failed', { error });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws: WebSocket, request: any, user: AuthPayload) => {
      this.handleWebSocketConnection(ws, user);
    });
  }
  
  /**
   * Handle WebSocket connection
   */
  private handleWebSocketConnection(ws: WebSocket, user: AuthPayload): void {
    const connectionId = uuidv4();
    
    // Store connection
    this.connections.set(connectionId, ws);
    
    // Add to connection manager
    const metadata: ConnectionMetadata = {
      userId: user.sub,
      connectionId,
      connectedAt: Date.now(),
      channels: new Set(),
      transport: 'websocket'
    };
    
    this.connectionManager.addConnection(connectionId, metadata);
    
    // Send connection established
    this.sendMessage(ws, {
      type: 'subscribed',
      data: {
        connectionId,
        userId: user.sub
      }
    });
    
    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message: SubscriptionMessage = JSON.parse(data.toString());
        this.handleClientMessage(connectionId, message);
      } catch (error) {
        logger.error('Failed to parse client message', { error, connectionId });
      }
    });
    
    // Handle close
    ws.on('close', () => {
      this.connectionManager.removeConnection(connectionId);
      this.connections.delete(connectionId);
      logger.info('WebSocket connection closed', { connectionId });
    });
    
    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, connectionId });
    });
    
    // Setup heartbeat
    this.setupHeartbeat(ws, connectionId);
    
    logger.info('WebSocket connection established', {
      connectionId,
      userId: user.sub
    });
  }
  
  /**
   * Setup message handler from connection manager
   */
  private setupMessageHandler(): void {
    this.connectionManager.on('message', (connectionId: string, event: any) => {
      const ws = this.connections.get(connectionId);
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      this.sendMessage(ws, {
        type: 'event',
        data: event
      });
    });
  }
  
  /**
   * Handle client messages
   */
  private handleClientMessage(connectionId: string, message: SubscriptionMessage): void {
    switch (message.action) {
      case 'subscribe':
        if (message.channels) {
          this.connectionManager.addChannels(connectionId, message.channels);
          const ws = this.connections.get(connectionId);
          if (ws) {
            this.sendMessage(ws, {
              type: 'subscribed',
              data: { channels: message.channels }
            });
          }
        }
        break;
        
      case 'unsubscribe':
        if (message.channels) {
          this.connectionManager.removeChannels(connectionId, message.channels);
          const ws = this.connections.get(connectionId);
          if (ws) {
            this.sendMessage(ws, {
              type: 'unsubscribed',
              data: { channels: message.channels }
            });
          }
        }
        break;
        
      case 'ping':
        const ws = this.connections.get(connectionId);
        if (ws) {
          this.sendMessage(ws, { type: 'pong' });
        }
        break;
    }
  }
  
  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send message', { error });
    }
  }
  
  /**
   * Setup heartbeat to keep connection alive
   */
  private setupHeartbeat(ws: WebSocket, connectionId: string): void {
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }
      
      this.sendMessage(ws, {
        type: 'pong',
        data: { timestamp: Date.now() }
      });
    }, 30000); // Every 30 seconds
    
    ws.on('close', () => clearInterval(interval));
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
  
  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.connectionManager.getStats(),
      wsConnections: this.connections.size
    };
  }
  
  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    // Close all WebSocket connections
    this.connections.forEach((ws) => ws.close());
    this.wss.close();
    
    // Cleanup connection manager
    await this.connectionManager.disconnect();
    
    logger.info('Event server shut down');
  }
}

export default EventServer;
