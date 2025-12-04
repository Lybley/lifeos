/**
 * Connection Manager
 * 
 * Manages WebSocket and SSE connections with rate limiting and backpressure
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { ConnectionMetadata, ServerMessage } from './types';

interface RateLimitConfig {
  maxEventsPerSecond: number;
  burstSize: number;
}

export class ConnectionManager extends EventEmitter {
  private connections: Map<string, ConnectionMetadata>;
  private redisSubscriber: Redis;
  private subscribedChannels: Set<string>;
  private rateLimits: Map<string, { tokens: number; lastRefill: number }>;
  private rateLimitConfig: RateLimitConfig;
  
  constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
    super();
    
    this.connections = new Map();
    this.subscribedChannels = new Set();
    this.rateLimits = new Map();
    
    this.rateLimitConfig = {
      maxEventsPerSecond: rateLimitConfig?.maxEventsPerSecond || 10,
      burstSize: rateLimitConfig?.burstSize || 20
    };
    
    // Redis subscriber for receiving events
    this.redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    this.setupRedisSubscriber();
    
    // Periodic cleanup
    setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
    setInterval(() => this.refillTokenBuckets(), 100); // Every 100ms
  }
  
  /**
   * Setup Redis subscriber to receive events
   */
  private setupRedisSubscriber(): void {
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      try {
        const event = JSON.parse(message);
        this.handleIncomingEvent(channel, event);
      } catch (error) {
        logger.error('Failed to parse Redis message', { error, channel, message });
      }
    });
    
    this.redisSubscriber.on('error', (error) => {
      logger.error('Redis subscriber error', { error });
    });
    
    this.redisSubscriber.on('connect', () => {
      logger.info('Connection manager connected to Redis');
    });
    
    // Subscribe to broadcast channel
    this.subscribeToChannel('broadcast');
  }
  
  /**
   * Handle incoming event from Redis
   */
  private handleIncomingEvent(channel: string, event: any): void {
    // Check if broadcast
    if (channel === 'broadcast') {
      this.broadcastToAll(event);
      return;
    }
    
    // Extract userId from channel (format: user:userId)
    const userId = channel.split(':')[1];
    if (!userId) return;
    
    // Send to all connections for this user
    this.sendToUser(userId, event);
  }
  
  /**
   * Add new connection
   */
  addConnection(connectionId: string, metadata: ConnectionMetadata): void {
    this.connections.set(connectionId, metadata);
    
    // Subscribe to user's channel
    const userChannel = `user:${metadata.userId}`;
    this.subscribeToChannel(userChannel);
    
    // Initialize rate limit
    this.rateLimits.set(connectionId, {
      tokens: this.rateLimitConfig.burstSize,
      lastRefill: Date.now()
    });
    
    logger.info('Connection added', {
      connectionId,
      userId: metadata.userId,
      transport: metadata.transport,
      totalConnections: this.connections.size
    });
  }
  
  /**
   * Remove connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    this.connections.delete(connectionId);
    this.rateLimits.delete(connectionId);
    
    // Check if any other connections for this user
    const hasOtherConnections = Array.from(this.connections.values())
      .some(conn => conn.userId === connection.userId);
    
    // Unsubscribe from user channel if no other connections
    if (!hasOtherConnections) {
      const userChannel = `user:${connection.userId}`;
      this.unsubscribeFromChannel(userChannel);
    }
    
    logger.info('Connection removed', {
      connectionId,
      userId: connection.userId,
      totalConnections: this.connections.size
    });
  }
  
  /**
   * Subscribe to additional channels for a connection
   */
  addChannels(connectionId: string, channels: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    channels.forEach(channel => {
      connection.channels.add(channel);
      this.subscribeToChannel(channel);
    });
    
    logger.debug('Channels added to connection', {
      connectionId,
      channels,
      totalChannels: connection.channels.size
    });
  }
  
  /**
   * Unsubscribe from channels
   */
  removeChannels(connectionId: string, channels: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    channels.forEach(channel => {
      connection.channels.delete(channel);
      
      // Check if any other connection uses this channel
      const channelInUse = Array.from(this.connections.values())
        .some(conn => conn.channels.has(channel));
      
      if (!channelInUse) {
        this.unsubscribeFromChannel(channel);
      }
    });
  }
  
  /**
   * Send event to specific user
   */
  private sendToUser(userId: string, event: any): void {
    const userConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.userId === userId);
    
    userConnections.forEach(([connectionId, _]) => {
      this.sendToConnection(connectionId, event);
    });
  }
  
  /**
   * Broadcast to all connections
   */
  private broadcastToAll(event: any): void {
    this.connections.forEach((_, connectionId) => {
      this.sendToConnection(connectionId, event);
    });
  }
  
  /**
   * Send event to specific connection with rate limiting
   */
  sendToConnection(connectionId: string, event: any): boolean {
    // Check rate limit
    if (!this.checkRateLimit(connectionId)) {
      logger.warn('Rate limit exceeded', { connectionId });
      return false;
    }
    
    // Emit event for the connection handler to send
    this.emit('message', connectionId, event);
    
    return true;
  }
  
  /**
   * Check rate limit using token bucket algorithm
   */
  private checkRateLimit(connectionId: string): boolean {
    const limit = this.rateLimits.get(connectionId);
    if (!limit) return true;
    
    if (limit.tokens > 0) {
      limit.tokens--;
      return true;
    }
    
    return false;
  }
  
  /**
   * Refill token buckets
   */
  private refillTokenBuckets(): void {
    const now = Date.now();
    const refillAmount = this.rateLimitConfig.maxEventsPerSecond / 10; // Per 100ms
    
    this.rateLimits.forEach((limit, connectionId) => {
      const elapsed = now - limit.lastRefill;
      if (elapsed >= 100) {
        limit.tokens = Math.min(
          limit.tokens + refillAmount,
          this.rateLimitConfig.burstSize
        );
        limit.lastRefill = now;
      }
    });
  }
  
  /**
   * Subscribe to Redis channel
   */
  private subscribeToChannel(channel: string): void {
    if (this.subscribedChannels.has(channel)) return;
    
    this.redisSubscriber.subscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to subscribe to channel', { error: err, channel });
      } else {
        this.subscribedChannels.add(channel);
        logger.debug('Subscribed to channel', { channel });
      }
    });
  }
  
  /**
   * Unsubscribe from Redis channel
   */
  private unsubscribeFromChannel(channel: string): void {
    if (!this.subscribedChannels.has(channel)) return;
    
    this.redisSubscriber.unsubscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to unsubscribe from channel', { error: err, channel });
      } else {
        this.subscribedChannels.delete(channel);
        logger.debug('Unsubscribed from channel', { channel });
      }
    });
  }
  
  /**
   * Cleanup stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    const staleConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => now - conn.connectedAt > staleThreshold);
    
    if (staleConnections.length > 0) {
      logger.info('Cleaning up stale connections', {
        count: staleConnections.length
      });
      
      staleConnections.forEach(([connectionId, _]) => {
        this.removeConnection(connectionId);
      });
    }
  }
  
  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  /**
   * Get user count
   */
  getUserCount(): number {
    const uniqueUsers = new Set(
      Array.from(this.connections.values()).map(conn => conn.userId)
    );
    return uniqueUsers.size;
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.getUserCount(),
      subscribedChannels: this.subscribedChannels.size,
      connectionsByTransport: {
        websocket: Array.from(this.connections.values())
          .filter(conn => conn.transport === 'websocket').length,
        sse: Array.from(this.connections.values())
          .filter(conn => conn.transport === 'sse').length
      }
    };
  }
  
  /**
   * Cleanup
   */
  async disconnect(): Promise<void> {
    await this.redisSubscriber.quit();
    this.connections.clear();
    this.rateLimits.clear();
    this.subscribedChannels.clear();
    logger.info('Connection manager disconnected');
  }
}

export default ConnectionManager;
