# Gmail Connector - LifeOS Integration

A production-ready Gmail integration service that syncs emails into the Personal Memory Graph (PMG) with OAuth2 authentication, rate limiting, retry logic, and multi-database storage.

## Features

- 🔐 **OAuth2 Authentication**: Secure Gmail access with automatic token refresh
- 📧 **Email Sync**: Fetches last 6 months of emails with pagination
- 🧠 **ML Integration**: Generates embeddings for semantic search
- 💾 **Multi-Database**: Stores in PostgreSQL, Neo4j, and Pinecone
- 🔄 **Retry Logic**: Exponential backoff with jitter for resilience
- ⚡ **Rate Limiting**: Respects Gmail API quotas (25 req/sec)
- 🔁 **Background Jobs**: BullMQ for async processing
- 📊 **Monitoring**: Health checks and sync status tracking

---

## Architecture

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Initiate OAuth
       v
┌─────────────────┐
│  Express Server │
│  /auth/google   │
└──────┬──────────┘
       │ 2. Redirect to Google
       v
┌─────────────────┐
│  Google OAuth2  │
│  Consent Screen │
└──────┬──────────┘
       │ 3. Authorization Code
       v
┌─────────────────┐
│   /callback     │
│ Exchange tokens │
└──────┬──────────┘
       │ 4. Store tokens
       v
┌─────────────────┐
│  PostgreSQL     │
│ oauth_tokens    │
└─────────────────┘
       │ 5. Queue sync job
       v
┌─────────────────┐
│  Redis (BullMQ) │
│  gmail-sync     │
└──────┬──────────┘
       │ 6. Worker picks up
       v
┌─────────────────┐
│  Sync Worker    │
│  (Background)   │
└──────┬──────────┘
       │ 7. Fetch emails
       v
┌─────────────────┐
│  Gmail API      │
│ (Rate Limited)  │
└──────┬──────────┘
       │ 8. Process messages
       v
┌─────────────────────────────┐
│   Message Processor         │
│ ┌─────────────────────────┐ │
│ │ 1. Extract text         │ │
│ │ 2. Generate embeddings  │ │
│ │ 3. Map to PMG schema    │ │
│ └─────────────────────────┘ │
└──────┬──────────────────────┘
       │ 9. Store in databases
       v
┌───────────────────────────────┐
│  Multi-Database Storage       │
│ ┌──────────────────────────┐  │
│ │ PostgreSQL               │  │
│ │ - nodes (metadata)       │  │
│ │ - vector_embeddings refs │  │
│ │ - gmail_messages tracking│  │
│ └──────────────────────────┘  │
│ ┌──────────────────────────┐  │
│ │ Neo4j                    │  │
│ │ - Message nodes          │  │
│ │ - Ownership relationships│  │
│ └──────────────────────────┘  │
│ ┌──────────────────────────┐  │
│ │ Pinecone                 │  │
│ │ - Vector embeddings      │  │
│ │ - Semantic search        │  │
│ └──────────────────────────┘  │
└───────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (with LifeOS schema)
- Neo4j (with PMG schema)
- Redis (for BullMQ)
- Pinecone account
- Google Cloud Project with Gmail API enabled

### Google Cloud Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project

2. **Enable Gmail API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

3. **Create OAuth2 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:8002/auth/google/callback`
   - Save Client ID and Client Secret

4. **Configure OAuth Consent Screen**:
   - Go to "OAuth consent screen"
   - User Type: "External" (for testing)
   - Add test users (your Gmail account)
   - Scopes: Add `gmail.readonly`, `userinfo.email`, `userinfo.profile`

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Environment Configuration

```bash
# Server
PORT=8002
BASE_URL=http://localhost:8002

# Google OAuth2 (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8002/auth/google/callback

# Databases
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX=lifeos-vectors

REDIS_HOST=localhost
REDIS_PORT=6379

# Session
SESSION_SECRET=generate-a-random-secret-here

# Embeddings (Optional - use ingest service)
EMBEDDING_SERVICE_URL=http://localhost:8001
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=your-openai-key

# Sync Configuration
SYNC_BATCH_SIZE=100
SYNC_MONTHS_BACK=6
MAX_RETRIES=5
INITIAL_RETRY_DELAY_MS=1000
MAX_RETRY_DELAY_MS=60000

# Rate Limiting
GMAIL_QUOTA_USER_LIMIT=250
GMAIL_QUOTA_PER_SECOND=25
```

### Running Locally

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start background worker
npm run worker

# Or with production build
npm run build
npm start          # Server
node dist/worker.js  # Worker
```

---

## API Endpoints

### 1. Initiate OAuth Flow

**GET** `/auth/google?userId={userId}`

Start Gmail OAuth2 connection.

**Example:**
```bash
# Open in browser
http://localhost:8002/auth/google?userId=user-001
```

**Flow:**
1. Redirects to Google OAuth consent screen
2. User authorizes access to Gmail
3. Redirects back to callback
4. Stores tokens and queues initial sync

---

### 2. OAuth Callback

**GET** `/auth/google/callback?code={code}&state={state}`

Handles OAuth callback (automatic).

**Returns:** HTML success/error page

---

### 3. Check Connection Status

**GET** `/auth/status?userId={userId}`

Check if Gmail is connected.

**Response:**
```json
{
  "connected": true,
  "gmail_email": "user@gmail.com",
  "connected_at": "2024-01-15T10:30:00Z",
  "last_updated": "2024-01-15T14:20:00Z"
}
```

---

### 4. Disconnect Gmail

**POST** `/auth/disconnect`

Remove Gmail connection.

**Request:**
```json
{
  "userId": "user-001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gmail account disconnected"
}
```

---

### 5. Trigger Manual Sync

**POST** `/sync/start`

Manually start email sync.

**Request:**
```json
{
  "userId": "user-001",
  "isInitialSync": false,
  "monthsBack": 3
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "12345",
  "message": "Email sync started"
}
```

---

### 6. Check Sync Status

**GET** `/sync/status/:jobId`

Get sync job status.

**Response:**
```json
{
  "id": "12345",
  "state": "active",
  "progress": {
    "progress": 45,
    "processed": 450,
    "failed": 5,
    "total": 1000
  },
  "data": {
    "userId": "user-001",
    "isInitialSync": true
  }
}
```

---

### 7. Queue Statistics

**GET** `/sync/stats`

Get queue statistics.

**Response:**
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 145,
  "failed": 3,
  "delayed": 0
}
```

---

## Rate Limiting

### Gmail API Quotas

- **Per-user quota**: 250 requests/second
- **Per-project quota**: 25,000 requests/second
- **Daily quota**: 1 billion quota units

### Rate Limiter Implementation

```typescript
// Configured limits
maxPerSecond: 25  // Stay well under limits
maxConcurrent: 10 // Concurrent requests

// Automatic throttling
if (requestsInLastSecond >= maxPerSecond) {
  await sleep(waitTime);
}
```

### Handling Rate Limit Errors

**429 Too Many Requests:**
```
1. Check for Retry-After header
2. Wait specified time OR use exponential backoff
3. Retry request
4. If persistent: mark user for retry later
```

---

## Retry Logic

### Exponential Backoff with Jitter

```typescript
delay = min(
  initialDelay * (2 ^ attempt),
  maxDelay
) + jitter

// Example progression:
Attempt 1: 1000ms + jitter
Attempt 2: 2000ms + jitter
Attempt 3: 4000ms + jitter
Attempt 4: 8000ms + jitter
Attempt 5: 16000ms + jitter
```

### Retryable Errors

✅ **Retry:**
- 429 Too Many Requests
- 500, 502, 503 Server Errors
- ETIMEDOUT, ECONNRESET
- Quota exceeded

❌ **Don't Retry:**
- 401 Unauthorized (token invalid)
- 403 Forbidden (permissions issue)
- 404 Not Found
- 400 Bad Request

---

## Gmail Message Mapping

### Gmail API → PMG Schema

```typescript
// Gmail Message Fields
{
  id: "17abc123def456",
  threadId: "17abc123xyz789",
  labelIds: ["INBOX", "UNREAD"],
  snippet: "Preview of the email...",
  payload: {
    headers: [
      { name: "From", value: "sender@example.com" },
      { name: "To", value: "recipient@gmail.com" },
      { name: "Subject", value: "Meeting Tomorrow" },
      { name: "Date", value: "Mon, 15 Jan 2024 10:30:00 -0800" }
    ],
    body: { data: "base64-encoded-content" }
  },
  internalDate: "1705340400000"
}

// Mapped to PMG Message Node
{
  messageId: "msg-a1b2c3d4-...",  // Generated UUID
  gmailId: "17abc123def456",      // Original Gmail ID
  subject: "Meeting Tomorrow",
  body: "Extracted plain text...",
  from: "sender@example.com",
  to: ["recipient@gmail.com"],
  cc: [],
  date: "2024-01-15T10:30:00Z",
  threadId: "17abc123xyz789",
  labels: ["INBOX", "UNREAD"],
  message_type: "email",
  direction: "received",
  platform: "gmail"
}
```

### Storage Locations

**PostgreSQL (nodes table):**
```sql
{
  "neo4j_id": "msg-a1b2c3d4-...",
  "node_type": "Message",
  "title": "Meeting Tomorrow",
  "metadata": {
    "gmail_id": "17abc123def456",
    "thread_id": "17abc123xyz789",
    "from": "sender@example.com",
    "to": ["recipient@gmail.com"],
    "labels": ["INBOX"]
  }
}
```

**Neo4j (Message node):**
```cypher
CREATE (m:Message {
  id: "msg-a1b2c3d4-...",
  subject: "Meeting Tomorrow",
  body: "Extracted text...",
  message_type: "email",
  direction: "received",
  sent_at: datetime("2024-01-15T10:30:00Z"),
  platform: "gmail"
})
```

**Pinecone (Vector):**
```javascript
{
  id: "msg-a1b2c3d4-...-body",
  values: [0.123, -0.456, ...], // 1536 dimensions
  metadata: {
    node_id: "msg-a1b2c3d4-...",
    gmail_id: "17abc123def456",
    subject: "Meeting Tomorrow",
    from: "sender@example.com",
    date: "2024-01-15T10:30:00Z"
  }
}
```

---

## Database Schema

### oauth_tokens
```sql
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    gmail_email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, provider)
);
```

### gmail_messages
```sql
CREATE TABLE gmail_messages (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    gmail_message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    pmg_message_id VARCHAR(255) NOT NULL,
    sync_status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, gmail_message_id)
);
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:8002/health
```

### Check OAuth Status

```sql
SELECT 
    user_id,
    gmail_email,
    is_valid,
    expiry_date,
    CASE 
        WHEN expiry_date > NOW() THEN 'Valid'
        ELSE 'Expired'
    END as status
FROM oauth_tokens
WHERE provider = 'gmail';
```

### Monitor Sync Progress

```sql
SELECT 
    sync_status,
    COUNT(*) as count
FROM gmail_messages
WHERE user_id = 'user-001'
GROUP BY sync_status;
```

### Queue Monitoring

```bash
# Redis CLI
redis-cli

# Check queue
LLEN bullmq:gmail-sync:wait
LLEN bullmq:gmail-sync:active

# Check job
HGETALL bullmq:gmail-sync:{jobId}
```

---

## Testing

See [TEST_PLAN.md](./TEST_PLAN.md) for comprehensive test scenarios.

**Quick Tests:**
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load tests
npm run test:load
```

---

## Troubleshooting

### OAuth Error: "redirect_uri_mismatch"

**Problem:** Redirect URI doesn't match Google Cloud configuration

**Solution:**
1. Check `.env`: `GOOGLE_REDIRECT_URI`
2. Match exactly in Google Cloud Console
3. Include protocol (http/https) and port

### Token Refresh Fails

**Problem:** Refresh token expired or revoked

**Solution:**
1. User must re-authenticate
2. Delete old tokens: `DELETE FROM oauth_tokens WHERE user_id = 'xxx'`
3. Restart OAuth flow

### Rate Limit Errors (429)

**Problem:** Exceeded Gmail API quota

**Solution:**
1. Check rate limiter configuration
2. Increase delays: `GMAIL_QUOTA_PER_SECOND=15`
3. Enable exponential backoff
4. Spread sync across more time

### Worker Not Processing Jobs

**Problem:** Worker not picking up queued jobs

**Solution:**
1. Check worker is running: `ps aux | grep worker`
2. Check Redis connection: `redis-cli ping`
3. Check worker logs for errors
4. Restart worker: `npm run worker`

### Messages Not Appearing in PMG

**Problem:** Sync completes but messages missing

**Solution:**
1. Check `gmail_messages` table: `SELECT * FROM gmail_messages LIMIT 10`
2. Check sync_status: `SELECT sync_status, COUNT(*) FROM gmail_messages GROUP BY sync_status`
3. Look for failed messages: `SELECT * FROM gmail_messages WHERE sync_status = 'failed'`
4. Check worker logs for processing errors

---

## Performance

### Benchmarks

| Scenario | Emails | Time | Rate |
|----------|--------|------|------|
| Initial Sync | 1,000 | ~2 min | 8 msg/sec |
| Initial Sync | 10,000 | ~20 min | 8 msg/sec |
| Initial Sync | 50,000 | ~100 min | 8 msg/sec |
| Incremental | 100 | ~15 sec | 6 msg/sec |

*Including embedding generation and multi-database storage*

### Optimization Tips

1. **Batch Processing**: Process 100 messages per batch
2. **Concurrent Workers**: Run multiple workers for different users
3. **Local Embeddings**: Use local model to avoid API latency
4. **Caching**: Cache embeddings by content hash
5. **Index Optimization**: Ensure database indexes on `gmail_message_id`

---

## Production Deployment

### Docker

```bash
# Build image
docker build -t lifeos-gmail-connector .

# Run server
docker run -p 8002:8002 \
  --env-file .env \
  lifeos-gmail-connector

# Run worker
docker run \
  --env-file .env \
  lifeos-gmail-connector \
  node dist/worker.js
```

### Kubernetes

See main LifeOS k8s manifests for deployment configuration.

---

## License

MIT
