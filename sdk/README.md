# LifeOS SDK Documentation

## Overview

The LifeOS SDK allows third-party developers to build plugins and agents that integrate with the LifeOS Personal Memory Graph (PMG) platform.

## Features

- 🔐 **OAuth Authentication** - Secure token-based authentication
- 📊 **PMG Node Operations** - Create, read, update, delete nodes with RBAC
- 🤖 **Agent Registration** - Register custom agents with metadata and callbacks
- 📡 **Event System** - Subscribe to and publish platform events
- 🔒 **Security** - Built-in signature verification and rate limiting

---

## Installation

### Node.js

```bash
npm install lifeos-sdk
# or
yarn add lifeos-sdk
```

### Python

```bash
pip install lifeos-sdk
```

---

## Quick Start

### Node.js Example

```javascript
const LifeOSSDK = require('lifeos-sdk');

// Initialize SDK
const sdk = new LifeOSSDK({
  apiUrl: 'http://localhost:8000',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:3001/oauth/callback',
});

// OAuth flow
const authUrl = sdk.getAuthorizationUrl();
console.log('Visit:', authUrl);

// After user authorizes, exchange code for token
await sdk.getAccessToken(authorizationCode);

// Create a node
const node = await sdk.createNode({
  type: 'note',
  content: {
    title: 'My First Note',
    body: 'This is a test note created via SDK',
  },
  tags: ['test', 'sdk'],
});

console.log('Node created:', node.id);
```

### Python Example

```python
from lifeos_sdk import LifeOSSDK

# Initialize SDK
sdk = LifeOSSDK({
    'api_url': 'http://localhost:8000',
    'client_id': 'your-client-id',
    'client_secret': 'your-client-secret',
    'redirect_uri': 'http://localhost:3001/oauth/callback',
})

# OAuth flow
auth_url = sdk.get_authorization_url()
print('Visit:', auth_url)

# After user authorizes, exchange code for token
sdk.get_access_token(authorization_code)

# Create a node
node = sdk.create_node({
    'type': 'note',
    'content': {
        'title': 'My First Note',
        'body': 'This is a test note created via SDK',
    },
    'tags': ['test', 'sdk'],
})

print('Node created:', node['id'])
```

---

## API Reference

### Authentication

#### `getAuthorizationUrl(state?: string): string`
Get OAuth authorization URL for user to visit.

#### `getAccessToken(code: string): Promise<TokenResponse>`
Exchange authorization code for access token.

#### `refreshAccessToken(): Promise<TokenResponse>`
Refresh expired access token.

#### `setTokens(accessToken: string, refreshToken?: string): void`
Manually set access and refresh tokens.

---

### PMG Node Operations

#### `createNode(node: NodeData): Promise<Node>`
Create a new PMG node.

**Parameters:**
```typescript
interface NodeData {
  type: string;           // 'note', 'task', 'document', 'event', etc.
  content: object;        // Node-specific content
  metadata?: object;      // Additional metadata
  tags?: string[];        // Tags for categorization
}
```

**Example:**
```javascript
const taskNode = await sdk.createNode({
  type: 'task',
  content: {
    title: 'Review PR #123',
    description: 'Code review for new feature',
    priority: 'high',
    deadline: '2025-12-10T17:00:00Z',
  },
  tags: ['code-review', 'urgent'],
});
```

#### `getNode(nodeId: string): Promise<Node>`
Retrieve a node by ID.

#### `updateNode(nodeId: string, updates: Partial<NodeData>): Promise<Node>`
Update an existing node.

#### `deleteNode(nodeId: string): Promise<DeleteResponse>`
Delete a node.

#### `queryNodes(query: QueryParams): Promise<Node[]>`
Query nodes with filters.

**Parameters:**
```typescript
interface QueryParams {
  type?: string;          // Filter by node type
  tags?: string[];        // Filter by tags
  fromDate?: Date;        // Date range start
  toDate?: Date;          // Date range end
  limit?: number;         // Result limit (default: 100)
}
```

#### `createRelationship(sourceId: string, targetId: string, type: string): Promise<Relationship>`
Create a relationship between two nodes.

**Example:**
```javascript
// Link a task to its source document
await sdk.createRelationship(
  taskNode.id,
  documentNode.id,
  'derived_from'
);
```

---

### Agent Registration

#### `registerAgent(agent: AgentConfig): Promise<Agent>`
Register a new agent.

**Parameters:**
```typescript
interface AgentConfig {
  name: string;                    // Agent name
  description: string;             // Agent description
  version: string;                 // Semantic version
  capabilities: string[];          // List of capabilities
  endpoints: {
    webhook: string;               // Webhook URL for events
    health: string;                // Health check URL
  };
  metadata?: object;               // Additional metadata
}
```

**Example:**
```javascript
const agent = await sdk.registerAgent({
  name: 'Task Manager',
  description: 'Automatically manages tasks',
  version: '1.0.0',
  capabilities: ['task-extraction', 'task-organization'],
  endpoints: {
    webhook: 'http://localhost:3001/webhook',
    health: 'http://localhost:3001/health',
  },
});
```

#### `updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<Agent>`
Update agent configuration.

#### `unregisterAgent(agentId: string): Promise<void>`
Unregister an agent.

#### `subscribeToEvents(agentId: string, eventTypes: string[]): Promise<Subscription>`
Subscribe to specific event types.

**Example:**
```javascript
await sdk.subscribeToEvents(agent.id, [
  'task-extracted',
  'note-created',
  'document-uploaded',
]);
```

---

### Event Handling

#### `sendEvent(event: Event): Promise<EventResponse>`
Send an event to the platform.

**Parameters:**
```typescript
interface Event {
  type: string;           // Event type
  payload: object;        // Event data
  userId: string;         // User ID
}
```

#### `sendTestEvent(agentId: string, event: TestEvent): Promise<EventResponse>`
Send a test event for debugging.

#### `verifyWebhookSignature(payload: string, signature: string, secret: string): boolean`
Verify webhook signature for security.

**Example:**
```javascript
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-lifeos-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!sdk.verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process event
  const event = req.body;
  // ...
});
```

---

## Examples

### Complete Plugin Example

See `/app/sdk/examples/task-manager-plugin.js` for a complete example of:
- Agent registration
- Event subscription
- Webhook handling
- PMG node operations

### Running the Example

```bash
# Set environment variables
export LIFEOS_CLIENT_ID=your-client-id
export LIFEOS_CLIENT_SECRET=your-client-secret
export WEBHOOK_SECRET=your-webhook-secret

# Run the plugin
node examples/task-manager-plugin.js
```

---

## Security

### Best Practices

1. **Never hardcode credentials**
   ```javascript
   // ❌ Bad
   const sdk = new LifeOSSDK({
     clientSecret: 'abc123...',
   });
   
   // ✅ Good
   const sdk = new LifeOSSDK({
     clientSecret: process.env.LIFEOS_CLIENT_SECRET,
   });
   ```

2. **Always verify webhook signatures**
   ```javascript
   if (!sdk.verifyWebhookSignature(payload, signature, secret)) {
     return res.status(401).send('Invalid signature');
   }
   ```

3. **Use HTTPS in production**
   ```javascript
   const sdk = new LifeOSSDK({
     apiUrl: 'https://api.lifeos.com', // Not http://
   });
   ```

4. **Handle token refresh automatically**
   The SDK handles token refresh automatically when a 401 response is received.

5. **Implement rate limiting**
   Respect the platform's rate limits (see SDK responses for rate limit headers).

### Sandboxing

For production deployments, plugins should run in isolated environments:
- **Docker containers** (recommended)
- **WASM sandboxes** (lightweight alternative)
- **Kubernetes pods** with security policies

See [SECURITY_GUIDELINES.md](./SECURITY_GUIDELINES.md) for detailed security recommendations.

---

## Error Handling

```javascript
try {
  const node = await sdk.createNode(nodeData);
} catch (error) {
  if (error.message.includes('401')) {
    // Token expired, refresh
    await sdk.refreshAccessToken();
    // Retry
  } else if (error.message.includes('429')) {
    // Rate limited
    console.error('Rate limit exceeded, waiting...');
    await delay(60000); // Wait 1 minute
  } else {
    console.error('Failed to create node:', error);
  }
}
```

---

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

---

## Support

- **Documentation:** https://docs.lifeos.io/sdk
- **API Reference:** https://api.lifeos.io/docs
- **GitHub:** https://github.com/lifeos/sdk
- **Discord:** https://discord.gg/lifeos

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Changelog

### v1.0.0 (2025-12-01)
- Initial release
- OAuth authentication
- PMG node operations
- Agent registration
- Event system
- Security features
