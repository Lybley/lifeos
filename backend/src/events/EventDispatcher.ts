/**
 * Event Dispatcher Service
 * 
 * Publishes events to Redis Pub/Sub for distribution across multiple instances
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { Event, EventType, BaseEvent } from './types';

export class EventDispatcher {
  private redisPublisher: Redis;
  private instanceId: string;
  
  constructor() {
    this.redisPublisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    this.instanceId = `instance-${uuidv4().slice(0, 8)}`;
    
    this.redisPublisher.on('error', (error) => {
      logger.error('Redis publisher error', { error, instanceId: this.instanceId });
    });
    
    this.redisPublisher.on('connect', () => {
      logger.info('Event dispatcher connected to Redis', { instanceId: this.instanceId });
    });
  }
  
  /**
   * Publish event to specific users
   */
  async publish(
    eventType: EventType,
    userIds: string[],
    payload: Omit<Event, 'id' | 'timestamp' | 'userId' | 'type'>
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Publish to each user's channel
      const publishPromises = userIds.map(async (userId) => {
        const event: BaseEvent & { data: any } = {
          id: uuidv4(),
          type: eventType,
          timestamp,
          userId,
          ...payload
        };
        
        const channel = `user:${userId}`;
        
        await this.redisPublisher.publish(
          channel,
          JSON.stringify(event)
        );
        
        logger.debug('Event published', {
          eventId: event.id,
          eventType,
          userId,
          channel,
          instanceId: this.instanceId
        });
      });
      
      await Promise.all(publishPromises);
      
      logger.info('Event dispatched to users', {
        eventType,
        userCount: userIds.length,
        instanceId: this.instanceId
      });
      
    } catch (error) {
      logger.error('Failed to publish event', {
        error,
        eventType,
        userIds,
        instanceId: this.instanceId
      });
      throw error;
    }
  }
  
  /**
   * Broadcast event to all connected users
   */
  async broadcast(
    eventType: EventType,
    payload: Omit<Event, 'id' | 'timestamp' | 'userId' | 'type'>
  ): Promise<void> {
    try {
      const event = {
        id: uuidv4(),
        type: eventType,
        timestamp: Date.now(),
        userId: '*', // Broadcast indicator
        ...payload
      };
      
      await this.redisPublisher.publish(
        'broadcast',
        JSON.stringify(event)
      );
      
      logger.info('Event broadcasted', {
        eventId: event.id,
        eventType,
        instanceId: this.instanceId
      });
      
    } catch (error) {
      logger.error('Failed to broadcast event', { error, eventType });
      throw error;
    }
  }
  
  /**
   * Publish to specific channel
   */
  async publishToChannel(channel: string, event: any): Promise<void> {
    try {
      await this.redisPublisher.publish(channel, JSON.stringify(event));
      
      logger.debug('Event published to channel', {
        channel,
        eventType: event.type,
        instanceId: this.instanceId
      });
      
    } catch (error) {
      logger.error('Failed to publish to channel', { error, channel });
      throw error;
    }
  }
  
  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }
  
  /**
   * Cleanup
   */
  async disconnect(): Promise<void> {
    await this.redisPublisher.quit();
    logger.info('Event dispatcher disconnected', { instanceId: this.instanceId });
  }
}

// Singleton instance
let dispatcherInstance: EventDispatcher | null = null;

export function getEventDispatcher(): EventDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new EventDispatcher();
  }
  return dispatcherInstance;
}

export default EventDispatcher;
