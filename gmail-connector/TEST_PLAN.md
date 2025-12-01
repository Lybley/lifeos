# Gmail Connector - Test Plan

## Overview

This test plan covers the Gmail connector microservice, with particular focus on rate limit handling, retry logic, and OAuth flow.

---

## 1. OAuth Flow Testing

### 1.1 Initial Connection

**Test:** User connects Gmail account for the first time

**Steps:**
1. Navigate to `/auth/google?userId=test-user-001`
2. Complete Google OAuth consent screen
3. Verify redirect to callback with authorization code
4. Verify tokens stored in database
5. Verify initial sync job queued

**Expected Results:**
- OAuth tokens stored with valid `refresh_token`
- `oauth_tokens` table has entry for user
- `sync_status` table initialized
- Background job queued in Redis
- Success page displayed

**SQL Verification:**
```sql
SELECT * FROM oauth_tokens WHERE user_id = 'test-user-001';
SELECT * FROM sync_status WHERE user_id = 'test-user-001' AND integration_type = 'gmail';
```

### 1.2 Token Refresh

**Test:** Expired access token is automatically refreshed

**Setup:**
1. Manually expire access token in database:
```sql
UPDATE oauth_tokens 
SET expiry_date = NOW() - INTERVAL '1 hour'
WHERE user_id = 'test-user-001';
```

**Steps:**
1. Trigger sync: `POST /sync/start` with userId
2. Monitor logs for token refresh

**Expected Results:**
- Token refresh triggered automatically
- New access token stored
- Sync continues without error
- Log message: "Refreshing token for user test-user-001"
- Log message: "Successfully refreshed token for user test-user-001"

### 1.3 Refresh Token Invalid

**Test:** Handle case where refresh token is revoked

**Setup:**
1. Set invalid refresh token:
```sql
UPDATE oauth_tokens 
SET refresh_token = 'invalid_token'
WHERE user_id = 'test-user-001';
```

**Steps:**
1. Trigger sync
2. Verify graceful failure

**Expected Results:**
- Sync job fails with clear error message
- Token marked as invalid in database
- Error logged: "Token refresh failed. User must re-authenticate."
- User can re-authenticate via OAuth flow

---

## 2. Rate Limit Handling Tests

### 2.1 Per-Second Rate Limiting

**Test:** Verify rate limiter respects 25 requests/second limit

**Setup:**
- Configure: `GMAIL_QUOTA_PER_SECOND=25`
- Mock user with 1000 emails

**Steps:**
1. Start sync job
2. Monitor request timestamps in logs
3. Calculate requests per second

**Expected Results:**
- No more than 25 requests in any 1-second window
- Log messages: "Rate limit reached, waiting Xms"
- Requests spread evenly over time
- No 429 errors from Gmail API

**Monitoring Query:**
```javascript
// Count requests per second from logs
grep "Gmail API request" logs.txt | 
  awk '{print $1" "$2}' | 
  uniq -c
```

### 2.2 Daily Quota Management

**Test:** Handle daily quota exhaustion gracefully

**Scenario:** Gmail API returns 429 with quota exceeded

**Mock Response:**
```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

**Expected Results:**
- Job pauses and retries with exponential backoff
- Max retry delay: 60 seconds
- After max retries: job marked as failed
- Sync status updated with quota error
- Next sync scheduled for 24 hours later

### 2.3 Burst Rate Limiting

**Test:** Handle Gmail's per-user quota (250/user/second)

**Setup:**
- Configure: `GMAIL_QUOTA_USER_LIMIT=250`
- Simulate multiple concurrent users

**Steps:**
1. Start 5 sync jobs simultaneously
2. Monitor request distribution
3. Verify no single user exceeds 250 requests/second

**Expected Results:**
- Requests distributed across users
- No 429 errors
- Concurrent processing maintained
- Each user stays under quota

---

## 3. Retry Logic Tests

### 3.1 Transient Network Error

**Test:** Retry on network timeout

**Mock:** Simulate ETIMEDOUT error

**Expected Behavior:**
```
Attempt 1: ETIMEDOUT → Retry after 1s
Attempt 2: ETIMEDOUT → Retry after 2s
Attempt 3: ETIMEDOUT → Retry after 4s
Attempt 4: ETIMEDOUT → Retry after 8s
Attempt 5: ETIMEDOUT → Retry after 16s
Attempt 6: ETIMEDOUT → Fail (max retries)
```

**Verification:**
- Check log timestamps for exponential delays
- Verify backoff formula: `delay = min(initialDelay * 2^attempt, maxDelay)`
- Verify jitter applied (±25%)

### 3.2 Server Error (5xx)

**Test:** Retry on server errors

**Mock:** Gmail API returns 503 Service Unavailable

**Expected Results:**
- Retries up to 5 times
- Exponential backoff applied
- Jitter prevents thundering herd
- Clear error message after exhausting retries

### 3.3 Non-Retryable Error

**Test:** Don't retry on authentication errors

**Mock:** Gmail API returns 401 Unauthorized

**Expected Results:**
- No retries attempted
- Token marked as invalid
- User notified to re-authenticate
- Log message: "Non-retryable error"

### 3.4 Rate Limit with Retry-After Header

**Test:** Respect Retry-After header

**Mock Response:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 120
```

**Expected Results:**
- Wait exactly 120 seconds before retry
- Log message: "Rate limited. Waiting 120000ms as per Retry-After header"
- Subsequent request succeeds

---

## 4. Pagination Tests

### 4.1 Large Mailbox

**Test:** Handle mailbox with 10,000+ emails

**Setup:**
- User with 10,000 emails over 6 months
- Batch size: 100 messages per page

**Steps:**
1. Start initial sync
2. Monitor pagination through logs
3. Verify all messages fetched

**Expected Results:**
- ~100 pages fetched (10,000 / 100)
- Each page processed sequentially
- Progress updates: 10%, 20%, ... 100%
- All messages stored in database
- No duplicate messages

**Verification Query:**
```sql
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT gmail_message_id) as unique_messages
FROM gmail_messages
WHERE user_id = 'test-user-001';
-- total_messages should equal unique_messages
```

### 4.2 Page Token Handling

**Test:** Verify page token correctly passed

**Steps:**
1. Start sync
2. Capture page tokens from logs
3. Verify sequential pagination

**Expected Log Sequence:**
```
Fetched 100 messages (page token: has more)
Fetched 200 messages (page token: has more)
Fetched 300 messages (page token: has more)
...
Fetched 10000 messages (page token: done)
```

---

## 5. Message Processing Tests

### 5.1 Complete Message Flow

**Test:** Single message end-to-end processing

**Sample Email:**
```
From: alice@example.com
To: user@gmail.com
Subject: Test Email
Date: 2024-01-15 10:30:00
Body: This is a test email for PMG integration.
```

**Verification Steps:**

1. **PostgreSQL - nodes table:**
```sql
SELECT * FROM nodes 
WHERE neo4j_id LIKE 'msg-%' 
  AND metadata->>'gmail_id' = 'actual-gmail-id'
LIMIT 1;
```

Expected:
- `node_type = 'Message'`
- `title = 'Test Email'`
- `metadata` contains `from`, `to`, `gmail_id`

2. **Neo4j - Message node:**
```cypher
MATCH (m:Message {id: 'msg-xyz'})
RETURN m.subject, m.body, m.sent_at, m.platform
```

Expected:
- `subject = 'Test Email'`
- `platform = 'gmail'`
- `message_type = 'email'`

3. **Pinecone - Vector embedding:**
```javascript
const results = await index.query({
  vector: queryVector,
  topK: 10,
  filter: { gmail_id: 'actual-gmail-id' }
});
```

Expected:
- Vector stored with 1536 dimensions
- Metadata includes subject, from, date

4. **vector_embeddings table:**
```sql
SELECT * FROM vector_embeddings ve
JOIN nodes n ON ve.node_id = n.id
WHERE n.metadata->>'gmail_id' = 'actual-gmail-id';
```

Expected:
- `embedding_model = 'text-embedding-3-small'`
- `embedding_dimension = 1536`
- `pinecone_id` matches

### 5.2 HTML Email Parsing

**Test:** Extract plain text from HTML email

**Sample:**
```html
<html>
<body>
  <p>Hello <strong>World</strong>!</p>
  <img src="logo.png">
  <a href="http://example.com">Click here</a>
</body>
</html>
```

**Expected Body:**
```
Hello World!
Click here
```

**Verification:**
- HTML tags removed
- Links preserved as text (no href)
- Images skipped
- Line breaks maintained

### 5.3 Large Email Handling

**Test:** Handle emails with 50+ MB attachments

**Expected Results:**
- Body text extracted (attachments skipped)
- Embedding generated for text only
- No memory overflow
- Processing completes under 30 seconds

---

## 6. Concurrency Tests

### 6.1 Multiple Users

**Test:** Sync 10 users simultaneously

**Setup:**
- 10 test users with Gmail connected
- Each has ~1000 emails

**Steps:**
1. Queue sync jobs for all 10 users
2. Monitor worker concurrency
3. Verify no cross-contamination

**Expected Results:**
- Worker processes 2 users concurrently (configured limit)
- Each user's emails stored correctly
- No messages attributed to wrong user
- All 10 users complete within reasonable time

**Verification:**
```sql
SELECT 
    user_id,
    COUNT(*) as message_count
FROM gmail_messages
GROUP BY user_id
ORDER BY user_id;
```

### 6.2 Database Connection Pooling

**Test:** Verify connection pool doesn't exhaust

**Setup:**
- PostgreSQL pool size: 20
- Process 1000 messages

**Monitor:**
```sql
SELECT 
    count(*) as active_connections,
    max_conn
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') s
WHERE datname = 'lifeos';
```

**Expected:**
- Active connections stay under pool limit
- No "connection pool exhausted" errors
- Connections properly released after use

---

## 7. Error Recovery Tests

### 7.1 Database Connection Loss

**Test:** Handle temporary database outage

**Steps:**
1. Start sync job
2. Stop PostgreSQL mid-sync
3. Wait 30 seconds
4. Restart PostgreSQL
5. Resume sync

**Expected Results:**
- Job retries database operations
- No data loss
- Duplicate messages detected and skipped
- Sync completes successfully

### 7.2 Partial Batch Failure

**Test:** Handle failure in middle of batch

**Scenario:**
- Batch of 100 messages
- Message #47 fails (e.g., invalid encoding)

**Expected Results:**
- Messages 1-46: processed successfully
- Message 47: logged as failed, skipped
- Messages 48-100: continue processing
- Final count: 99 processed, 1 failed
- Failed message logged for manual review

---

## 8. Performance Tests

### 8.1 Throughput Measurement

**Metrics to Track:**
- Messages processed per second
- Average processing time per message
- API requests per second
- Memory usage over time

**Baseline Targets:**
- 10-20 messages/second (with embeddings)
- < 5 seconds per message (including API calls)
- < 25 Gmail API requests/second
- Memory stable (no leaks)

### 8.2 Large Dataset Test

**Test:** Initial sync of 50,000 emails

**Expected Duration:**
- 50,000 messages ÷ 15 msg/sec ≈ 55 minutes
- With batching and concurrency: 30-40 minutes

**Monitoring:**
```bash
# Watch progress
watch -n 5 'redis-cli llen gmail-sync:active'

# Check database growth
watch -n 10 'psql -c "SELECT COUNT(*) FROM gmail_messages"'
```

---

## 9. Integration Tests

### 9.1 End-to-End OAuth to Sync

**Complete Flow:**
1. User initiates OAuth: `GET /auth/google?userId=test-user`
2. User authorizes on Google
3. Callback processes tokens
4. Initial sync auto-queued
5. Worker processes emails
6. Messages appear in PMG

**Verification Checklist:**
- [ ] OAuth tokens stored
- [ ] Sync status created
- [ ] Job queued in Redis
- [ ] Worker picks up job
- [ ] Messages fetched from Gmail
- [ ] Embeddings generated
- [ ] Neo4j nodes created
- [ ] PostgreSQL metadata stored
- [ ] Pinecone vectors stored
- [ ] Sync status updated

### 9.2 Incremental Sync

**Test:** Second sync only fetches new messages

**Steps:**
1. Complete initial sync (all messages from 6 months)
2. Wait 1 hour
3. Send 5 new test emails to Gmail
4. Trigger incremental sync
5. Verify only 5 new messages processed

**Verification:**
```sql
SELECT 
    created_at,
    COUNT(*) as new_messages
FROM gmail_messages
WHERE user_id = 'test-user'
  AND created_at > NOW() - INTERVAL '2 hours'
GROUP BY created_at;
```

---

## 10. Monitoring & Alerting

### Key Metrics to Monitor

**Service Health:**
```bash
# Check service status
curl http://localhost:8002/health

# Check queue stats
curl http://localhost:8002/sync/stats
```

**Database Queries:**
```sql
-- Token expiry monitoring
SELECT 
    COUNT(*) as expiring_soon
FROM oauth_tokens
WHERE expiry_date < NOW() + INTERVAL '1 day'
  AND is_valid = true;

-- Sync health
SELECT 
    user_id,
    error_count,
    last_error
FROM sync_status
WHERE integration_type = 'gmail'
  AND error_count > 3;

-- Processing backlog
SELECT 
    sync_status,
    COUNT(*) as count
FROM gmail_messages
WHERE sync_status != 'completed'
GROUP BY sync_status;
```

**Alerts to Configure:**
1. Token expiry < 24 hours
2. Sync error count > 5
3. Queue depth > 1000 jobs
4. Processing time > 1 hour
5. Memory usage > 80%

---

## Test Automation

### Unit Tests
```bash
# Run unit tests
npm test

# Coverage
npm run test:coverage
```

### Integration Tests
```bash
# Test OAuth flow (mock)
npm run test:integration:oauth

# Test sync worker
npm run test:integration:sync

# Test rate limiter
npm run test:integration:rate-limit
```

### Load Tests
```bash
# Simulate 100 concurrent users
npm run test:load:oauth

# Simulate 10,000 emails sync
npm run test:load:sync
```

---

## Success Criteria

✅ OAuth flow completes without errors  
✅ Tokens refresh automatically  
✅ Rate limits respected (0 HTTP 429 errors)  
✅ Retry logic handles transient failures  
✅ All emails from 6 months fetched  
✅ No duplicate messages in database  
✅ Message nodes created in Neo4j  
✅ Vector embeddings stored in Pinecone  
✅ Metadata correct in PostgreSQL  
✅ Processing completes within expected time  
✅ No memory leaks or connection exhaustion  
✅ Errors logged and monitored  

---

## Known Limitations & Future Improvements

**Current Limitations:**
- Max 250 requests/user/second (Gmail API limit)
- Daily quota: 1 billion quota units/day
- Initial sync of 100k+ emails may take hours
- Attachments not processed (text only)

**Future Enhancements:**
- [ ] Attachment processing (OCR for images)
- [ ] Real-time sync via Gmail push notifications
- [ ] Person extraction from email addresses
- [ ] Thread relationship mapping
- [ ] Sentiment analysis
- [ ] Smart categorization
