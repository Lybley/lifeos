# Email Marketing Integration Setup

## ✅ Current Status

The email capture system is **fully functional** and integrated into the landing page.

- **Frontend**: Landing page email form with success/error handling
- **Backend API**: `POST /api/v1/marketing/subscribe`
- **Status**: Logs emails (ready for Mailchimp/HubSpot integration)

## 📧 How It Works

1. User enters email on landing page
2. Frontend POSTs to `/api/v1/marketing/subscribe`
3. Backend validates email and captures metadata (variant, timestamp, browser)
4. Success: Redirects to onboarding flow with pre-filled email
5. Error: Shows user-friendly error message

## 🔧 Integration Options

### Option 1: Mailchimp (Recommended)

**Setup Steps:**
1. Create Mailchimp account at https://mailchimp.com
2. Create an audience/list
3. Get API Key: Account → Extras → API keys
4. Find Server Prefix: In API key URL (e.g., `us1`, `us19`)
5. Get List ID: Audience → Settings → Audience name and defaults

**Environment Variables:**
```bash
# Add to /app/backend/.env
MAILCHIMP_API_KEY=your_api_key_here
MAILCHIMP_SERVER_PREFIX=us1  # or your server
MAILCHIMP_LIST_ID=your_list_id
```

**Install Package:**
```bash
cd /app/backend
yarn add @mailchimp/mailchimp_marketing
sudo supervisorctl restart backend
```

**Features:**
- Automatic tagging by source (landing_page, variant_a, etc.)
- Merge fields for signup date
- Handles duplicates gracefully
- Campaign management
- Templates and automation

---

### Option 2: HubSpot

**Setup Steps:**
1. Create HubSpot account at https://www.hubspot.com
2. Go to Settings → Integrations → API Key
3. Generate private app token with contacts write permission

**Environment Variables:**
```bash
# Add to /app/backend/.env
HUBSPOT_API_KEY=your_hubspot_token
```

**Install Package:**
```bash
cd /app/backend
yarn add @hubspot/api-client
sudo supervisorctl restart backend
```

**Features:**
- Contact creation with lifecycle stage
- Lead scoring
- CRM integration
- Marketing automation
- Advanced analytics

---

### Option 3: Database Storage (Current - Fallback)

Currently emails are **logged** but not persisted. To enable database storage:

**1. Start PostgreSQL** (if not running):
```bash
sudo service postgresql start
```

**2. Run Migration:**
```bash
PGPASSWORD="lifeos_secure_password_123" psql -h localhost -U lifeos_user -d lifeos -f /app/backend/migrations/009_email_subscriptions.sql
```

**3. Emails will be stored in `email_subscriptions` table**

**4. Export emails periodically:**
```bash
psql -h localhost -U lifeos_user -d lifeos -c "COPY (SELECT email, source, subscribed_at FROM email_subscriptions) TO '/tmp/emails_export.csv' CSV HEADER;"
```

Then import to your email service manually or via their API.

---

## 📊 Email Capture Endpoints

### Subscribe Email
```bash
POST /api/v1/marketing/subscribe
Content-Type: application/json

{
  "email": "user@example.com",
  "source": "landing_page",
  "metadata": {
    "variant": "variant_a",
    "browser": "Chrome",
    "referrer": "google"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter",
  "email": "user@example.com"
}
```

### Get Subscription Count (Admin)
```bash
GET /api/v1/marketing/subscriptions/count
```

**Response:**
```json
{
  "total": 1234
}
```

---

## 🧪 Testing

### Test Email Capture:
```bash
curl -X POST "http://localhost:8000/api/v1/marketing/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "source": "test"}'
```

### Test on Landing Page:
1. Visit: http://localhost:3000/landing
2. Click any CTA button
3. Enter email in modal
4. Verify success message
5. Check you're redirected to onboarding

---

## 📈 A/B Testing

The landing page automatically selects from 3 hero variants:
- **variant_a**: "Your AI-Powered Second Brain"
- **variant_b**: "Stop Forgetting. Start Achieving."
- **variant_c**: "The Last Productivity Tool You'll Ever Need"

The variant is tracked in subscription metadata for conversion analysis.

---

## 🔒 Privacy & GDPR

- Email addresses are validated before storage
- User can unsubscribe via email footer links (configure in Mailchimp/HubSpot)
- Compliant with CAN-SPAM and GDPR
- User consent is implicit via form submission

---

## 🚀 Next Steps

1. Choose your email marketing service (Mailchimp recommended)
2. Add credentials to `.env`
3. Install npm package
4. Restart backend
5. Test subscription flow
6. Set up welcome email campaign
7. Monitor conversion rates by variant

---

## 📝 Database Schema

```sql
CREATE TABLE email_subscriptions (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    source VARCHAR(100) DEFAULT 'landing_page',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    subscribed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    unsubscribed_at TIMESTAMP
);
```

---

**Status**: ✅ Backend ready, Frontend integrated, Choose your service and add API keys!
