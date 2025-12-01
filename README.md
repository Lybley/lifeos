# LifeOS Core

A full-stack platform with graph-based knowledge management, vector search, and background job processing.

## Tech Stack

### Backend
- **Runtime**: Node.js + Express (TypeScript)
- **Databases**:
  - PostgreSQL: Metadata and relational data
  - Neo4j: Graph nodes and relationships
  - Pinecone: Vector embeddings and semantic search
- **Queue**: BullMQ (Redis-backed)
- **Auth**: OAuth2 (Auth0)

### Frontend
- **Framework**: Next.js (React + TypeScript)
- **Styling**: TailwindCSS (optional)

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions

## Project Structure

```
lifeos-core/
├── backend/              # Express API server
├── frontend/             # Next.js application
├── worker/               # BullMQ worker service
├── k8s/                  # Kubernetes manifests
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yml    # Local development
└── README.md
```

## Local Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)
- Neo4j (via Docker)
- Pinecone API key
- Auth0 account and credentials

### Step 1: Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install worker dependencies
cd ../worker
npm install
```

### Step 2: Environment Configuration

Create `.env` files in each service directory:

**backend/.env**:
```env
PORT=8000
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX=lifeos-vectors

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.lifeos.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
```

**frontend/.env.local**:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://api.lifeos.com
```

**worker/.env**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Step 3: Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and Neo4j
docker-compose up -d
```

### Step 4: Run Services

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Worker
cd worker
npm run dev
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Neo4j Browser: http://localhost:7474

## Docker Build

```bash
# Build all services
docker-compose build

# Run all services
docker-compose up
```

## Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods
kubectl get services
```

## API Documentation

Once running, API documentation is available at:
- Swagger UI: http://localhost:8000/api-docs

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Worker tests
cd worker
npm test
```

## License

MIT
