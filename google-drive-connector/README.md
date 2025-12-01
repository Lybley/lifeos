# Google Drive Connector for LifeOS

This microservice connects Google Drive accounts to the LifeOS Personal Memory Graph (PMG).

## Features

- OAuth2 authentication with Google Drive
- Automatic file sync (initial and incremental)
- Support for Google Workspace file export (Docs, Sheets, Slides)
- Integration with LifeOS ingest service for OCR and embedding
- Background sync using BullMQ and Redis
- Store file metadata in PostgreSQL
- Create Document nodes in Neo4j with relationships
- Store embeddings in Pinecone

## Prerequisites

1. **Google Cloud Platform Project**
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google Drive API
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `http://localhost:8003/auth/google/callback`

2. **Required Services**
   - PostgreSQL (for metadata)
   - Neo4j (for graph nodes)
   - Pinecone (for vector storage)
   - Redis (for background jobs)
   - Ingest Service (for file processing)

## Installation

```bash
# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
```

## Configuration

Edit `.env` file with your credentials:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8003/auth/google/callback
```

## Database Setup

```bash
# Run schema migration
psql -h localhost -U postgres -d lifeos -f schema.sql
```

## Running the Service

```bash
# Development mode (with hot reload)
yarn dev

# Production mode
yarn build
yarn start

# Run background worker
yarn worker
```

## API Endpoints

### Authentication

**Initiate OAuth Flow**
```
GET /auth/google?userId=USER_ID
```

**OAuth Callback** (handled automatically)
```
GET /auth/google/callback?code=CODE&state=STATE
```

**Check Connection Status**
```
GET /auth/status?userId=USER_ID
```

**Disconnect Account**
```
POST /auth/disconnect
{
  "userId": "USER_ID"
}
```

### Sync

**Trigger Manual Sync**
```
POST /sync/start
{
  "userId": "USER_ID"
}
```

**Check Sync Status**
```
GET /sync/status/:jobId
```

## Architecture

1. **OAuth Flow**: User authorizes Google Drive access
2. **Token Storage**: OAuth tokens stored in PostgreSQL with auto-refresh
3. **File Discovery**: List files from Drive API
4. **File Download**: Download or export file content
5. **Ingestion**: Send to ingest service for chunking and embedding
6. **Storage**: 
   - Metadata in PostgreSQL (`drive_files` table)
   - Document nodes in Neo4j
   - Embeddings in Pinecone

## Supported File Types

- PDF documents
- Plain text files
- Word documents (DOCX)
- Google Docs (exported as PDF)
- Google Sheets (exported as PDF)
- Google Slides (exported as PDF)

## Testing

```bash
# Run tests
yarn test
```

## Docker

```bash
# Build image
docker build -t lifeos-drive-connector .

# Run container
docker run -p 8003:8003 --env-file .env lifeos-drive-connector
```

## Troubleshooting

**Connection Errors**
- Verify Google OAuth credentials
- Check redirect URI matches exactly
- Ensure all required APIs are enabled in GCP

**Sync Failures**
- Check Redis connection
- Verify ingest service is running
- Check database connections
- Review logs for specific errors

## License

MIT
