# Quick Start Guide - Google Connectors

## TL;DR - Get Started in 5 Minutes

### Prerequisites
- Google Cloud Platform account
- PostgreSQL, Neo4j, and Redis running locally

### Step 1: Get Google OAuth Credentials (2 minutes)

1. Go to https://console.cloud.google.com/
2. Create a project (or select existing)
3. Enable APIs:
   - Google Drive API
   - Google Calendar API
4. Create OAuth credentials:
   - Type: Web application
   - Authorized redirect URIs:
     - `http://localhost:8003/auth/google/callback`
     - `http://localhost:8004/auth/google/callback`
5. Save your **Client ID** and **Client Secret**

### Step 2: Configure Services (1 minute)

**Google Drive Connector:**
```bash
cd /app/google-drive-connector
cp .env.example .env
# Edit .env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
```

**Google Calendar Connector:**
```bash
cd /app/google-calendar-connector
cp .env.example .env
# Edit .env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
```

### Step 3: Setup Databases (1 minute)

```bash
# Drive connector
psql -h localhost -U postgres -d lifeos -f /app/google-drive-connector/schema.sql

# Calendar connector
psql -h localhost -U postgres -d lifeos -f /app/google-calendar-connector/schema.sql
```

### Step 4: Start Services (1 minute)

**Terminal 1 - Drive Service:**
```bash
cd /app/google-drive-connector && yarn dev
```

**Terminal 2 - Drive Worker:**
```bash
cd /app/google-drive-connector && yarn worker
```

**Terminal 3 - Calendar Service:**
```bash
cd /app/google-calendar-connector && yarn dev
```

**Terminal 4 - Calendar Worker:**
```bash
cd /app/google-calendar-connector && yarn worker
```

### Step 5: Test Connection

**Connect Google Drive:**
Open in browser:
```
http://localhost:8003/auth/google?userId=test-user
```

**Connect Google Calendar:**
Open in browser:
```
http://localhost:8004/auth/google?userId=test-user
```

Authorize the apps, and sync will start automatically!

## What Happens Next?

- **Drive**: Your files are synced, OCR'd, chunked, embedded, and stored in the PMG
- **Calendar**: Your events and attendees become nodes in your knowledge graph
- **Background**: Workers process data in the background using Redis queues

## Quick Commands

```bash
# Check service health
curl http://localhost:8003/health  # Drive
curl http://localhost:8004/health  # Calendar

# Check connection status
curl "http://localhost:8003/auth/status?userId=test-user"
curl "http://localhost:8004/auth/status?userId=test-user"

# Trigger manual sync
curl -X POST http://localhost:8003/sync/start -H "Content-Type: application/json" -d '{"userId":"test-user"}'
curl -X POST http://localhost:8004/sync/start -H "Content-Type: application/json" -d '{"userId":"test-user"}'
```

## Need More Details?

See the comprehensive guide:
- [Full Integration Guide](/app/docs/GOOGLE_CONNECTORS_GUIDE.md)
- [Drive Connector README](/app/google-drive-connector/README.md)
- [Calendar Connector README](/app/google-calendar-connector/README.md)

## Troubleshooting

**OAuth error?**
- Check redirect URIs match exactly in GCP console
- Ensure APIs are enabled

**Can't connect to databases?**
- Verify PostgreSQL: `psql -h localhost -U postgres -d lifeos -c "SELECT 1"`
- Verify Neo4j: Check it's running on port 7687
- Verify Redis: `redis-cli ping`

**Sync not working?**
- Check worker logs
- Ensure ingest-service is running on port 8001 (for Drive)
- Check Redis connection
