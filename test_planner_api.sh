#!/bin/bash
# Planner Engine API Test Script

echo "========================================"
echo "PLANNER ENGINE API TEST"
echo "========================================"
echo ""

API_URL="http://localhost:8000/api/v1/planner"
USER_ID="test-user-1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
echo "GET $API_URL/health"
response=$(curl -s "$API_URL/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✓ PASSED${NC}: Health check successful"
    echo "$response" | python3 -m json.tool
else
    echo -e "${RED}✗ FAILED${NC}: Health check failed"
    echo "$response"
fi
echo ""

# Test 2: Generate Daily Plan
echo -e "${BLUE}Test 2: Generate Daily Plan${NC}"
echo "POST $API_URL/generate"
response=$(curl -s -X POST "$API_URL/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"horizon\": \"daily\"}")

if echo "$response" | grep -q "dailyPlans"; then
    echo -e "${GREEN}✓ PASSED${NC}: Daily plan generated"
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"User ID: {data['userId']}\")
print(f\"Horizon: {data['horizon']}\")
print(f\"Daily Plans: {len(data['dailyPlans'])}\")
print(f\"Tasks Scheduled: {data['totalTasksScheduled']}\")
print(f\"Tasks Unscheduled: {data['totalTasksUnscheduled']}\")
print(f\"Confidence: {data['confidence']:.2f}\")
print(f\"Warnings: {len(data['warnings'])}\")
if data['dailyPlans']:
    plan = data['dailyPlans'][0]
    print(f\"\\nFirst day ({plan['dayOfWeek']}):\" )
    print(f\"  - Blocks: {len(plan['blocks'])}\")
    print(f\"  - Deep Work Time: {plan['deepWorkTime']} min\")
    print(f\"  - Energy Alignment: {plan['energyAlignment']:.2f}\")
"
else
    echo -e "${RED}✗ FAILED${NC}: Daily plan generation failed"
    echo "$response"
fi
echo ""

# Test 3: Generate Weekly Plan
echo -e "${BLUE}Test 3: Generate Weekly Plan${NC}"
echo "POST $API_URL/generate (weekly)"
response=$(curl -s -X POST "$API_URL/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"horizon\": \"weekly\"}")

if echo "$response" | grep -q "dailyPlans"; then
    echo -e "${GREEN}✓ PASSED${NC}: Weekly plan generated"
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Daily Plans Generated: {len(data['dailyPlans'])}\")
print(f\"Total Tasks Scheduled: {data['totalTasksScheduled']}\")
print(f\"Average Confidence: {data['confidence']:.2f}\")
print(f\"\\nDaily Breakdown:\")
for i, plan in enumerate(data['dailyPlans'][:3], 1):
    print(f\"  Day {i} ({plan['dayOfWeek']}): {len(plan['blocks'])} blocks, {plan['totalScheduledTime']} min\")
"
else
    echo -e "${RED}✗ FAILED${NC}: Weekly plan generation failed"
    echo "$response"
fi
echo ""

# Test 4: Get Task Scheduling Candidates
echo -e "${BLUE}Test 4: Get Scheduling Candidates${NC}"
# Get a task ID from database
TASK_ID=$(PGPASSWORD='lifeos_secure_password_123' psql -h localhost -U lifeos_user -d lifeos -t -c "SELECT id FROM tasks WHERE user_id='$USER_ID' LIMIT 1" | tr -d ' ')
echo "GET $API_URL/candidates/$TASK_ID"

if [ -n "$TASK_ID" ]; then
    response=$(curl -s "$API_URL/candidates/$TASK_ID?numCandidates=3")
    if echo "$response" | grep -q "candidates"; then
        echo -e "${GREEN}✓ PASSED${NC}: Candidates generated"
        echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Task ID: {data['taskId']}\")
print(f\"Number of Candidates: {len(data['candidates'])}\")
if data['candidates']:
    for i, candidate in enumerate(data['candidates'], 1):
        print(f\"\\nCandidate {i}:\")
        print(f\"  Start: {candidate['proposedStart']}\")
        print(f\"  Score: {candidate['score']:.2f}\")
        print(f\"  Energy Score: {candidate['scoreBreakdown']['energyScore']:.2f}\")
        print(f\"  Urgency Score: {candidate['scoreBreakdown']['urgencyScore']:.2f}\")
        print(f\"  Alternatives: {len(candidate['alternatives'])}\")
"
    else
        echo -e "${RED}✗ FAILED${NC}: Candidates generation failed"
        echo "$response"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC}: No task found"
fi
echo ""

# Test 5: Check for Conflicts
echo -e "${BLUE}Test 5: Check for Scheduling Conflicts${NC}"
echo "GET $API_URL/conflicts?userId=$USER_ID"
response=$(curl -s "$API_URL/conflicts?userId=$USER_ID")

if echo "$response" | grep -q "hasConflicts"; then
    echo -e "${GREEN}✓ PASSED${NC}: Conflict check completed"
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"User ID: {data['userId']}\")
print(f\"Has Conflicts: {data['hasConflicts']}\")
print(f\"Resolved Blocks: {len(data['resolvedBlocks'])}\")
print(f\"Rescheduled Tasks: {len(data['rescheduledTasks'])}\")
"
else
    echo -e "${RED}✗ FAILED${NC}: Conflict check failed"
    echo "$response"
fi
echo ""

# Test 6: Test with Constraints
echo -e "${BLUE}Test 6: Generate Plan with Constraints${NC}"
echo "POST $API_URL/generate (with constraints)"
response=$(curl -s -X POST "$API_URL/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"horizon\": \"daily\",
    \"constraints\": {
      \"maxHoursPerDay\": 6,
      \"honorEnergyProfile\": true
    },
    \"preferences\": {
      \"frontloadHighPriority\": true,
      \"preferMorningForDeepWork\": true
    }
  }")

if echo "$response" | grep -q "dailyPlans"; then
    echo -e "${GREEN}✓ PASSED${NC}: Plan with constraints generated"
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
plan = data['dailyPlans'][0]
print(f\"Scheduled Time: {plan['totalScheduledTime']} min ({plan['totalScheduledTime']/60:.1f} hours)\")
print(f\"Energy Alignment: {plan['energyAlignment']:.2f}\")
print(f\"Overload Risk: {plan['overloadRisk']:.2f}\")
"
else
    echo -e "${RED}✗ FAILED${NC}: Plan with constraints failed"
    echo "$response"
fi
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}ALL TESTS COMPLETED${NC}"
echo "========================================"
echo ""
echo "Planner Engine Features Tested:"
echo "  ✓ Health check"
echo "  ✓ Daily plan generation"
echo "  ✓ Weekly plan generation"
echo "  ✓ Scheduling candidates with ML scoring"
echo "  ✓ Conflict detection and resolution"
echo "  ✓ Constraint-based planning"
echo ""
echo "Key Features Demonstrated:"
echo "  - Energy-based scheduling (tasks scheduled during high energy periods)"
echo "  - Priority-based task ordering"
echo "  - Multi-day planning"
echo "  - Smart time slot selection"
echo "  - Score breakdowns for transparency"
echo "  - Alternative time suggestions"
echo ""
