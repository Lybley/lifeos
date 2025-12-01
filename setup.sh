#!/bin/bash

# LifeOS Core - Automated Setup Script
# This script helps you set up the development environment quickly

set -e

echo "======================================"
echo "   LifeOS Core - Setup Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check prerequisites
echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not found. Please install npm first."
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker -v)
    print_success "Docker installed: $DOCKER_VERSION"
else
    print_warning "Docker not found. You'll need Docker for infrastructure services."
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose -v)
    print_success "Docker Compose installed: $COMPOSE_VERSION"
else
    print_warning "Docker Compose not found. You'll need it for infrastructure services."
fi

echo ""
echo "Step 2: Setting up environment files..."
echo "---------------------------------------"

# Backend .env
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    print_success "Created backend/.env"
    print_warning "Please update backend/.env with your actual credentials"
else
    print_info "backend/.env already exists"
fi

# Frontend .env.local
if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.example frontend/.env.local
    print_success "Created frontend/.env.local"
    print_warning "Please update frontend/.env.local with your Auth0 credentials"
else
    print_info "frontend/.env.local already exists"
fi

# Worker .env
if [ ! -f worker/.env ]; then
    cp worker/.env.example worker/.env
    print_success "Created worker/.env"
else
    print_info "worker/.env already exists"
fi

echo ""
echo "Step 3: Installing dependencies..."
echo "-----------------------------------"

# Install backend dependencies
print_info "Installing backend dependencies..."
cd backend
npm install
print_success "Backend dependencies installed"
cd ..

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd frontend
npm install
print_success "Frontend dependencies installed"
cd ..

# Install worker dependencies
print_info "Installing worker dependencies..."
cd worker
npm install
print_success "Worker dependencies installed"
cd ..

echo ""
echo "Step 4: Starting infrastructure services..."
echo "-------------------------------------------"

if command -v docker-compose &> /dev/null; then
    print_info "Starting PostgreSQL, Redis, and Neo4j..."
    docker-compose up -d postgres redis neo4j
    
    print_info "Waiting 30 seconds for services to initialize..."
    sleep 30
    
    if docker ps | grep -q lifeos-postgres; then
        print_success "PostgreSQL is running"
    else
        print_error "PostgreSQL failed to start"
    fi
    
    if docker ps | grep -q lifeos-redis; then
        print_success "Redis is running"
    else
        print_error "Redis failed to start"
    fi
    
    if docker ps | grep -q lifeos-neo4j; then
        print_success "Neo4j is running"
    else
        print_error "Neo4j failed to start"
    fi
else
    print_warning "Docker Compose not available. Please start infrastructure services manually."
fi

echo ""
echo "======================================"
echo "   Setup Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Update your .env files with actual credentials:"
echo "   - backend/.env (Auth0, Pinecone)"
echo "   - frontend/.env.local (Auth0)"
echo ""
echo "2. Generate AUTH0_SECRET for frontend:"
echo "   openssl rand -hex 32"
echo ""
echo "3. Start the services:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo "   Terminal 3: cd worker && npm run dev"
echo ""
echo "4. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - Neo4j Browser: http://localhost:7474"
echo ""
echo "For more details, see QUICKSTART.md"
echo ""
print_success "Happy coding! 🚀"
