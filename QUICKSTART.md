# LifeOS Core - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites Checklist
- ✅ Node.js 18+ installed
- ✅ Docker & Docker Compose installed
- ✅ Git installed
- ✅ Auth0 account (free tier)
- ✅ Pinecone account (optional, for vector search)

---

## Option 1: Docker Compose (Recommended for Quick Start)

### Step 1: Start Infrastructure
```bash
# Start all infrastructure services
docker-compose up -d postgres redis neo4j

# Wait 30 seconds for services to be ready
sleep 30

# Verify services are running
docker-compose ps
```

### Step 2: Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

**Frontend:**
```bash
cd ../frontend
cp .env.example .env.local
# Edit .env.local with your Auth0 credentials
```

**Worker:**
```bash
cd ../worker
cp .env.example .env
# Edit .env if needed
```

### Step 3: Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Worker
cd ../worker
npm install
```

### Step 4: Start Services
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

### Step 5: Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Neo4j Browser**: http://localhost:7474 (user: neo4j, pass: password)

---

## Option 2: Full Docker Setup

### Step 1: Build and Run Everything
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up
```

### Step 2: Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

---

## Auth0 Setup (Required)

### 1. Create Auth0 Application
1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new application (Regular Web Application)
3. Note your Domain, Client ID, and Client Secret

### 2. Configure Callbacks
In your Auth0 application settings:
- **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
- **Allowed Logout URLs**: `http://localhost:3000`
- **Allowed Web Origins**: `http://localhost:3000`

### 3. Create API
1. Go to Applications → APIs
2. Create new API
3. Set identifier: `https://api.lifeos.com`
4. Note the API identifier (Audience)

### 4. Update Environment Variables
```env
# Frontend .env.local
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://api.lifeos.com
AUTH0_BASE_URL=http://localhost:3000
AUTH0_SECRET=use-openssl-rand-hex-32-to-generate-this

# Backend .env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.lifeos.com
```

Generate AUTH0_SECRET:
```bash
openssl rand -hex 32
```

---

## Pinecone Setup (Optional)

### 1. Create Pinecone Account
1. Go to [Pinecone](https://www.pinecone.io/)
2. Create free account
3. Create new index named `lifeos-vectors`
4. Set dimensions: 1536 (for OpenAI embeddings)
5. Get API key from dashboard

### 2. Update Backend .env
```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX=lifeos-vectors
```

---

## Testing the Setup

### 1. Check Backend Health
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. Test Database Connections
Check backend logs for:
- ✅ PostgreSQL connected successfully
- ✅ Neo4j connected successfully
- ✅ Redis connected successfully
- ✅ Pinecone client initialized (if configured)

### 3. Test Frontend
1. Open http://localhost:3000
2. Click "Login with Auth0"
3. Complete authentication
4. View dashboard with Graph Nodes, Vector Search, and Jobs

### 4. Test API Endpoints
```bash
# Get access token from Auth0
TOKEN="your_jwt_token"

# Create a graph node
curl -X POST http://localhost:8000/api/nodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Person","properties":{"name":"John Doe"}}'

# Get all nodes
curl http://localhost:8000/api/nodes \
  -H "Authorization: Bearer $TOKEN"

# Add a job
curl -X POST http://localhost:8000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"data-sync","data":{"entityType":"user","entityId":"123"}}'

# Get job stats
curl http://localhost:8000/api/jobs/stats/overview \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common Issues & Solutions

### Issue: PostgreSQL connection failed
**Solution:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs lifeos-postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Issue: Neo4j authentication failed
**Solution:**
- Default credentials are `neo4j/password`
- Update NEO4J_PASSWORD in backend/.env if changed

### Issue: Frontend can't connect to backend
**Solution:**
- Check NEXT_PUBLIC_API_URL in frontend/.env.local
- Ensure backend is running on port 8000
- Check CORS settings in backend

### Issue: Worker not processing jobs
**Solution:**
```bash
# Check Redis connection
docker logs lifeos-redis

# Check worker logs
cd worker && npm run dev

# Verify Redis is accessible
redis-cli -h localhost -p 6379 ping
```

### Issue: Auth0 authentication fails
**Solution:**
1. Verify all callback URLs are configured
2. Check environment variables match Auth0 dashboard
3. Ensure AUTH0_SECRET is generated correctly
4. Clear browser cookies and try again

---

## Next Steps

1. **Explore the API**: Check out `/app/backend/src/routes/` for available endpoints
2. **Create Graph Nodes**: Use Neo4j Browser to visualize your data
3. **Add Vector Search**: Implement embedding generation for semantic search
4. **Customize Workers**: Add new job processors in `/app/worker/src/processors/`
5. **Deploy to Production**: Follow Kubernetes deployment guide

---

## Development Tips

### Hot Reload
All services support hot reload during development. Just edit files and see changes instantly.

### Database GUI Tools
- **PostgreSQL**: Use pgAdmin or DBeaver
- **Neo4j**: Built-in browser at http://localhost:7474
- **Redis**: Use RedisInsight or redis-cli

### Debugging
- Backend logs: Check terminal output
- Frontend logs: Browser console + Network tab
- Worker logs: Check terminal output
- Database logs: `docker-compose logs <service>`

### Code Quality
```bash
# Lint
npm run lint

# Type check
npm run type-check  # frontend only

# Run tests
npm test
```

---

## Resources

- [Backend API Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Kubernetes Deployment](./k8s/README.md)

---

## Need Help?

- 📖 Read the [Architecture Documentation](./ARCHITECTURE.md)
- 🐛 Found a bug? Open an issue
- 💡 Have a feature request? Open a discussion
- 📧 Contact: support@lifeos.com

---

**Happy coding! 🎉**
