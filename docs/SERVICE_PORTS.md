# LifeOS Service Ports Reference

This document lists all services in the LifeOS ecosystem and their assigned ports.

## Services

| Service | Port | Description |
|---------|------|-------------|
| **Backend API** | 8000 | Main backend REST API |
| **Ingest Service** | 8001 | File ingestion, OCR, chunking, embeddings |
| **Gmail Connector** | 8002 | Gmail integration service |
| **Google Drive Connector** | 8003 | Google Drive integration service |
| **Google Calendar Connector** | 8004 | Google Calendar integration service |
| **Frontend** | 3000 | Next.js web application |
| **PostgreSQL** | 5432 | Relational database |
| **Neo4j** | 7687 | Graph database (Bolt protocol) |
| **Neo4j Browser** | 7474 | Neo4j web interface |
| **Redis** | 6379 | Cache and message queue |

## Port Usage by Category

### Frontend
- 3000: Next.js application

### Backend Services
- 8000-8004: Microservices

### Databases
- 5432: PostgreSQL
- 7687: Neo4j (Bolt)
- 7474: Neo4j Browser
- 6379: Redis

### External Services (Cloud)
- Pinecone: API-based (no local port)
- OpenAI/Llama: API-based (no local port)

## Service Dependencies

```
Frontend (3000)
  └─> Backend API (8000)
  └─> Gmail Connector (8002)
  └─> Drive Connector (8003)
  └─> Calendar Connector (8004)

Backend API (8000)
  └─> PostgreSQL (5432)
  └─> Neo4j (7687)
  └─> Redis (6379)

Ingest Service (8001)
  └─> PostgreSQL (5432)
  └─> Neo4j (7687)
  └─> Pinecone (API)
  └─> OpenAI/Llama (API)

Gmail Connector (8002)
  └─> PostgreSQL (5432)
  └─> Neo4j (7687)
  └─> Pinecone (API)
  └─> Redis (6379)
  └─> Ingest Service (8001)

Drive Connector (8003)
  └─> PostgreSQL (5432)
  └─> Neo4j (7687)
  └─> Pinecone (API)
  └─> Redis (6379)
  └─> Ingest Service (8001)

Calendar Connector (8004)
  └─> PostgreSQL (5432)
  └─> Neo4j (7687)
  └─> Redis (6379)
```

## Health Check Endpoints

All services provide a health check endpoint:

```bash
curl http://localhost:8000/health  # Backend
curl http://localhost:8001/health  # Ingest Service
curl http://localhost:8002/health  # Gmail Connector
curl http://localhost:8003/health  # Google Drive Connector
curl http://localhost:8004/health  # Google Calendar Connector
```

## Port Conflicts

If you encounter port conflicts, you can change the ports in each service's `.env` file:

```env
PORT=8003  # Change to any available port
```

Remember to also update:
1. OAuth redirect URIs in Google Cloud Console
2. Service URLs in other services' `.env` files
3. Docker Compose port mappings (if using)
4. Kubernetes service configs (if using)
