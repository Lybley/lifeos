# TaskExtractor Agent - Complete Guide

## Overview

The **TaskExtractor Agent** is an AI-powered pipeline that automatically identifies and extracts actionable tasks from messages, emails, meeting notes, and documents.

### Key Features

✅ **Intelligent Extraction**: Uses LLM to identify tasks with context
✅ **Confidence Scoring**: 0.5-1.0 scale with automatic thresholds
✅ **Structured Output**: task_text, due_date, assignee, confidence
✅ **Human-in-the-Loop**: Low confidence items require confirmation
✅ **Dual Storage**: PostgreSQL (metadata) + Neo4j (graph relationships)
✅ **Preview UI**: Accept/reject interface before persisting

---

## Architecture

```
Input (Message/Document)
    ↓
[1. LLM Extraction]
    ├─ Task identification
    ├─ Due date extraction
    ├─ Assignee detection
    └─ Confidence scoring
    ↓
[2. Temporary Storage]
    └─ task_extractions table (pending)
    ↓
[3. Preview Generation]
    └─ UI payload with accept/reject options
    ↓
[User Decision]
    ├─ Accept All
    ├─ Accept Selected
    └─ Reject All
    ↓
[4. Persist Tasks]
    ├─ PostgreSQL (tasks table)
    └─ Neo4j (Task nodes + relationships)
```

---

## API Endpoints

### 1. Extract Tasks

**Endpoint:** `POST /api/v1/tasks/extract`

**Request:**
```json
{
  "user_id": "user_123",
  "text": "Hi Sarah, please review the API docs by Friday. John needs to complete the security audit by next week.",
  "metadata": {
    "source_id": "email_001",
    "source_type": "email",
    "sender": "manager@company.com",
    "sender_email": "manager@company.com",
    "subject": "Weekly Tasks",
    "date": "2024-03-10"
  }
}
```

**Response:**
```json
{
  "extraction_id": "extract_abc123",
  "tasks": [
    {
      "task_text": "Review API documentation",
      "due_date": "2024-03-15",
      "assignee": "Sarah",
      "confidence": 0.95,
      "source_id": "email_001",
      "context": "Hi Sarah, please review the API docs by Friday"
    },
    {
      "task_text": "Complete security audit",
      "due_date": "2024-03-17",
      "assignee": "John",
      "confidence": 0.92,
      "source_id": "email_001",
      "context": "John needs to complete the security audit by next week"
    }
  ],
  "preview": [
    {
      "preview_id": "prev_1",
      "task_text": "Review API documentation",
      "due_date": "2024-03-15",
      "assignee": "Sarah",
      "confidence": 0.95,
      "confidence_label": "high",
      "requires_confirmation": false,
      "context": "Hi Sarah, please review the API docs by Friday",
      "source_id": "email_001"
    },
    {
      "preview_id": "prev_2",
      "task_text": "Complete security audit",
      "due_date": "2024-03-17",
      "assignee": "John",
      "confidence": 0.92,
      "confidence_label": "high",
      "requires_confirmation": false,
      "context": "John needs to complete the security audit by next week",
      "source_id": "email_001"
    }
  ],
  "metadata": {
    "total_tasks": 2,
    "high_confidence": 2,
    "requires_confirmation": 0,
    "auto_accept_count": 2,
    "source_id": "email_001",
    "extracted_at": "2024-03-10T14:30:00.000Z"
  },
  "accept_changes_payload": {
    "extraction_id": "extract_abc123",
    "action": "accept_all"
  }
}
```

---

### 2. Accept Tasks

**Endpoint:** `POST /api/v1/tasks/accept`

**Request (Accept All):**
```json
{
  "user_id": "user_123",
  "extraction_id": "extract_abc123",
  "action": "accept_all"
}
```

**Request (Accept Selected):**
```json
{
  "user_id": "user_123",
  "extraction_id": "extract_abc123",
  "action": "accept_selected",
  "selected_task_ids": ["preview_1", "preview_3"]
}
```

**Request (Reject All):**
```json
{
  "user_id": "user_123",
  "extraction_id": "extract_abc123",
  "action": "reject_all"
}
```

**Response:**
```json
{
  "success": true,
  "accepted": 2,
  "task_ids": ["task_uuid_1", "task_uuid_2"]
}
```

---

### 3. Get User Tasks

**Endpoint:** `GET /api/v1/tasks?user_id=USER_ID`

**Query Parameters:**
- `user_id` (required): User identifier
- `status` (optional): pending, in_progress, completed, cancelled
- `assignee` (optional): Filter by assignee name
- `due_before` (optional): ISO date (e.g., 2024-03-15)

**Example:**
```bash
curl "http://localhost:8000/api/v1/tasks?user_id=user_123&status=pending&due_before=2024-03-20"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "tasks": [
    {
      "task_id": "task_uuid_1",
      "task_text": "Review API documentation",
      "due_date": "2024-03-15",
      "assignee": "Sarah",
      "status": "pending",
      "confidence": 0.95,
      "source_id": "email_001",
      "created_at": "2024-03-10T14:30:00.000Z",
      "created_by": "user_123"
    }
  ]
}
```

---

### 4. List Pending Extractions

**Endpoint:** `GET /api/v1/tasks/pending-extractions?user_id=USER_ID`

**Response:**
```json
{
  "success": true,
  "count": 1,
  "extractions": [
    {
      "extraction_id": "extract_abc123",
      "source_id": "email_001",
      "source_type": "email",
      "task_count": 2,
      "created_at": "2024-03-10T14:30:00.000Z"
    }
  ]
}
```

---

## Confidence Rules

### Confidence Levels

| Confidence | Label | Description | Auto-Accept | Requires Confirmation |
|------------|-------|-------------|-------------|------------------------|
| **0.9-1.0** | High | Explicit action, clear task | ✅ Yes | ❌ No |
| **0.7-0.89** | Medium | Clear intent, minor ambiguity | ❌ No | ✅ Yes |
| **0.5-0.69** | Low | Possible task, needs review | ❌ No | ✅ Yes |
| **< 0.5** | N/A | Not extracted (too ambiguous) | N/A | N/A |

### Rules Implementation

```typescript
CONFIDENCE_RULES = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  autoAcceptThreshold: 0.9,
  
  requiresHumanConfirmation: (confidence: number) => {
    return confidence < 0.8;
  },
  
  getConfidenceLabel: (confidence: number) => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  }
}
```

### Confidence Examples

**High Confidence (0.95):**
```
"Sarah, please review the Q1 report by Friday"
→ Clear assignee, explicit action, specific due date
```

**Medium Confidence (0.75):**
```
"We need to update the documentation"
→ Clear action, but no assignee or due date
```

**Low Confidence (0.60):**
```
"Maybe we should consider adding more tests"
→ Conditional language, uncertain commitment
```

**Not Extracted (< 0.5):**
```
"The meeting went well"
→ No actionable task
```

---

## LLM Prompt Template

### System Prompt

```
You are a TaskExtractor AI agent that identifies actionable tasks from communications and documents.

## Core Rules:

### 1. Task Identification
A task is ONLY something that:
✓ Requires a specific action to be completed
✓ Has a clear verb (review, complete, send, schedule)
✓ Is future-oriented or pending
✓ Can be verified as complete

NOT a task:
✗ General statements or observations
✗ Questions without explicit follow-up
✗ Past completed actions
✗ Hypothetical discussions

### 2. Extraction Rules

**Task Text:**
- Extract core action in clear, concise form
- Use imperative form: "Review Q1 report"
- Maximum 100 characters

**Due Date:**
- Only extract if EXPLICITLY mentioned
- Format as ISO 8601: "YYYY-MM-DD"
- Convert relative dates (tomorrow, next week)
- If vague ("soon", "ASAP"), set to null

**Assignee:**
- Only extract if EXPLICITLY mentioned
- Use full name if available
- "Everyone" or "Team" → set to null

**Confidence Scoring:**
- 0.9-1.0 (High): Explicit, clear, minimal ambiguity
- 0.7-0.89 (Medium): Clear intent, some ambiguity
- 0.5-0.69 (Low): Possible task, unclear
- Below 0.5: Don't extract

### 3. Output Format (JSON):

[
  {
    "task_text": "Review Q1 report",
    "due_date": "2024-03-15",
    "assignee": "Sarah",
    "confidence": 0.95,
    "source_id": "email_123",
    "context": "Please review before Friday meeting"
  }
]
```

### User Prompt Template

```
## Input Document

**Source Type:** email
**Source ID:** email_001
**Date:** 2024-03-10
**Sender:** manager@company.com

**Content:**
[User's text here]

## Instructions

Today's date: 2024-03-10

Extract ALL actionable tasks. For each:
1. Identify core action (task_text)
2. Extract due date if mentioned
3. Extract assignee if mentioned
4. Assign confidence (0.5-1.0)
5. Include brief context

Return JSON array. If no tasks, return [].
```

---

## Example Workflows

### Example 1: Email Processing

**Input:**
```
Hi team,

Quick update on this week's tasks:

1. Sarah - Please review the API documentation by Wednesday
2. John - Complete security audit by Friday
3. Everyone - Review deployment checklist (no rush)
4. Mike - Can you schedule the Q2 planning meeting?

Thanks!
```

**Extracted Tasks:**
```json
[
  {
    "task_text": "Review API documentation",
    "due_date": "2024-03-13",
    "assignee": "Sarah",
    "confidence": 0.95,
    "context": "Sarah - Please review the API documentation by Wednesday"
  },
  {
    "task_text": "Complete security audit",
    "due_date": "2024-03-15",
    "assignee": "John",
    "confidence": 0.95,
    "context": "John - Complete security audit by Friday"
  },
  {
    "task_text": "Review deployment checklist",
    "due_date": null,
    "assignee": null,
    "confidence": 0.80,
    "context": "Everyone - Review deployment checklist (no rush)"
  },
  {
    "task_text": "Schedule Q2 planning meeting",
    "due_date": null,
    "assignee": "Mike",
    "confidence": 0.90,
    "context": "Mike - Can you schedule the Q2 planning meeting?"
  }
]
```

**Preview UI:**
- Task 1 & 2: ✅ Auto-accept (confidence ≥ 0.9)
- Task 3: ⚠️ Requires confirmation (confidence 0.80)
- Task 4: ✅ Auto-accept (confidence 0.90)

---

### Example 2: Meeting Notes

**Input:**
```
Sprint Planning - March 10, 2024

Discussed:
- API redesign progress
- John will finish authentication module this week
- We should probably update the user docs
- Consider adding integration tests

Decisions:
- Daily standups at 10 AM starting tomorrow
- Code review within 24 hours (team commitment)
```

**Extracted Tasks:**
```json
[
  {
    "task_text": "Finish authentication module",
    "due_date": "2024-03-17",
    "assignee": "John",
    "confidence": 0.92,
    "context": "John will finish authentication module this week"
  },
  {
    "task_text": "Update user documentation",
    "due_date": null,
    "assignee": null,
    "confidence": 0.70,
    "context": "We should probably update the user docs"
  },
  {
    "task_text": "Add integration tests",
    "due_date": null,
    "assignee": null,
    "confidence": 0.60,
    "context": "Consider adding integration tests"
  }
]
```

**Confidence Analysis:**
- Task 1: High (0.92) - Clear commitment with timeline
- Task 2: Medium (0.70) - "Should probably" indicates uncertainty
- Task 3: Low (0.60) - "Consider" is exploratory

---

## Database Schema

### PostgreSQL Tables

**task_extractions** (temporary storage):
```sql
CREATE TABLE task_extractions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  source_id VARCHAR(255),
  source_type VARCHAR(50),
  tasks JSONB,
  input_metadata JSONB,
  status VARCHAR(20), -- pending, accepted, rejected
  created_at TIMESTAMP,
  processed_at TIMESTAMP
);
```

**tasks** (persisted tasks):
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  task_text TEXT,
  due_date DATE,
  assignee VARCHAR(255),
  status VARCHAR(20), -- pending, in_progress, completed, cancelled
  confidence FLOAT,
  source_id VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Neo4j Schema

**Task Node:**
```cypher
CREATE (t:Task {
  id: "task_uuid",
  task_text: "Review API docs",
  due_date: "2024-03-15",
  assignee: "Sarah",
  status: "pending",
  confidence: 0.95
})
```

**Relationships:**
```cypher
// User owns task
(User)-[:OWNS]->(Task)

// Task extracted from source
(Task)-[:EXTRACTED_FROM]->(Document|Message|Event)

// Task assigned to person
(Task)-[:ASSIGNED_TO]->(Person)
```

---

## Testing

### Run Unit Tests

```bash
cd /app/backend
npm test -- taskExtractor.test.ts
```

### Test Coverage

- ✅ Prompt generation
- ✅ Response parsing
- ✅ Confidence rules
- ✅ Edge cases (long text, special chars, nulls)
- ✅ Integration examples

### Sample Test Cases

See `/app/backend/src/services/agents/__tests__/taskExtractor.test.ts`

---

## Best Practices

### 1. Input Quality

✅ **Good:**
- Include sender information
- Provide accurate dates
- Use source_type for context

❌ **Avoid:**
- Very long documents (>5000 chars)
- Incomplete metadata

### 2. Confidence Threshold Tuning

**Conservative (Higher Quality):**
```typescript
autoAcceptThreshold: 0.95  // Only accept very clear tasks
```

**Aggressive (More Automation):**
```typescript
autoAcceptThreshold: 0.85  // Accept more tasks automatically
```

### 3. Human Review Workflow

**Recommended:**
1. Auto-accept high confidence (≥ 0.9)
2. Present medium/low for review (< 0.9)
3. Allow batch accept/reject
4. Provide edit capability

---

## Troubleshooting

### Issue: No tasks extracted from obvious email

**Check:**
- Is the language clear and action-oriented?
- Are verbs present?
- Is it future-oriented?

**Solution:**
- Rephrase input to be more explicit
- Check LLM temperature (should be low, e.g., 0.1)

### Issue: Wrong due dates

**Check:**
- Is reference date correct in metadata?
- Are relative dates clear ("Friday" vs "next Friday")?

**Solution:**
- Always provide `metadata.date` for context
- Use explicit dates when possible

### Issue: Tasks with null assignee

**Check:**
- Is assignee explicitly mentioned?
- Is "team" or "everyone" used?

**Expected:**
- Generic assignments result in null (by design)
- LLM won't guess assignees

---

## Future Enhancements

- [ ] **Priority extraction** from keywords (urgent, ASAP)
- [ ] **Task dependencies** detection
- [ ] **Recurring tasks** identification
- [ ] **Task categorization** (bug, feature, review)
- [ ] **Integration triggers** (auto-create Jira tickets)
- [ ] **Natural language queries** ("What are my urgent tasks?")

---

## License

MIT
