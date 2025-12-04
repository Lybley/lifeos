## Permission & Consent System - Complete Guide

## Overview

The LifeOS Permission & Consent System provides granular control over data access with:
- **11 permission scopes** covering all data types
- **4 risk levels** (low, medium, high, critical)
- **Complete audit trail** of all permission changes
- **Consent versioning** for compliance
- **Automatic expiration** of time-limited permissions
- **Middleware enforcement** at all access points

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Ingestion │ │   RAG    │ │  Agent   │ │  Action  │      │
│  │  Layer   │ │  Layer   │ │  Layer   │ │  Layer   │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│              Permission Middleware Layer                     │
│  ┌──────────────────────────────────────────────────┐      │
│  │   requireIngestionPermission()                    │      │
│  │   requireRAGPermission()                         │      │
│  │   requireAgentPermission()                       │      │
│  │   requireActionPermission()                      │      │
│  └──────────────────────────────────────────────────┘      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Permission Service                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │  hasPermission() → Database Query                │      │
│  │  grantPermission() → Audit Log                   │      │
│  │  revokePermission() → Audit Log                  │      │
│  │  logUsage() → Track Access                       │      │
│  └──────────────────────────────────────────────────┘      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ permissions  │ │consent_audit │ │    scope     │       │
│  │    table     │ │   _log       │ │ definitions  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Permission Scopes

### Email Permissions
| Scope | Risk | Description | Default |
|-------|------|-------------|---------|
| `emails.full` | medium | Full email content access | ✅ Enabled |
| `emails.metadata` | low | Headers only (from, to, subject) | ✅ Enabled |

### File Permissions
| Scope | Risk | Description | Default |
|-------|------|-------------|---------|
| `files.full` | medium | Full file content access | ✅ Enabled |
| `files.metadata` | low | Filenames, sizes, dates only | ✅ Enabled |

### Calendar Permissions
| Scope | Risk | Description | Default |
|-------|------|-------------|---------|
| `calendar.read` | low | View calendar events | ✅ Enabled |
| `calendar.write` | medium | Create/modify events | ✅ Enabled (requires explicit consent) |

### Other Permissions
| Scope | Risk | Description | Default |
|-------|------|-------------|---------|
| `messages.read` | medium | Read chat messages | ✅ Enabled |
| `contacts.read` | low | Access contact info | ✅ Enabled |
| `health.read` | high | Health/fitness data | ❌ Disabled (requires explicit consent) |
| `purchases.read` | critical | View purchase history | ❌ Disabled (requires explicit consent) |
| `purchases.write` | critical | Execute purchases | ❌ Disabled (requires explicit consent) |

---

## Database Setup

### 1. Run Migrations

```bash
cd /app/backend
psql -U lifeos_user -d lifeos -f migrations/001_create_permissions_tables.sql
```

### 2. Verify Tables Created

```sql
-- Check tables
\dt

-- Should see:
-- permissions
-- consent_audit_log
-- scope_definitions
-- permission_dependencies

-- Check functions
\df

-- Should see:
-- has_permission
-- grant_permission
-- revoke_permission
-- expire_permissions
-- log_permission_usage
```

---

## Backend Integration

### 1. Initialize Permission Service

```typescript
// In server.ts
import { Pool } from 'pg';
import { PermissionService } from './permissions/PermissionService';

const db = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

const permissionService = new PermissionService(db);
app.set('permissionService', permissionService);

// Setup periodic expiration check
setInterval(async () => {
  await permissionService.expirePermissions();
}, 60000); // Every minute
```

### 2. Add Permission Routes

```typescript
import permissionRoutes from './routes/permissions';

app.use('/api/permissions', permissionRoutes);
```

### 3. Use Middleware in Routes

#### Data Ingestion

```typescript
import { requireIngestionPermission } from './permissions/PermissionMiddleware';

// Gmail sync
app.post('/api/sync/gmail', 
  requireIngestionPermission('emails'),
  async (req, res) => {
    // Sync logic here
  }
);

// File sync
app.post('/api/sync/files',
  requireIngestionPermission('files'),
  async (req, res) => {
    // Sync logic here
  }
);
```

#### RAG Queries

```typescript
import { requireRAGPermission } from './permissions/PermissionMiddleware';

app.post('/api/chat',
  requireRAGPermission(),
  async (req, res) => {
    // RAG logic here
  }
);
```

#### Action Execution

```typescript
import { requireActionPermission } from './permissions/PermissionMiddleware';

app.post('/api/actions/execute',
  async (req, res) => {
    const { actionType } = req.body;
    
    // Apply permission check based on action type
    const middleware = requireActionPermission(actionType);
    return middleware(req, res, async () => {
      // Execute action
    });
  }
);
```

#### Agent Execution

```typescript
import { requireAgentPermission } from './permissions/PermissionMiddleware';

app.post('/api/agent/run',
  async (req, res) => {
    const { capabilities } = req.body;
    
    const middleware = requireAgentPermission(capabilities);
    return middleware(req, res, async () => {
      // Run agent
    });
  }
);
```

### 4. Service Layer Permission Checks

```typescript
import { checkPermissionInService } from './permissions/PermissionMiddleware';
import { PermissionScope } from './permissions/types';

class EmailService {
  constructor(private permissionService: PermissionService) {}
  
  async syncEmails(userId: string) {
    // Check permission in service
    await checkPermissionInService(
      this.permissionService,
      userId,
      [PermissionScope.EMAILS_FULL, PermissionScope.EMAILS_METADATA],
      'sync_emails'
    );
    
    // Check which level of access
    const hasFull = await this.permissionService.hasPermission(
      userId,
      PermissionScope.EMAILS_FULL
    );
    
    if (hasFull.allowed) {
      // Sync full email content
    } else {
      // Sync only metadata
    }
  }
}
```

---

## Frontend Integration

### 1. Permission Manager Component

```tsx
import { PermissionManager } from '@/components/PermissionManager';

function SettingsPage() {
  return (
    <div>
      <h1>Privacy Settings</h1>
      <PermissionManager />
    </div>
  );
}
```

### 2. Individual Permission Toggle

```tsx
import { PermissionToggle } from '@/components/PermissionToggle';

function DataAccessSettings() {
  const handleToggle = async (scope: string, enabled: boolean) => {
    if (enabled) {
      await fetch('/api/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
    } else {
      await fetch('/api/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
    }
  };
  
  return (
    <PermissionToggle
      scope="emails.full"
      name="Full Email Access"
      description="Allow LifeOS to read and search full email content"
      riskLevel="medium"
      enabled={true}
      requiresExplicitConsent={false}
      onToggle={handleToggle}
    />
  );
}
```

### 3. Check Permission Before Feature Access

```typescript
async function checkFeatureAccess(scope: string) {
  const response = await fetch('/api/permissions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope })
  });
  
  const result = await response.json();
  
  if (!result.allowed) {
    // Show permission request dialog
    showPermissionDialog(scope);
  } else {
    // Feature allowed
    return true;
  }
}
```

---

## API Reference

### GET `/api/permissions/scopes`
Get all available permission scopes.

**Response**:
```json
{
  "scopes": [
    {
      "scope": "emails.full",
      "name": "Full Email Access",
      "description": "Read and search full email content",
      "category": "email",
      "riskLevel": "medium",
      "defaultEnabled": true,
      "requiresExplicitConsent": false,
      "version": "v1",
      "scopeHash": "abc123..."
    }
  ]
}
```

### GET `/api/permissions/user/permissions`
Get user's permissions.

**Query Params**:
- `status`: Filter by status (active/revoked/expired)

**Response**:
```json
{
  "permissions": [
    {
      "id": "uuid",
      "userId": "user-123",
      "scope": "emails.metadata",
      "status": "active",
      "grantedAt": "2024-12-01T00:00:00Z",
      "expiresAt": null,
      "consentVersion": "v1"
    }
  ]
}
```

### POST `/api/permissions/grant`
Grant permission to current user.

**Body**:
```json
{
  "scope": "emails.full",
  "expiresAt": "2025-12-01T00:00:00Z", // optional
  "reason": "User requested" // optional
}
```

**Response**:
```json
{
  "success": true,
  "permissionId": "uuid",
  "message": "Permission granted"
}
```

### POST `/api/permissions/revoke`
Revoke permission from current user.

**Body**:
```json
{
  "scope": "emails.full",
  "reason": "User requested" // optional
}
```

### POST `/api/permissions/revoke/all`
Revoke all permissions for current user.

**Body**:
```json
{
  "reason": "User requested data deletion"
}
```

### GET `/api/permissions/audit-log`
Get audit log for current user.

**Query Params**:
- `limit`: Max records (default: 50)
- `offset`: Skip records (default: 0)
- `action`: Filter by action (granted/revoked/used)
- `scope`: Filter by scope

**Response**:
```json
{
  "auditLog": [
    {
      "id": "uuid",
      "userId": "user-123",
      "action": "granted",
      "scope": "emails.full",
      "timestamp": "2024-12-01T00:00:00Z",
      "reason": "User requested"
    }
  ]
}
```

---

## Testing

### Run Tests

```bash
cd /app/backend
npm test tests/permissions.test.ts
```

### Test Coverage

- ✅ Scope definitions loading
- ✅ Permission granting (single & bulk)
- ✅ Permission checking (single & multiple)
- ✅ Permission revocation
- ✅ Automatic expiration
- ✅ Audit logging
- ✅ Consent versioning
- ✅ Permission summary

### Manual Testing

```bash
# Grant permission
curl -X POST http://localhost:8001/api/permissions/grant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"scope": "emails.full"}'

# Check permission
curl -X POST http://localhost:8001/api/permissions/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"scope": "emails.full"}'

# List permissions
curl http://localhost:8001/api/permissions/user/permissions \
  -H "Authorization: Bearer YOUR_JWT"

# Revoke permission
curl -X POST http://localhost:8001/api/permissions/revoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"scope": "emails.full", "reason": "Testing"}'
```

---

## Security Best Practices

### 1. High-Risk Permissions
- **ALWAYS** require explicit user consent for:
  - `health.read`
  - `purchases.read`
  - `purchases.write`
- Show clear explanation of what data will be accessed
- Provide opt-out mechanism

### 2. Time-Limited Permissions
For sensitive operations, grant time-limited permissions:
```typescript
await permissionService.grantPermission(
  userId,
  PermissionScope.PURCHASES_WRITE,
  {
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    reason: 'Temporary access for purchase'
  }
);
```

### 3. Audit Everything
Log ALL permission usage:
```typescript
await permissionService.logUsage(
  userId,
  scope,
  {
    operation: 'read_emails',
    count: 10,
    source: 'rag_query'
  }
);
```

### 4. Regular Expiration
Run expiration check regularly:
```typescript
// Every minute
setInterval(async () => {
  const expired = await permissionService.expirePermissions();
  if (expired > 0) {
    logger.info(`Expired ${expired} permissions`);
  }
}, 60000);
```

### 5. Least Privilege
Always check for the minimum required permission:
```typescript
// Prefer metadata access over full access
const scopes = [
  PermissionScope.EMAILS_METADATA,
  PermissionScope.EMAILS_FULL
];

// Check in order of least to most privileged
for (const scope of scopes) {
  const result = await permissionService.hasPermission(userId, scope);
  if (result.allowed) {
    // Use this level
    break;
  }
}
```

---

## Compliance

### GDPR Compliance
- ✅ User can view all permissions
- ✅ User can revoke any permission
- ✅ Complete audit trail maintained
- ✅ Data export includes permissions
- ✅ Consent versioning for updates

### CCPA Compliance
- ✅ Opt-out mechanism (revoke)
- ✅ Data access transparency
- ✅ Audit log retention

---

## Troubleshooting

### Permission Check Fails
```bash
# Check if permission exists
SELECT * FROM permissions 
WHERE user_id = 'user-123' 
  AND scope = 'emails.full' 
  AND status = 'active';

# Check if expired
SELECT * FROM permissions 
WHERE user_id = 'user-123' 
  AND expires_at < NOW();
```

### Audit Log Not Recording
```bash
# Check trigger exists
\df log_permission_usage

# Manually test
SELECT log_permission_usage(
  'user-123', 
  'emails.full'::permission_scope,
  '{}'::jsonb
);
```

### Permission Dependencies
```bash
# Check dependencies
SELECT * FROM permission_dependencies;

# Grant parent permission
-- Will automatically check dependencies
```

---

## Migration Guide

### Migrating Existing Users

```typescript
async function migrateExistingUsers() {
  const users = await db.query('SELECT id FROM users');
  
  for (const user of users.rows) {
    // Grant default permissions
    await permissionService.grantPermissions(
      user.id,
      {
        scopes: [
          PermissionScope.EMAILS_METADATA,
          PermissionScope.FILES_METADATA,
          PermissionScope.CALENDAR_READ
        ]
      }
    );
  }
}
```

---

## Support

For questions or issues:
- **Email**: security@lifeos.io
- **Docs**: `/app/docs/PERMISSION_SYSTEM_GUIDE.md`
- **Tests**: `/app/backend/tests/permissions.test.ts`

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Status**: ✅ Production Ready
