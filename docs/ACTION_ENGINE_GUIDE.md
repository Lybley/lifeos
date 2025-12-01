# Action Engine Guide

## Overview

The Action Engine is a robust system designed to safely execute AI-generated actions with human-in-the-loop approval, safety checks, rate limiting, audit logging, and rollback capabilities.

## Architecture

```
┌─────────────────┐
│   AI Agent      │
│  (Task/Draft)   │
└────────┬────────┘
         │ Creates Action
         ▼
┌─────────────────┐
│ Safety Checks   │
│ - Rate Limits   │
│ - Approval Req  │
│ - Blocked Rules │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Action Queue   │
│   (BullMQ)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Approval Flow   │ ────▶│ Email/UI     │
│ (if required)   │      │ Notification │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│ Action Worker   │
│  - Validates    │
│  - Executes     │
│  - Logs         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ External APIs   │
│ (Calendar/Email)│
└─────────────────┘
```

## Components

### 1. Database Schema (`schemas.sql`)

**Tables:**
- `actions` - Stores all actions and their states
- `action_audit_logs` - Complete audit trail
- `action_rate_limits` - Rate limiting counters
- `action_safety_rules` - Configurable safety policies
- `action_rollback_history` - Rollback attempts log

### 2. Type Definitions (`types.ts`)

**Action Types:**
- `create_calendar_event` - Create calendar entries
- `send_email` - Send emails
- `move_file` - Move or rename files
- `create_document` - Create new documents
- `make_payment` - Payment actions (blocked by default)
- `make_purchase` - Purchase actions (requires KYC)

**Action Status:**
- `pending` - Awaiting approval
- `approved` - Approved, ready for execution
- `rejected` - Rejected by user
- `executing` - Currently being executed
- `completed` - Successfully completed
- `failed` - Execution failed
- `rolled_back` - Action was rolled back

### 3. Safety Checks (`safetyChecks.ts`)

**Safety Rule Types:**
- `blocked` - Action type is completely disabled
- `requires_approval` - Needs human approval
- `requires_kyc` - Needs KYC verification
- `rate_limit` - Rate limiting rules

**Default Rules:**
- Email: 50/hour, 500/day
- Calendar: 100/day
- Documents: 200/day
- File moves: Requires approval
- Payments: Blocked
- Purchases: KYC required

### 4. Action Handlers (`actionHandlers.ts`)

Each action type has a handler implementing:
- `validate(payload)` - Validate action parameters
- `execute(payload)` - Execute the action
- `rollback(rollbackData)` - Undo the action

**Current Handlers:**
- `CreateCalendarEventHandler`
- `SendEmailHandler`
- `MoveFileHandler`
- `CreateDocumentHandler`

> **Note:** Handlers are currently using simulated API calls. In production, these would integrate with real services (Google Calendar, SendGrid, etc.).

### 5. Worker (`worker.ts`)

The worker processes actions from the queue:
1. Checks if action requires approval
2. Validates payload
3. Executes action via handler
4. Logs result to audit trail
5. Updates action status
6. Handles retries (up to 3 attempts)

**Concurrency:** 5 actions can be processed simultaneously.

### 6. Email Service (`emailService.ts`)

Sends approval emails with:
- Action details
- Approve/Reject links with secure tokens
- 24-hour expiration
- HTML and plain text formats

> **Note:** Currently logs emails to console. In production, integrate with SendGrid, AWS SES, or similar.

### 7. API Routes (`routes/actions.ts`)

**Endpoints:**

#### Create Action
```
POST /api/actions
Body: {
  "user_id": "user123",
  "action_type": "create_calendar_event",
  "payload": { ... },
  "priority": 5,
  "scheduled_for": "2024-01-15T10:00:00Z"
}
```

#### Approve Action
```
POST /api/actions/:actionId/approve
Body: { "approved_by": "user123" }

GET /api/actions/approve?token=xxx  (via email link)
```

#### Reject Action
```
POST /api/actions/:actionId/reject
Body: {
  "rejected_by": "user123",
  "reason": "Not needed"
}

GET /api/actions/reject?token=xxx  (via email link)
```

#### Rollback Action
```
POST /api/actions/:actionId/rollback
Body: {
  "rolled_back_by": "user123",
  "reason": "Incorrect data"
}
```

#### Get Action Details
```
GET /api/actions/:actionId
GET /api/actions/:actionId/audit
GET /api/actions/user/:userId?limit=50&offset=0
```

#### Rate Limits
```
GET /api/actions/rate-limits/:userId/:actionType
```

## Usage Examples

### 1. Creating a Calendar Event

```typescript
const response = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user123',
    action_type: 'create_calendar_event',
    payload: {
      title: 'Team Meeting',
      description: 'Weekly sync',
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
      attendees: ['alice@example.com', 'bob@example.com'],
      location: 'Conference Room A'
    },
    priority: 5
  })
});

const result = await response.json();
// {
//   success: true,
//   action_id: "uuid",
//   requires_approval: true,
//   approval_token: "token",
//   message: "Action created and awaiting approval"
// }
```

### 2. Sending an Email

```typescript
await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user123',
    action_type: 'send_email',
    payload: {
      to: ['recipient@example.com'],
      subject: 'Meeting Follow-up',
      body: 'Thank you for attending the meeting...',
      html: '<p>Thank you for attending the meeting...</p>'
    }
  })
});
```

### 3. Checking Rate Limits

```typescript
const response = await fetch('/api/actions/rate-limits/user123/send_email');
const data = await response.json();
// {
//   success: true,
//   rate_limits: [
//     { rule: 'hourly_limit', current: 23, limit: 50, window: '1 hour' },
//     { rule: 'daily_limit', current: 145, limit: 500, window: '1 day' }
//   ]
// }
```

### 4. Rolling Back an Action

```typescript
await fetch('/api/actions/abc123/rollback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rolled_back_by: 'user123',
    reason: 'Incorrect meeting time'
  })
});
```

## Configuration

### Environment Variables

```bash
# Base URL for approval links
BASE_URL=https://your-domain.com

# Database (PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lifeos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis (for queue and rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Security Considerations

1. **Approval Tokens:** 
   - Generated using UUIDs
   - Expire after 24 hours
   - One-time use only

2. **Rate Limiting:**
   - Redis-based for high performance
   - Per-user, per-action-type
   - Configurable windows and limits

3. **Audit Trail:**
   - Every action logged with IP and user agent
   - Immutable audit logs
   - Tracks entire lifecycle

4. **Fail-Safe:**
   - If safety checks fail, action is blocked
   - Failed rate limit checks allow action (fail open)
   - Rollback attempts are logged even if they fail

## Integration with AI Agents

### From Task Extractor Agent

```typescript
// After extracting a task, create a calendar event
const action = await createAction(
  userId,
  'create_calendar_event',
  {
    title: task.title,
    description: task.description,
    start_time: task.deadline,
    end_time: new Date(task.deadline.getTime() + 60*60*1000).toISOString()
  }
);
```

### From Drafting Agent

```typescript
// After drafting an email reply
const action = await createAction(
  userId,
  'send_email',
  {
    to: [originalMessage.from],
    subject: `Re: ${originalMessage.subject}`,
    body: draftedReply
  }
);
```

## Testing

### Manual Testing with cURL

```bash
# Create an action
curl -X POST http://localhost:8000/api/actions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "action_type": "create_calendar_event",
    "payload": {
      "title": "Test Event",
      "start_time": "2024-01-15T10:00:00Z",
      "end_time": "2024-01-15T11:00:00Z"
    }
  }'

# Get action status
curl http://localhost:8000/api/actions/:actionId

# Approve action
curl -X POST http://localhost:8000/api/actions/:actionId/approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "user123"}'
```

## Production Checklist

Before deploying to production:

- [ ] Integrate real email service (SendGrid/SES)
- [ ] Implement actual calendar API integration
- [ ] Set up KYC verification system
- [ ] Configure database backups
- [ ] Set up monitoring and alerts
- [ ] Review and adjust rate limits
- [ ] Test rollback procedures
- [ ] Set up log aggregation
- [ ] Configure proper BASE_URL
- [ ] Review security settings
- [ ] Load test with expected volume
- [ ] Document incident response procedures

## Troubleshooting

### Actions stuck in pending
- Check if approval email was sent
- Verify approval token hasn't expired
- Check worker logs for errors

### Rate limits too restrictive
- Review `action_safety_rules` table
- Adjust limit values or windows
- Consider per-user vs global limits

### Actions failing execution
- Check `action_audit_logs` for error details
- Verify external API credentials
- Check handler validation logic
- Review retry configuration

## Future Enhancements

1. **Batch Actions:** Execute multiple related actions atomically
2. **Scheduled Actions:** Support for recurring/scheduled execution
3. **Action Templates:** Pre-configured action templates
4. **Approval Workflows:** Multi-step approval chains
5. **Action Dependencies:** Execute actions in sequence
6. **Webhooks:** Notify external systems of action events
7. **Analytics Dashboard:** Visualize action metrics
8. **Custom Handlers:** Plugin system for new action types

## Questions?

For implementation assistance or feature requests, refer to:
- `/app/backend/src/services/actionEngine/` - Source code
- `/app/backend/examples/` - Usage examples
- Audit logs in database for debugging
