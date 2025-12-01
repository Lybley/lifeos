# Google Drive & Calendar Connectors - Integration Guide

This guide provides comprehensive instructions for setting up and using the Google Drive and Google Calendar connector services for LifeOS.

## Overview

The LifeOS project now includes two new connector microservices:

1. **Google Drive Connector** (`/app/google-drive-connector`) - Port 8003
2. **Google Calendar Connector** (`/app/google-calendar-connector`) - Port 8004

Both services integrate with the LifeOS Personal Memory Graph (PMG) to create a unified knowledge base from your Google data.

## Architecture

```
┌─────────────────┐
│   Google APIs   │
│ (Drive/Calendar)│
└────────┬────────┘
         │ OAuth2
         ▼
┌─────────────────┐
│   Connectors    │
│  Drive/Calendar │
└────────┬────────┘
         │
         ├──► PostgreSQL (Metadata)
         ├──► Neo4j (Graph Nodes)
         ├──► Pinecone (Vectors)
         └──► Redis (Job Queue)
```

## Prerequisites

### 1. Google Cloud Platform Setup

You need to create a Google Cloud Platform (GCP) project and obtain OAuth2 credentials:

#### Step 1: Create GCP Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

#### Step 2: Enable APIs
1. Navigate to "APIs & Services" > "Library"
2. Enable the following APIs:
   - **Google Drive API**
   - **Google Calendar API**

#### Step 3: Create OAuth2 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: LifeOS Connectors
   - **Authorized redirect URIs**:
     - `http://localhost:8003/auth/google/callback` (Drive)
     - `http://localhost:8004/auth/google/callback` (Calendar)
     - Add your production URLs when deploying
5. Click "Create"
6. **Save your Client ID and Client Secret** - you'll need these!

#### Step 4: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" (or "Internal" if using Google Workspace)
3. Fill in:
   - App name: LifeOS
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Save and continue

### 2. Required Infrastructure

Ensure the following services are running:

- **PostgreSQL** (port 5432)
- **Neo4j** (port 7687)
- **Redis** (port 6379)
- **Pinecone** (cloud service - API key required)
- **Ingest Service** (port 8001) - for Drive connector only

## Configuration

### Google Drive Connector

1. Navigate to the Drive connector directory:
```bash
cd /app/google-drive-connector
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```env
# Google OAuth2
GOOGLE_CLIENT_ID=your-actual-client-id-here
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8003/auth/google/callback

# Database connections (update as needed)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-postgres-password

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password

PINECONE_API_KEY=your-pinecone-api-key

REDIS_HOST=localhost
REDIS_PORT=6379

INGEST_SERVICE_URL=http://localhost:8001
```

4. Run database migrations:
```bash
psql -h localhost -U postgres -d lifeos -f schema.sql
```

### Google Calendar Connector

1. Navigate to the Calendar connector directory:
```bash
cd /app/google-calendar-connector
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```env
# Google OAuth2 (use same credentials as Drive)
GOOGLE_CLIENT_ID=your-actual-client-id-here
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8004/auth/google/callback

# Database connections (same as Drive)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-postgres-password

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password

REDIS_HOST=localhost
REDIS_PORT=6379
```

4. Run database migrations:
```bash
psql -h localhost -U postgres -d lifeos -f schema.sql
```

## Running the Services

### Development Mode

**Terminal 1 - Google Drive Connector:**
```bash
cd /app/google-drive-connector
yarn dev
```

**Terminal 2 - Google Drive Worker:**
```bash
cd /app/google-drive-connector
yarn worker
```

**Terminal 3 - Google Calendar Connector:**
```bash
cd /app/google-calendar-connector
yarn dev
```

**Terminal 4 - Google Calendar Worker:**
```bash
cd /app/google-calendar-connector
yarn worker
```

### Production Mode

```bash
# Build both services
cd /app/google-drive-connector && yarn build
cd /app/google-calendar-connector && yarn build

# Start services (use PM2, systemd, or Docker)
cd /app/google-drive-connector && yarn start
cd /app/google-calendar-connector && yarn start
```

### Using Docker

```bash
# Build images
cd /app/google-drive-connector
docker build -t lifeos-drive-connector .

cd /app/google-calendar-connector
docker build -t lifeos-calendar-connector .

# Run containers
docker run -d -p 8003:8003 --env-file .env lifeos-drive-connector
docker run -d -p 8004:8004 --env-file .env lifeos-calendar-connector
```

### Using Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  google-drive-connector:
    build: ./google-drive-connector
    ports:
      - "8003:8003"
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - POSTGRES_HOST=postgres
      - NEO4J_URI=bolt://neo4j:7687
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - neo4j
      - redis

  google-calendar-connector:
    build: ./google-calendar-connector
    ports:
      - "8004:8004"
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - POSTGRES_HOST=postgres
      - NEO4J_URI=bolt://neo4j:7687
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - neo4j
      - redis
```

## Usage

### Connecting Google Drive

1. **Initiate OAuth Flow:**
   ```
   GET http://localhost:8003/auth/google?userId=USER_ID
   ```
   - Open this URL in a browser
   - User will be redirected to Google for authorization
   - After approval, they'll be redirected back with a success message

2. **Check Connection Status:**
   ```bash
   curl "http://localhost:8003/auth/status?userId=USER_ID"
   ```

3. **Trigger Manual Sync:**
   ```bash
   curl -X POST http://localhost:8003/sync/start \
     -H "Content-Type: application/json" \
     -d '{"userId": "USER_ID"}'
   ```

4. **Check Sync Status:**
   ```bash
   curl http://localhost:8003/sync/status/JOB_ID
   ```

### Connecting Google Calendar

1. **Initiate OAuth Flow:**
   ```
   GET http://localhost:8004/auth/google?userId=USER_ID
   ```

2. **Check Connection Status:**
   ```bash
   curl "http://localhost:8004/auth/status?userId=USER_ID"
   ```

3. **Trigger Manual Sync:**
   ```bash
   curl -X POST http://localhost:8004/sync/start \
     -H "Content-Type: application/json" \
     -d '{"userId": "USER_ID"}'
   ```

4. **Check Sync Status:**
   ```bash
   curl http://localhost:8004/sync/status/JOB_ID
   ```

## Data Flow

### Google Drive Connector

1. **OAuth**: User authorizes Drive access
2. **File Discovery**: Connector lists files via Drive API
3. **File Processing**:
   - Regular files: Downloaded directly
   - Google Docs/Sheets/Slides: Exported as PDF
4. **Ingestion**: Files sent to ingest-service for:
   - Text extraction (OCR if needed)
   - Chunking (~512 tokens)
   - Embedding generation
5. **Storage**:
   - Metadata → PostgreSQL `drive_files` table
   - Document nodes → Neo4j with `source='google_drive'`
   - Embeddings → Pinecone vector store

### Google Calendar Connector

1. **OAuth**: User authorizes Calendar access
2. **Event Discovery**: Connector lists events from all calendars
3. **Event Processing**:
   - Extract event details (title, time, location)
   - Parse attendees and organizer
4. **Storage**:
   - Metadata → PostgreSQL `calendar_events` table
   - Event nodes → Neo4j
   - Person nodes → Created/updated for attendees
   - Relationships → `ATTENDED_BY`, `ORGANIZED`, `OWNS`

## Database Schema

### PostgreSQL Tables

**drive_files:**
```sql
id, user_id, drive_file_id, pmg_document_id, file_name,
mime_type, file_size, web_view_link, created_time,
modified_time, synced_at, created_at, updated_at
```

**calendar_events:**
```sql
id, user_id, calendar_id, event_id, pmg_event_id, title,
description, location, start_time, end_time, is_all_day,
organizer_email, attendees (JSONB), synced_at, created_at, updated_at
```

### Neo4j Graph Schema

**Nodes:**
- `Document` (from Drive files)
- `Event` (from Calendar)
- `Person` (attendees/organizers)
- `User` (PMG owner)

**Relationships:**
- `(User)-[:OWNS]->(Document)`
- `(User)-[:OWNS]->(Event)`
- `(Event)-[:ATTENDED_BY]->(Person)`
- `(Person)-[:ORGANIZED]->(Event)`
- `(Document)-[:HAS_CHUNK]->(Chunk)`

## Troubleshooting

### OAuth Issues

**"redirect_uri_mismatch" error:**
- Ensure redirect URIs in GCP exactly match your `.env` configuration
- Check for trailing slashes or http vs https mismatches

**"access_denied" error:**
- User cancelled authorization
- Or required scopes not approved in OAuth consent screen

### Connection Issues

**"Database initialization failed":**
- Check PostgreSQL connection: `psql -h localhost -U postgres -d lifeos -c "SELECT 1"`
- Check Neo4j connection: Verify URI and credentials
- Check Redis: `redis-cli ping`

**"No tokens found for user":**
- User hasn't completed OAuth flow yet
- Or tokens were deleted/invalidated
- Solution: Re-initiate OAuth flow

### Sync Issues

**Sync job stuck:**
- Check Redis: `redis-cli KEYS bullmq:*`
- View job details in Redis
- Restart worker if needed

**File processing errors (Drive):**
- Check ingest-service is running on port 8001
- Verify Pinecone API key is valid
- Check file size limits

**Rate limit errors:**
- Google APIs have rate limits
- Workers automatically retry with exponential backoff
- Consider reducing `WORKER_CONCURRENCY` in `.env`

### Logs

Check service logs:
```bash
# Drive connector
tail -f /app/google-drive-connector/logs/combined.log

# Calendar connector
tail -f /app/google-calendar-connector/logs/combined.log
```

## Testing

### Health Checks

```bash
# Drive connector
curl http://localhost:8003/health

# Calendar connector
curl http://localhost:8004/health
```

### End-to-End Test

1. Connect a test Google account
2. Upload a test file to Google Drive
3. Create a test calendar event
4. Wait for sync (or trigger manually)
5. Query Neo4j to verify nodes were created:

```cypher
// Check Drive documents
MATCH (d:Document {source: 'google_drive'})
RETURN d LIMIT 10;

// Check Calendar events
MATCH (e:Event {platform: 'google_calendar'})
RETURN e LIMIT 10;

// Check relationships
MATCH (e:Event)-[:ATTENDED_BY]->(p:Person)
RETURN e.title, p.email LIMIT 10;
```

## Production Deployment

### Security Considerations

1. **Use HTTPS** in production
2. Update redirect URIs to production URLs
3. Secure your `.env` files (never commit to git)
4. Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
5. Implement rate limiting on public endpoints
6. Use OAuth state parameter for CSRF protection (already implemented)

### Monitoring

1. Set up health check monitoring
2. Monitor Redis queue lengths
3. Track sync job success/failure rates
4. Monitor API rate limit usage
5. Set up alerts for service failures

### Scaling

1. Run multiple worker instances for parallel processing
2. Use Redis Sentinel or Redis Cluster for HA
3. Scale horizontally with load balancer
4. Consider separate worker pools per connector

## API Reference

See individual README files:
- [Google Drive Connector API](/app/google-drive-connector/README.md)
- [Google Calendar Connector API](/app/google-calendar-connector/README.md)

## Support

For issues and questions:
1. Check logs for error messages
2. Review this troubleshooting guide
3. Consult Google API documentation
4. Check GitHub issues (if applicable)

## License

MIT
