/**
 * Real-Time Events Tests
 * 
 * Tests proving events flow across two backend instances via Redis
 */

import { expect } from 'chai';
import Redis from 'ioredis';
import { EventDispatcher } from '../src/events/EventDispatcher';
import ConnectionManager from '../src/events/ConnectionManager';
import { EventType } from '../src/events/types';

describe('Real-Time Event System', () => {
  let redisClient: Redis;
  let dispatcher1: EventDispatcher;
  let dispatcher2: EventDispatcher;
  let connectionManager1: ConnectionManager;
  let connectionManager2: ConnectionManager;
  
  before(async () => {
    // Setup Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
    
    await redisClient.ping();
  });
  
  beforeEach(() => {
    // Create two instances (simulating two backend servers)
    dispatcher1 = new EventDispatcher();
    dispatcher2 = new EventDispatcher();
    
    connectionManager1 = new ConnectionManager();
    connectionManager2 = new ConnectionManager();
  });
  
  afterEach(async () => {
    // Cleanup
    await dispatcher1.disconnect();
    await dispatcher2.disconnect();
    await connectionManager1.disconnect();
    await connectionManager2.disconnect();
  });
  
  after(async () => {
    await redisClient.quit();
  });
  
  describe('Event Dispatcher', () => {
    it('should create dispatcher with unique instance ID', () => {
      expect(dispatcher1.getInstanceId()).to.be.a('string');
      expect(dispatcher2.getInstanceId()).to.be.a('string');
      expect(dispatcher1.getInstanceId()).to.not.equal(dispatcher2.getInstanceId());
    });
    
    it('should publish event to specific users', async () => {
      const userId = 'test-user-123';\n      const eventType = EventType.TASK_CREATED;\n      const payload = {\n        data: {\n          taskId: 'task-1',\n          title: 'Test Task',\n          description: 'Test description',\n          priority: 'high' as const\n        }\n      };\n      \n      // Should not throw\n      await dispatcher1.publish(eventType, [userId], payload);\n    });\n    \n    it('should broadcast event to all users', async () => {\n      const eventType = EventType.ALERT;\n      const payload = {\n        data: {\n          severity: 'info' as const,\n          title: 'System Maintenance',\n          message: 'Scheduled maintenance tonight'\n        }\n      };\n      \n      // Should not throw\n      await dispatcher1.broadcast(eventType, payload);\n    });\n  });\n  \n  describe('Cross-Instance Communication', () => {\n    it('should receive events from another instance via Redis Pub/Sub', (done) => {\n      const userId = 'test-user-456';\n      const eventType = EventType.SYNC_UPDATE;\n      \n      // Add connection to instance 2\n      connectionManager2.addConnection('conn-1', {\n        userId,\n        connectionId: 'conn-1',\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'websocket'\n      });\n      \n      // Listen for message on instance 2\n      connectionManager2.once('message', (connectionId, event) => {\n        try {\n          expect(connectionId).to.equal('conn-1');\n          expect(event.type).to.equal(eventType);\n          expect(event.userId).to.equal(userId);\n          expect(event.data.source).to.equal('gmail');\n          done();\n        } catch (error) {\n          done(error);\n        }\n      });\n      \n      // Publish from instance 1 after brief delay\n      setTimeout(async () => {\n        await dispatcher1.publish(eventType, [userId], {\n          data: {\n            source: 'gmail',\n            status: 'progress',\n            itemsProcessed: 10,\n            totalItems: 100\n          }\n        });\n      }, 100);\n    });\n    \n    it('should handle multiple events across instances', (done) => {\n      const userId = 'test-user-789';\n      const receivedEvents: any[] = [];\n      \n      // Add connection to instance 2\n      connectionManager2.addConnection('conn-2', {\n        userId,\n        connectionId: 'conn-2',\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'websocket'\n      });\n      \n      // Listen for messages\n      connectionManager2.on('message', (connectionId, event) => {\n        receivedEvents.push(event);\n        \n        if (receivedEvents.length === 3) {\n          try {\n            expect(receivedEvents).to.have.lengthOf(3);\n            expect(receivedEvents[0].type).to.equal(EventType.SYNC_UPDATE);\n            expect(receivedEvents[1].type).to.equal(EventType.TASK_CREATED);\n            expect(receivedEvents[2].type).to.equal(EventType.ACTION_STATUS);\n            done();\n          } catch (error) {\n            done(error);\n          }\n        }\n      });\n      \n      // Publish multiple events from instance 1\n      setTimeout(async () => {\n        await dispatcher1.publish(EventType.SYNC_UPDATE, [userId], {\n          data: { source: 'gmail', status: 'completed' }\n        });\n        \n        await dispatcher1.publish(EventType.TASK_CREATED, [userId], {\n          data: {\n            taskId: 'task-2',\n            title: 'Test Task 2',\n            description: 'Description',\n            priority: 'medium'\n          }\n        });\n        \n        await dispatcher1.publish(EventType.ACTION_STATUS, [userId], {\n          data: {\n            actionId: 'action-1',\n            actionType: 'send_email',\n            status: 'completed'\n          }\n        });\n      }, 100);\n    });\n  });\n  \n  describe('Connection Manager', () => {\n    it('should manage connections', () => {\n      const userId = 'user-1';\n      \n      connectionManager1.addConnection('conn-1', {\n        userId,\n        connectionId: 'conn-1',\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'websocket'\n      });\n      \n      expect(connectionManager1.getConnectionCount()).to.equal(1);\n      expect(connectionManager1.getUserCount()).to.equal(1);\n      \n      connectionManager1.removeConnection('conn-1');\n      \n      expect(connectionManager1.getConnectionCount()).to.equal(0);\n      expect(connectionManager1.getUserCount()).to.equal(0);\n    });\n    \n    it('should handle multiple connections for same user', () => {\n      const userId = 'user-2';\n      \n      connectionManager1.addConnection('conn-1', {\n        userId,\n        connectionId: 'conn-1',\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'websocket'\n      });\n      \n      connectionManager1.addConnection('conn-2', {\n        userId,\n        connectionId: 'conn-2',\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'sse'\n      });\n      \n      expect(connectionManager1.getConnectionCount()).to.equal(2);\n      expect(connectionManager1.getUserCount()).to.equal(1);\n      \n      const stats = connectionManager1.getStats();\n      expect(stats.connectionsByTransport.websocket).to.equal(1);\n      expect(stats.connectionsByTransport.sse).to.equal(1);\n    });\n    \n    it('should apply rate limiting', (done) => {\n      const userId = 'user-3';\n      const connectionId = 'conn-rate-limit';\n      \n      connectionManager1.addConnection(connectionId, {\n        userId,\n        connectionId,\n        connectedAt: Date.now(),\n        channels: new Set(),\n        transport: 'websocket'\n      });\n      \n      let sentCount = 0;\n      let blockedCount = 0;\n      \n      // Try to send many events rapidly\n      for (let i = 0; i < 30; i++) {\n        const sent = connectionManager1.sendToConnection(connectionId, {\n          type: 'test',\n          data: { index: i }\n        });\n        \n        if (sent) sentCount++;\n        else blockedCount++;\n      }\n      \n      // Should have blocked some due to rate limiting\n      expect(blockedCount).to.be.greaterThan(0);\n      expect(sentCount).to.be.lessThan(30);\n      \n      done();\n    });\n  });\n  \n  describe('Event Types', () => {\n    it('should publish SYNC_UPDATE event', async () => {\n      await dispatcher1.publish(EventType.SYNC_UPDATE, ['user-1'], {\n        data: {\n          source: 'drive',\n          status: 'started',\n          itemsProcessed: 0,\n          totalItems: 50\n        }\n      });\n    });\n    \n    it('should publish TASK_CREATED event', async () => {\n      await dispatcher1.publish(EventType.TASK_CREATED, ['user-1'], {\n        data: {\n          taskId: 'task-123',\n          title: 'Review document',\n          description: 'Review the Q4 report',\n          priority: 'high',\n          dueDate: '2024-12-31'\n        }\n      });\n    });\n    \n    it('should publish ACTION_STATUS event', async () => {\n      await dispatcher1.publish(EventType.ACTION_STATUS, ['user-1'], {\n        data: {\n          actionId: 'action-456',\n          actionType: 'create_event',\n          status: 'executing'\n        }\n      });\n    });\n    \n    it('should publish ALERT event', async () => {\n      await dispatcher1.publish(EventType.ALERT, ['user-1'], {\n        data: {\n          severity: 'warning',\n          title: 'Storage Almost Full',\n          message: 'You have used 90% of your storage',\n          action: {\n            label: 'Upgrade Plan',\n            url: '/settings/billing'\n          }\n        }\n      });\n    });\n    \n    it('should publish PREDICTION_RISK event', async () => {\n      await dispatcher1.publish(EventType.PREDICTION_RISK, ['user-1'], {\n        data: {\n          riskType: 'deadline_miss',\n          riskLevel: 'high',\n          description: 'Project likely to miss deadline',\n          confidence: 0.85,\n          recommendations: [\n            'Schedule additional resources',\n            'Extend deadline',\n            'Reduce scope'\n          ]\n        }\n      });\n    });\n    \n    it('should publish AGENT_PROGRESS event', async () => {\n      await dispatcher1.publish(EventType.AGENT_PROGRESS, ['user-1'], {\n        data: {\n          agentId: 'agent-789',\n          agentName: 'Email Analyzer',\n          step: 'Analyzing sentiment',\n          progress: 65,\n          status: 'running',\n          message: 'Processing 150 of 230 emails'\n        }\n      });\n    });\n  });\n});\n