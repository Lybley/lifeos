# Google Calendar Connector for LifeOS

This microservice connects Google Calendar accounts to the LifeOS Personal Memory Graph (PMG).

## Features

- OAuth2 authentication with Google Calendar
- Automatic event sync (initial and incremental)
- Support for multiple calendars per user
- Create Event and Person nodes in Neo4j
- Relationship mapping (attendees, organizers)
- Background sync using BullMQ and Redis
- Store event metadata in PostgreSQL

## Prerequisites

1. **Google Cloud Platform Project**
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `http://localhost:8004/auth/google/callback`

2. **Required Services**
   - PostgreSQL (for metadata)
   - Neo4j (for graph nodes)
   - Redis (for background jobs)

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
GOOGLE_REDIRECT_URI=http://localhost:8004/auth/google/callback
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

1. **OAuth Flow**: User authorizes Google Calendar access
2. **Token Storage**: OAuth tokens stored in PostgreSQL with auto-refresh
3. **Event Discovery**: List events from Calendar API
4. **Event Processing**: Extract event details and attendees
5. **Storage**: 
   - Metadata in PostgreSQL (`calendar_events` table)
   - Event nodes in Neo4j
   - Person nodes for attendees/organizers
   - Relationships: ATTENDED_BY, ORGANIZED, OWNS

## Graph Schema

### Nodes
- **Event**: Calendar events
- **Person**: Event attendees and organizers
- **User**: PMG owner

### Relationships
- `(User)-[:OWNS]->(Event)`
- `(Event)-[:ATTENDED_BY]->(Person)`
- `(Person)-[:ORGANIZED]->(Event)`

## Testing

```bash
# Run tests
yarn test
```

## Docker

```bash
# Build image
docker build -t lifeos-calendar-connector .

# Run container
docker run -p 8004:8004 --env-file .env lifeos-calendar-connector
```

## Troubleshooting

**Connection Errors**
- Verify Google OAuth credentials
- Check redirect URI matches exactly
- Ensure Calendar API is enabled in GCP

**Sync Failures**
- Check Redis connection
- Verify database connections
- Review logs for specific errors

## License

MIT
