#!/bin/bash

# Admin Dashboard API Test Script
# Tests all admin endpoints with sample data

API_URL="http://localhost:8000/api/v1/admin"
ADMIN_USER_ID="admin-001"

echo "========================================="
echo "Admin Dashboard API Tests"
echo "========================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
curl -s "$API_URL/health" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 2: List Users
echo "Test 2: List Users"
curl -s "$API_URL/users?page=1&limit=10" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 3: Get User Details
echo "Test 3: Get User Details"
curl -s "$API_URL/users/admin-001" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 4: Metrics Overview
echo "Test 4: Metrics Overview"
curl -s "$API_URL/metrics/overview" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 5: System Metrics
echo "Test 5: System Metrics (last 7 days)"
curl -s "$API_URL/metrics/system?days=7" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 6: Audit Logs
echo "Test 6: Audit Logs"
curl -s "$API_URL/audit-logs?page=1&limit=10" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 7: List Tickets
echo "Test 7: Support Tickets"
curl -s "$API_URL/tickets?page=1&limit=10" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

# Test 8: Billing Overview
echo "Test 8: Billing Overview"
curl -s "$API_URL/billing/overview?days=30" \
  -H "x-admin-user-id: $ADMIN_USER_ID" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2))"
echo ""

echo "========================================="
echo "✅ All Tests Completed!"
echo "========================================="
