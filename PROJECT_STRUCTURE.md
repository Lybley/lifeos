# LifeOS Core - Complete Project Structure

```
lifeos-core/
│
├── backend/                          # Express API Server (TypeScript)
│   ├── src/
│   │   ├── config/                   # Configuration files
│   │   │   ├── postgres.ts          # PostgreSQL connection pool
│   │   │   ├── neo4j.ts             # Neo4j driver configuration
│   │   │   ├── pinecone.ts          # Pinecone client setup
│   │   │   └── queue.ts             # BullMQ/Redis queue configuration
│   │   │
│   │   ├── middleware/              # Express middleware
│   │   │   ├── auth.ts              # Auth0 JWT validation
│   │   │   └── errorHandler.ts     # Global error handling
│   │   │
│   │   ├── routes/                  # API route handlers
│   │   │   ├── index.ts             # Route aggregator
│   │   │   ├── nodes.ts             # Graph node CRUD endpoints
│   │   │   ├── vectors.ts           # Vector search endpoints
│   │   │   └── jobs.ts              # Background job endpoints
│   │   │
│   │   ├── utils/                   # Utility functions
│   │   │   └── logger.ts            # Winston logger configuration
│   │   │
│   │   └── server.ts                # Main application entry point
│   │
│   ├── dist/                         # Compiled JavaScript (generated)
│   ├── node_modules/                 # Dependencies (generated)
│   ├── package.json                  # Node.js dependencies & scripts
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── Dockerfile                    # Docker container definition
│   ├── .dockerignore                 # Docker ignore patterns
│   ├── .env.example                  # Environment variables template
│   └── .env                          # Environment variables (create this)
│
├── frontend/                         # Next.js Application (TypeScript)
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── layout.tsx           # Root layout with Auth0 provider
│   │   │   ├── page.tsx             # Home page
│   │   │   ├── globals.css          # Global styles
│   │   │   ├── nodes/
│   │   │   │   └── page.tsx         # Graph nodes management page
│   │   │   ├── vectors/
│   │   │   │   └── page.tsx         # Vector search page
│   │   │   └── jobs/
│   │   │       └── page.tsx         # Job queue monitoring page
│   │   │
│   │   └── lib/
│   │       └── api.ts                # API client with axios
│   │
│   ├── public/                       # Static assets
│   ├── .next/                        # Next.js build output (generated)
│   ├── node_modules/                 # Dependencies (generated)
│   ├── package.json                  # Node.js dependencies & scripts
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── next.config.js                # Next.js configuration
│   ├── Dockerfile                    # Docker container definition
│   ├── .dockerignore                 # Docker ignore patterns
│   ├── .env.example                  # Environment variables template
│   └── .env.local                    # Environment variables (create this)
│
├── worker/                           # Background Job Worker (TypeScript)
│   ├── src/
│   │   ├── processors/              # Job processors
│   │   │   ├── defaultProcessor.ts  # Default job handler
│   │   │   ├── dataSyncProcessor.ts # Data sync job handler
│   │   │   └── vectorProcessor.ts   # Vector update job handler
│   │   │
│   │   ├── utils/
│   │   │   └── logger.ts            # Winston logger configuration
│   │   │
│   │   └── worker.ts                # Worker entry point
│   │
│   ├── dist/                         # Compiled JavaScript (generated)
│   ├── node_modules/                 # Dependencies (generated)
│   ├── package.json                  # Node.js dependencies & scripts
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── Dockerfile                    # Docker container definition
│   ├── .dockerignore                 # Docker ignore patterns
│   ├── .env.example                  # Environment variables template
│   └── .env                          # Environment variables (create this)
│
├── k8s/                              # Kubernetes Manifests
│   ├── namespace.yaml               # Namespace definition
│   ├── configmap.yaml               # Configuration data
│   ├── secrets.yaml                 # Sensitive data (update with real values)
│   ├── postgres-deployment.yaml     # PostgreSQL deployment & service
│   ├── redis-deployment.yaml        # Redis deployment & service
│   ├── neo4j-deployment.yaml        # Neo4j deployment & service
│   ├── backend-deployment.yaml      # Backend API deployment & service
│   ├── frontend-deployment.yaml     # Frontend deployment & service
│   ├── worker-deployment.yaml       # Worker deployment
│   └── ingress.yaml                 # Ingress routing rules
│
├── .github/                          # GitHub-specific files
│   └── workflows/
│       └── ci.yml                   # CI/CD pipeline configuration
│
├── docker-compose.yml               # Local development orchestration
├── .gitignore                       # Git ignore patterns
├── README.md                        # Main project documentation
├── QUICKSTART.md                    # Quick start guide
├── ARCHITECTURE.md                  # Architecture documentation
└── PROJECT_STRUCTURE.md             # This file

```

## File Descriptions

### Backend Files

| File | Purpose |
|------|---------|
| `server.ts` | Main Express application with middleware setup |
| `config/postgres.ts` | PostgreSQL connection pool configuration |
| `config/neo4j.ts` | Neo4j driver initialization |
| `config/pinecone.ts` | Pinecone vector database client |
| `config/queue.ts` | BullMQ queue and Redis connection |
| `middleware/auth.ts` | Auth0 JWT token validation |
| `middleware/errorHandler.ts` | Centralized error handling |
| `routes/nodes.ts` | Graph node CRUD operations |
| `routes/vectors.ts` | Vector upsert, query, delete operations |
| `routes/jobs.ts` | Job creation and monitoring |
| `utils/logger.ts` | Winston-based logging utility |

### Frontend Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with Auth0 UserProvider |
| `app/page.tsx` | Home page with authentication and navigation |
| `app/nodes/page.tsx` | Graph node management interface |
| `app/vectors/page.tsx` | Vector search interface |
| `app/jobs/page.tsx` | Job queue monitoring dashboard |
| `lib/api.ts` | Axios API client with auth token management |
| `globals.css` | Global CSS styles |
| `next.config.js` | Next.js build and runtime configuration |

### Worker Files

| File | Purpose |
|------|---------|
| `worker.ts` | BullMQ worker initialization and job routing |
| `processors/defaultProcessor.ts` | Generic job processing logic |
| `processors/dataSyncProcessor.ts` | Database synchronization jobs |
| `processors/vectorProcessor.ts` | Vector embedding generation and indexing |
| `utils/logger.ts` | Winston-based logging utility |

### Kubernetes Files

| File | Purpose |
|------|---------|
| `namespace.yaml` | Isolated namespace for all resources |
| `configmap.yaml` | Non-sensitive configuration data |
| `secrets.yaml` | Sensitive data (API keys, passwords) |
| `postgres-deployment.yaml` | PostgreSQL database with PVC |
| `redis-deployment.yaml` | Redis for job queue with PVC |
| `neo4j-deployment.yaml` | Neo4j graph database with PVC |
| `backend-deployment.yaml` | Backend API with 3 replicas |
| `frontend-deployment.yaml` | Frontend with 2 replicas |
| `worker-deployment.yaml` | Worker with 2 replicas |
| `ingress.yaml` | HTTP routing and TLS termination |

### Infrastructure Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local development environment setup |
| `.github/workflows/ci.yml` | Automated CI/CD pipeline |
| `.gitignore` | Files to exclude from version control |
| `README.md` | Comprehensive project documentation |
| `QUICKSTART.md` | Step-by-step setup instructions |
| `ARCHITECTURE.md` | Detailed architecture documentation |

## Technology Stack Summary

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Databases**: PostgreSQL, Neo4j, Pinecone, Redis
- **Queue**: BullMQ
- **Auth**: Auth0 (OAuth2/JWT)
- **Logging**: Winston

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Library**: React 18
- **Language**: TypeScript
- **Auth**: @auth0/nextjs-auth0
- **HTTP Client**: Axios
- **Data Fetching**: SWR

### Worker
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Queue**: BullMQ
- **Database**: PostgreSQL (for job data)

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Local Dev**: Docker Compose

## Environment Variables Summary

### Backend
- Database connections (PostgreSQL, Neo4j, Redis)
- Pinecone API credentials
- Auth0 configuration
- Server port and environment

### Frontend
- Backend API URL
- Auth0 configuration
- OAuth callback URLs

### Worker
- Redis connection
- PostgreSQL connection
- Logging configuration

## Port Assignments

| Service | Port | Purpose |
|---------|------|---------|
| Backend API | 8000 | HTTP REST API |
| Frontend | 3000 | Next.js web application |
| PostgreSQL | 5432 | Database connections |
| Redis | 6379 | Queue and caching |
| Neo4j HTTP | 7474 | Browser interface |
| Neo4j Bolt | 7687 | Database connections |

## Build Commands

```bash
# Backend
cd backend
npm run dev        # Development with hot reload
npm run build      # Compile TypeScript
npm start          # Production server
npm test           # Run tests
npm run lint       # Check code quality

# Frontend
cd frontend
npm run dev        # Development with hot reload
npm run build      # Production build
npm start          # Production server
npm run lint       # Check code quality
npm run type-check # TypeScript validation

# Worker
cd worker
npm run dev        # Development with hot reload
npm run build      # Compile TypeScript
npm start          # Production worker
npm test           # Run tests
npm run lint       # Check code quality
```

## Docker Commands

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service]

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

## Kubernetes Commands

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -n lifeos
kubectl get services -n lifeos

# View logs
kubectl logs -f deployment/backend -n lifeos

# Restart deployment
kubectl rollout restart deployment/backend -n lifeos

# Delete all resources
kubectl delete namespace lifeos
```
