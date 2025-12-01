# LifeOS - Quick Setup Guide

This guide will help you get LifeOS running for the first time.

---

## 🔍 **Current Issue**

The frontend is running, but the backend API is not starting because:
1. **Redis** is not installed (required for BullMQ job queue)
2. **PostgreSQL** is not running (required for data storage)

---

## ✅ **Quick Fix (Run These Commands)**

### Option 1: Automated Setup (Recommended)

Run this single command to install everything:

```bash
cd /app && bash quick_setup.sh
```

### Option 2: Manual Setup

If you prefer to understand what's happening, run these commands step by step:

#### **Step 1: Install Redis**

```bash
# Install Redis
sudo apt-get update
sudo apt-get install -y redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

#### **Step 2: Install PostgreSQL**

```bash
# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify PostgreSQL is running
sudo -u postgres psql -c "SELECT version();"
```

#### **Step 3: Create Database**

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE lifeos;
CREATE USER lifeos_user WITH ENCRYPTED PASSWORD 'lifeos_secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE lifeos TO lifeos_user;
\q
EOF
```

#### **Step 4: Update Backend Environment**

```bash
# Update .env with correct database URL
cat > /app/backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://lifeos_user:lifeos_secure_password_123@localhost:5432/lifeos

# Redis
REDIS_URL=redis://localhost:6379

# Auth0
AUTH0_DOMAIN=dev-7uhqscqzuvy20jg8.us.auth0.com
AUTH0_CLIENT_ID=nSXOiTBEBknTWVYdpZImCH1nBh1clh3M
AUTH0_CLIENT_SECRET=Ej-NF-T1C4T_VdTsqRRZhjROAFSHV_o1A19LRlIZSd1tdgSlNde-tMInOF9JkjO9
AUTH0_AUDIENCE=https://dev-7uhqscqzuvy20jg8.us.auth0.com/api/v2/

# API
PORT=8000
NODE_ENV=development

# Pinecone (for vector search)
PINECONE_API_KEY=your_pinecone_key_here
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=lifeos-memories

# OpenAI (for RAG)
OPENAI_API_KEY=your_openai_key_here
EOF
```

**⚠️ Important**: You'll need to add your own API keys for:
- **Pinecone** (vector database): https://www.pinecone.io/
- **OpenAI** (GPT models): https://platform.openai.com/

#### **Step 5: Run Database Migrations**

```bash
cd /app/backend

# Install dependencies if not already done
npm install

# Run migrations (if available)
# npm run migrate
# OR create tables manually (schema is in src/config/postgres.ts)
```

#### **Step 6: Restart Backend**

```bash
sudo supervisorctl restart backend

# Check if backend started successfully
sleep 5
sudo supervisorctl status backend

# Check backend logs
tail -50 /var/log/supervisor/backend.out.log
```

#### **Step 7: Verify Everything is Running**

```bash
# Check Redis
redis-cli ping
# Expected: PONG

# Check PostgreSQL
sudo -u postgres psql -c "SELECT 1;"
# Expected: Returns 1

# Check Backend API
curl http://localhost:8000/health
# Expected: {"status":"ok","timestamp":"..."}

# Check Frontend
curl http://localhost:3000
# Expected: HTML response

# Check all services
sudo supervisorctl status
# Expected: All services RUNNING
```

---

## 🧪 **Testing the Setup**

Once everything is running:

1. **Open Browser**: Visit `http://localhost:3000`
2. **Check Header**: Should show "Login" button (no error)
3. **Click Login**: Should redirect to Auth0
4. **Create Account**: Sign up with email
5. **View Dashboard**: Should see dashboard after login

---

## 🐛 **Troubleshooting**

### **Backend Won't Start**

```bash
# Check logs
tail -100 /var/log/supervisor/backend.err.log

# Common issues:
# 1. Redis not running: sudo systemctl status redis-server
# 2. PostgreSQL not running: sudo systemctl status postgresql
# 3. Database doesn't exist: sudo -u postgres psql -c "\l"
# 4. Missing dependencies: cd /app/backend && npm install
```

### **Redis Errors**

```bash
# Check if Redis is running
sudo systemctl status redis-server

# If not running
sudo systemctl start redis-server

# Test connection
redis-cli ping
```

### **PostgreSQL Errors**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running
sudo systemctl start postgresql

# Check if database exists
sudo -u postgres psql -l | grep lifeos
```

### **Port Already in Use**

```bash
# Check what's using port 8000
sudo lsof -i :8000

# Kill process if needed (replace PID)
sudo kill -9 <PID>

# Restart backend
sudo supervisorctl restart backend
```

---

## 📝 **Database Schema**

The backend will automatically create these tables:

- **users** - User accounts
- **actions** - User actions (send email, create event, etc.)
- **action_audit_logs** - Audit trail for actions
- **privacy_settings** - User privacy preferences
- **encrypted_data** - Encrypted vault data
- **drive_files** - Google Drive file metadata
- **calendar_events** - Google Calendar events

---

## 🔑 **Required API Keys**

For full functionality, you'll need:

### **1. Auth0** (Already Configured ✅)
- Domain: `dev-7uhqscqzuvy20jg8.us.auth0.com`
- Client ID: Configured
- Client Secret: Configured

### **2. Google OAuth** (Already Configured ✅)
- Client ID: `345416380786-e0i6ql6erkarpf83l6khhlcat32i8ngs.apps.googleusercontent.com`
- Client Secret: Configured

### **3. Pinecone** (Vector Database) ❌
- Get API key: https://www.pinecone.io/
- Create index named: `lifeos-memories`
- Dimensions: 1536 (for OpenAI embeddings)
- Add to `/app/backend/.env`

### **4. OpenAI** (GPT for RAG) ❌
- Get API key: https://platform.openai.com/api-keys
- Add to `/app/backend/.env`
- Used for: Chat responses, embeddings, summarization

---

## 🎯 **Next Steps**

Once setup is complete:

1. ✅ **Verify all services running**: `sudo supervisorctl status`
2. ✅ **Test backend API**: `curl http://localhost:8000/health`
3. ✅ **Test frontend**: Visit `http://localhost:3000`
4. ✅ **Login/Signup**: Test Auth0 flow
5. ✅ **Follow**: `/app/USER_TESTING_GUIDE.md` for full testing

---

## 📞 **Need Help?**

If you're stuck:
1. Check logs: `tail -100 /var/log/supervisor/backend.err.log`
2. Check service status: `sudo supervisorctl status`
3. Review this guide again
4. Contact support or check documentation

---

**Quick Command Summary**:

```bash
# Install everything
sudo apt-get update
sudo apt-get install -y redis-server postgresql postgresql-contrib

# Start services
sudo systemctl start redis-server postgresql
sudo systemctl enable redis-server postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE lifeos;"
sudo -u postgres psql -c "CREATE USER lifeos_user WITH PASSWORD 'lifeos_secure_password_123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lifeos TO lifeos_user;"

# Restart backend
sudo supervisorctl restart backend

# Test
curl http://localhost:8000/health
```

That's it! 🎉
