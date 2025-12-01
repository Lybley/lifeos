# LifeOS Core Architecture

## Overview

LifeOS Core is a modern, scalable platform for knowledge management with graph-based storage, vector search, and asynchronous job processing.

## System Components

### 1. Backend API (Node.js + Express + TypeScript)

**Responsibilities:**
- RESTful API endpoints
- Authentication and authorization (Auth0)
- Database operations (PostgreSQL, Neo4j, Pinecone)
- Job queue management (BullMQ)
- Request validation and error handling

**Key Technologies:**
- Express.js for HTTP server
- TypeScript for type safety
- PostgreSQL for relational data
- Neo4j for graph data
- Pinecone for vector embeddings
- BullMQ for job queuing

**API Endpoints:**
- `/api/nodes` - Graph node CRUD operations
- `/api/vectors` - Vector search and upsert
- `/api/jobs` - Background job management
- `/health` - Health check endpoint

### 2. Frontend (Next.js + React + TypeScript)

**Responsibilities:**
- User interface and experience
- Client-side routing
- State management
- API integration
- OAuth2 authentication flow

**Key Technologies:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Auth0 SDK
- Axios for API calls
- SWR for data fetching

**Pages:**
- `/` - Home page with feature overview
- `/nodes` - Graph node management
- `/vectors` - Vector search interface
- `/jobs` - Job queue monitoring

### 3. Worker Service (BullMQ + TypeScript)

**Responsibilities:**
- Background job processing
- Data synchronization
- Vector embedding generation
- Scheduled tasks

**Job Types:**
- `default` - Generic job processing
- `data-sync` - Database synchronization
- `vector-update` - Embedding generation and indexing

### 4. Databases

#### PostgreSQL
- **Purpose**: Metadata, user data, relational information
- **Port**: 5432
- **Features**: ACID compliance, complex queries, transactions

#### Neo4j
- **Purpose**: Graph nodes and relationships
- **Ports**: 7474 (HTTP), 7687 (Bolt)
- **Features**: Graph traversal, pattern matching, Cypher queries

#### Pinecone
- **Purpose**: Vector embeddings for semantic search
- **Features**: Similarity search, high-dimensional vectors, real-time indexing

#### Redis
- **Purpose**: Job queue, caching, session storage
- **Port**: 6379
- **Features**: In-memory storage, pub/sub, persistence

## Data Flow

### 1. API Request Flow
```
Client → Frontend → Backend API → Database(s) → Response
```

### 2. Background Job Flow
```
Backend API → BullMQ (Redis) → Worker → Database(s) → Job Complete
```

### 3. Authentication Flow
```
Client → Auth0 Login → JWT Token → Backend Validation → Protected Resource
```

## Deployment Architecture

### Local Development
- Docker Compose for orchestration
- Hot reload for all services
- Exposed ports for debugging

### Kubernetes Production
- Namespace isolation
- ConfigMaps for configuration
- Secrets for sensitive data
- Persistent volumes for databases
- Load balancer for frontend
- Ingress for routing
- Horizontal scaling (3 backend, 2 frontend, 2 worker replicas)

### CI/CD Pipeline
1. Code push to GitHub
2. GitHub Actions triggered
3. Run tests (backend, frontend, worker)
4. Build Docker images
5. Push to Docker registry
6. Deploy to Kubernetes
7. Rolling update strategy

## Security

### Authentication
- OAuth2 via Auth0
- JWT tokens for API access
- Token validation on all protected routes

### Data Protection
- HTTPS/TLS in production
- Environment variable secrets
- Kubernetes secrets for sensitive data
- Database connection encryption

### API Security
- Helmet.js for HTTP headers
- CORS configuration
- Request validation
- Rate limiting (recommended to add)

## Scalability

### Horizontal Scaling
- Backend: Stateless API servers
- Frontend: Next.js static/SSR pages
- Worker: Multiple job processors

### Database Scaling
- PostgreSQL: Read replicas, connection pooling
- Neo4j: Causal clustering, read replicas
- Pinecone: Managed service, auto-scaling
- Redis: Cluster mode, sentinel

### Performance Optimization
- Database indexing
- Query optimization
- Caching strategy (Redis)
- CDN for static assets
- Lazy loading and code splitting

## Monitoring & Observability

### Recommended Tools
- **Logs**: ELK Stack, Loki
- **Metrics**: Prometheus, Grafana
- **Tracing**: Jaeger, OpenTelemetry
- **APM**: New Relic, Datadog
- **Alerts**: PagerDuty, Opsgenie

### Health Checks
- Backend: `/health` endpoint
- Frontend: Root page availability
- Databases: Connection pool status
- Worker: Job processing rate

## Development Workflow

1. **Local Setup**
   ```bash
   docker-compose up -d
   cd backend && npm run dev
   cd frontend && npm run dev
   cd worker && npm run dev
   ```

2. **Make Changes**
   - Edit code with hot reload
   - Write tests
   - Lint and type-check

3. **Commit & Push**
   - CI runs automatically
   - Tests must pass
   - Docker images built

4. **Deploy**
   - Merge to main branch
   - Auto-deploy to Kubernetes
   - Monitor rollout status

## Future Enhancements

- [ ] GraphQL API layer
- [ ] Real-time updates (WebSockets)
- [ ] Advanced caching strategies
- [ ] Multi-tenancy support
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Mobile app (React Native)
- [ ] API rate limiting
- [ ] Request throttling
- [ ] Comprehensive test coverage
