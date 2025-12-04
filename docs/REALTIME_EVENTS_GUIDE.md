# LifeOS Real-Time Event System - Integration Guide

## Overview

The LifeOS Real-Time Event System provides WebSocket and Server-Sent Events (SSE) for pushing updates to clients in real-time.

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client 1   │────▶│  Instance 1 │────▶│             │
└─────────────┘     └─────────────┘     │             │
                                        │    Redis    │
┌─────────────┐     ┌─────────────┐     │   Pub/Sub   │
│  Client 2   │────▶│  Instance 2 │────▶│             │
└─────────────┘     └─────────────┘     │             │
                                        └─────────────┘
```

**Key Components**:
- **EventDispatcher**: Publishes events to Redis
- **ConnectionManager**: Manages WebSocket/SSE connections
- **Redis Pub/Sub**: Distributes events across instances
- **EventServer**: WebSocket server with JWT auth
- **SSEHandler**: SSE fallback for older browsers

---

## Event Types

| Event Type | Description | Use Case |
|------------|-------------|----------|
| `SYNC_UPDATE` | Data sync progress | Show sync status for Gmail/Drive/Calendar |
| `TASK_CREATED` | New task created | Notify user of new task |
| `ACTION_STATUS` | Action execution status | Update action progress |
| `ALERT` | System alert | Critical notifications |
| `PREDICTION_RISK` | AI risk prediction | Proactive warnings |
| `AGENT_PROGRESS` | AI agent progress | Show AI task progress |

---

## Backend Integration

### 1. Setup Event Server

```typescript
import { EventServer } from './events/EventServer';
import { getEventDispatcher } from './events/EventDispatcher';

// In your server.ts
const httpServer = app.listen(8001);
const eventServer = new EventServer(httpServer);

// Store for access
app.set('eventServer', eventServer);
```

### 2. Publish Events

```typescript
import { getEventDispatcher } from './events/EventDispatcher';
import { EventType } from './events/types';

// Get dispatcher
const dispatcher = getEventDispatcher();

// Publish to specific users
await dispatcher.publish(
  EventType.SYNC_UPDATE,
  ['user-123', 'user-456'],
  {
    data: {
      source: 'gmail',
      status: 'progress',
      itemsProcessed: 50,
      totalItems: 100
    }
  }
);

// Broadcast to all users
await dispatcher.broadcast(
  EventType.ALERT,
  {
    data: {
      severity: 'info',
      title: 'System Maintenance',
      message: 'Scheduled maintenance at 2 AM'
    }
  }
);
```

### 3. Example: Sync Status Updates

```typescript
async function syncGmail(userId: string) {
  const dispatcher = getEventDispatcher();
  
  // Start sync
  await dispatcher.publish(EventType.SYNC_UPDATE, [userId], {
    data: {
      source: 'gmail',
      status: 'started',
      itemsProcessed: 0,
      totalItems: 0
    }
  });
  
  try {
    const emails = await fetchEmails();
    
    // Progress update
    for (let i = 0; i < emails.length; i++) {
      await processEmail(emails[i]);
      
      if (i % 10 === 0) {
        await dispatcher.publish(EventType.SYNC_UPDATE, [userId], {
          data: {
            source: 'gmail',
            status: 'progress',
            itemsProcessed: i + 1,
            totalItems: emails.length
          }
        });
      }
    }
    
    // Complete
    await dispatcher.publish(EventType.SYNC_UPDATE, [userId], {
      data: {
        source: 'gmail',
        status: 'completed',
        itemsProcessed: emails.length,
        totalItems: emails.length
      }
    });
    
  } catch (error) {
    // Error
    await dispatcher.publish(EventType.SYNC_UPDATE, [userId], {
      data: {
        source: 'gmail',
        status: 'failed',
        error: error.message
      }
    });
  }
}
```

---

## Frontend Integration

### 1. Include Client Library

```html
<script src="/event-client.js"></script>
```

### 2. Connect to Event Server

```javascript
// Get JWT token from auth
const token = await getAuthToken();

// Create client
const client = new EventClient({
  token: token,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000
});

// Connect
await client.connect();
```

### 3. Listen for Events

```javascript
// Connection events
client.on('connected', (data) => {
  console.log('Connected:', data.transport); // 'websocket' or 'sse'
});

client.on('disconnected', () => {
  console.log('Disconnected');
});

// Event type handlers
client.on('SYNC_UPDATE', (event) => {
  const { source, status, itemsProcessed, totalItems } = event.data;
  
  if (status === 'progress') {
    const percent = (itemsProcessed / totalItems) * 100;
    updateProgressBar(source, percent);
  } else if (status === 'completed') {
    showSuccess(`${source} sync completed`);
  } else if (status === 'failed') {
    showError(`${source} sync failed: ${event.data.error}`);
  }
});

client.on('TASK_CREATED', (event) => {
  const task = event.data;
  showNotification(`New task: ${task.title}`);
  addTaskToUI(task);
});

client.on('ACTION_STATUS', (event) => {
  const { actionId, status, result } = event.data;
  updateActionUI(actionId, status, result);
});

client.on('ALERT', (event) => {
  const { severity, title, message, action } = event.data;
  showAlert(severity, title, message, action);
});

client.on('AGENT_PROGRESS', (event) => {
  const { agentName, progress, message } = event.data;
  updateAgentProgress(agentName, progress, message);
});
```

### 4. React Integration

```typescript
import { useEffect, useState } from 'react';

function useRealtimeEvents(token: string) {
  const [client, setClient] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  
  useEffect(() => {
    const eventClient = new (window as any).EventClient({ token });
    
    eventClient.on('connected', () => setConnected(true));
    eventClient.on('disconnected', () => setConnected(false));
    
    eventClient.on('event', (event: any) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
    });
    
    eventClient.connect();
    setClient(eventClient);
    
    return () => {
      eventClient.disconnect();
    };
  }, [token]);
  
  return { client, connected, events };
}

// Usage
function Dashboard() {
  const { connected, events } = useRealtimeEvents(authToken);
  
  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
```

---

## Deployment

### 1. Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f k8s/event-server-deployment.yaml
kubectl apply -f k8s/event-server-hpa.yaml

# Verify
kubectl get pods -n lifeos -l app=lifeos-event-server
kubectl get svc -n lifeos lifeos-event-server
```

### 2. Environment Variables

```env
# Required
REDIS_HOST=redis-service
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
AUTH0_CLIENT_SECRET=your-auth0-secret

# Optional
NODE_ENV=production
PORT=8001
```

### 3. Scaling

The system automatically scales with HPA:
- Min: 2 replicas
- Max: 10 replicas
- Scales on CPU (70%) and Memory (80%)

---

## Testing

### 1. Run Tests

```bash
cd /app/backend
npm test tests/events.test.ts
```

### 2. Test with Demo Page

Open `/event-demo.html?token=YOUR_JWT_TOKEN` in browser.

### 3. Manual Testing

```bash
# Publish test event
curl -X POST http://localhost:8001/events/publish \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "SYNC_UPDATE",
    "userIds": ["user-123"],
    "payload": {
      "data": {
        "source": "gmail",
        "status": "completed"
      }
    }
  }'
```

---

## Performance & Limits

- **Rate Limiting**: 10 events/second per connection (burst: 20)
- **Backpressure**: Automatic throttling when overwhelmed
- **Reconnection**: Exponential backoff (1s → 30s max)
- **Connection Timeout**: 5 minutes idle
- **Max Connections**: Limited by HPA (scales automatically)

---

## Troubleshooting

### WebSocket Connection Fails

```javascript
// Check token
console.log('Token:', token);

// Check WebSocket support
if (typeof WebSocket === 'undefined') {
  console.log('WebSocket not supported, will use SSE');
}
```

### Events Not Received

1. Check connection status
2. Verify user ID in event matches
3. Check Redis connection
4. Review backend logs

### High Latency

1. Check Redis performance
2. Monitor instance CPU/memory
3. Verify network latency
4. Consider regional deployments

---

## Security

- **JWT Authentication**: All connections require valid JWT
- **User Isolation**: Events only sent to authorized users
- **Rate Limiting**: Prevents abuse
- **TLS**: Use WSS in production

---

## Best Practices

1. **Batch Updates**: Don't send every single item, batch progress updates
2. **Meaningful Events**: Only send events that require UI updates
3. **Error Handling**: Always handle connection errors
4. **Reconnection**: Use exponential backoff
5. **Cleanup**: Disconnect on component unmount

---

**Questions? Issues?**
Contact: realtime@lifeos.io
