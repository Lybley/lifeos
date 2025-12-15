#!/bin/bash

# PostgreSQL Startup Script for LifeOS
# Ensures PostgreSQL runs persistently

echo "🔧 Starting PostgreSQL for LifeOS..."

# Check if PostgreSQL is already running
if pg_isready -h localhost -p 5432 2>/dev/null; then
    echo "✅ PostgreSQL is already running"
    exit 0
fi

# Create log directory
mkdir -p /var/log/postgresql
chmod 755 /var/log/postgresql

# Start PostgreSQL
/usr/lib/postgresql/15/bin/postgres \
    -D /var/lib/postgresql/15/main \
    -c config_file=/etc/postgresql/15/main/postgresql.conf \
    > /var/log/postgresql/postgresql.log 2>&1 &

# Wait for PostgreSQL to start
echo "⏳ Waiting for PostgreSQL to start..."
sleep 5

# Check if it's running
if pg_isready -h localhost -p 5432 2>/dev/null; then
    echo "✅ PostgreSQL started successfully"
    
    # Test connection
    PGPASSWORD='lifeos_secure_password_123' psql -h localhost -U lifeos_user -d lifeos -c "SELECT 1" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Database connection verified"
    else
        echo "⚠️  Database exists but connection failed"
    fi
else
    echo "❌ PostgreSQL failed to start"
    echo "📋 Log file: /var/log/postgresql/postgresql.log"
    exit 1
fi
