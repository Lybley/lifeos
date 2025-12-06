#!/bin/bash

# LifeOS Comprehensive Testing Script
# Tests all frontend pages and backend APIs

set -e

echo "=========================================="
echo "🧪 LifeOS Comprehensive Testing Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URLs
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:8000"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null || echo "000")
    fi
    
    if [ "$response" = "200" ] || [ "$response" = "302" ] || [ "$response" = "304" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 Section 1: Backend Health Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Backend Health" "$BACKEND_URL/health"
test_endpoint "Backend API Info" "$BACKEND_URL/api/"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🏠 Section 2: Frontend User Pages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Landing Page" "$FRONTEND_URL/landing"
test_endpoint "Main Dashboard" "$FRONTEND_URL/"
test_endpoint "Chat Page" "$FRONTEND_URL/chat"
test_endpoint "Memory Graph" "$FRONTEND_URL/memory"
test_endpoint "Upload Page" "$FRONTEND_URL/upload"
test_endpoint "Connections" "$FRONTEND_URL/connections"
test_endpoint "Actions Page" "$FRONTEND_URL/actions"
test_endpoint "Settings Page" "$FRONTEND_URL/settings"
test_endpoint "Vault Page" "$FRONTEND_URL/vault"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🚀 Section 3: Onboarding Flows${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Progressive Onboarding (8-step)" "$FRONTEND_URL/onboarding/flow"
test_endpoint "Alternative Onboarding (4-step)" "$FRONTEND_URL/onboarding"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔐 Section 4: Admin Dashboard${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Admin Dashboard" "$FRONTEND_URL/admin"
test_endpoint "Admin - Users" "$FRONTEND_URL/admin/users"
test_endpoint "Admin - Metrics" "$FRONTEND_URL/admin/metrics"
test_endpoint "Admin - Audit Logs" "$FRONTEND_URL/admin/audit"
test_endpoint "Admin - Tickets" "$FRONTEND_URL/admin/tickets"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔒 Section 5: Privacy & Vault APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Privacy Settings" "$BACKEND_URL/api/v1/privacy/encryption-settings?userId=test-user-123"
test_endpoint "Vault Config" "$BACKEND_URL/api/v1/vault/config/test-user-vault-123"
test_endpoint "Vault Items List" "$BACKEND_URL/api/v1/vault/items?userId=test-user-vault-123"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}💳 Section 6: Billing & Subscription APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Billing Plans" "$BACKEND_URL/api/v1/billing/plans"
test_endpoint "User Subscription" "$BACKEND_URL/api/v1/billing/subscription?userId=test-user-billing"
test_endpoint "Usage Summary" "$BACKEND_URL/api/v1/billing/usage/test-user-billing"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📅 Section 7: Planner Engine APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Planner Health" "$BACKEND_URL/api/v1/planner/health"
test_endpoint "Planner Conflicts" "$BACKEND_URL/api/v1/planner/conflicts?userId=test-user-1"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚡ Section 8: Action Engine APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "User Actions" "$BACKEND_URL/api/actions/user/test-user-123"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}👥 Section 9: Admin Backend APIs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Admin - All Users" "$BACKEND_URL/api/v1/admin/users"
test_endpoint "Admin - System Metrics" "$BACKEND_URL/api/v1/admin/metrics"
test_endpoint "Admin - Audit Logs" "$BACKEND_URL/api/v1/admin/audit-logs"

echo ""
echo "=========================================="
echo -e "${BLUE}📊 Test Summary${NC}"
echo "=========================================="
echo ""
echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    SUCCESS_RATE=100
else
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}⚠️  Some tests failed. Success rate: $SUCCESS_RATE%${NC}"
fi

echo ""
echo "=========================================="
echo -e "${BLUE}🔗 Quick Access Links${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}User Onboarding:${NC}"
echo "  Landing Page:     $FRONTEND_URL/landing"
echo "  8-Step Onboarding: $FRONTEND_URL/onboarding/flow"
echo "  4-Step Onboarding: $FRONTEND_URL/onboarding"
echo ""
echo -e "${YELLOW}Main Dashboard:${NC}"
echo "  User Dashboard:   $FRONTEND_URL/"
echo "  Chat:             $FRONTEND_URL/chat"
echo "  Memory Graph:     $FRONTEND_URL/memory"
echo "  Vault:            $FRONTEND_URL/vault"
echo ""
echo -e "${YELLOW}Admin Access:${NC}"
echo "  Admin Dashboard:  $FRONTEND_URL/admin"
echo "  User Management:  $FRONTEND_URL/admin/users"
echo "  System Metrics:   $FRONTEND_URL/admin/metrics"
echo ""
echo -e "${YELLOW}Test User IDs:${NC}"
echo "  Regular User:     test-user-123"
echo "  Vault User:       test-user-vault-123"
echo "  Billing User:     test-user-billing"
echo "  Admin User:       admin-user-1"
echo ""
echo "=========================================="

exit 0
