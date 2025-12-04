# Billing & Subscription System Documentation

## Overview

Complete subscription and billing system with Stripe integration, supporting multiple plans, usage-based billing, seat management, and automated webhook handling.

## Subscription Plans

### Free Plan
- **Price**: $0/month
- **Features**:
  - 1,000 vector embeddings
  - 1 AI agent
  - 10K LLM tokens/month
  - Basic memory graph
- **Limits**:
  - `vector_quota`: 1,000
  - `agent_quota`: 1
  - `auto_actions_enabled`: false
  - `max_team_seats`: 1

### Pro Plan
- **Price**: $29/month or $290/year
- **Features**:
  - 50,000 vector embeddings
  - 5 AI agents
  - 500K LLM tokens/month
  - Auto-actions enabled
  - Advanced memory features
  - Priority support
- **Limits**:
  - `vector_quota`: 50,000
  - `agent_quota`: 5
  - `auto_actions_enabled`: true
  - `max_team_seats`: 1
- **Usage-based pricing**:
  - Embeddings: $0.001 per 1,000 beyond quota
  - LLM tokens: $0.0001 per 1,000 beyond quota

### Team Plan
- **Price**: $99/month or $990/year
- **Features**:
  - 200,000 vector embeddings
  - 20 AI agents
  - 2M LLM tokens/month
  - Up to 10 team members
  - Shared memory spaces
  - Team analytics
  - Admin controls
  - Priority support
- **Limits**:
  - `vector_quota`: 200,000
  - `agent_quota`: 20
  - `auto_actions_enabled`: true
  - `max_team_seats`: 10
- **Usage-based pricing**:
  - Embeddings: $0.0008 per 1,000 beyond quota
  - LLM tokens: $0.00008 per 1,000 beyond quota

### Enterprise Plan
- **Price**: $499/month or $4,990/year
- **Features**:
  - Unlimited embeddings
  - Unlimited agents
  - 10M+ LLM tokens/month
  - Up to 100 team members
  - SSO integration
  - Custom integrations
  - Dedicated support
  - SLA guarantees
  - Advanced security
- **Limits**:
  - `vector_quota`: NULL (unlimited)
  - `agent_quota`: NULL (unlimited)
  - `auto_actions_enabled`: true
  - `max_team_seats`: 100
- **Usage-based pricing**:
  - Embeddings: $0.0005 per 1,000
  - LLM tokens: $0.00005 per 1,000

## API Endpoints

### Subscription Plans

#### GET /api/v1/billing/plans
Get all available subscription plans.

**Response**:
```json
{
  "plans": [
    {
      "id": "uuid",
      "plan_name": "pro",
      "display_name": "Pro",
      "description": "For power users and professionals",
      "monthly_price": 29.00,
      "annual_price": 290.00,
      "vector_quota": 50000,
      "agent_quota": 5,
      "auto_actions_enabled": true,
      "max_team_seats": 1,
      "features": ["50,000 vector embeddings", "5 AI agents", ...]
    }
  ]
}
```

#### GET /api/v1/billing/subscription
Get user's current subscription.

**Query Parameters**:
- `userId` (required): User ID

**Response**:
```json
{
  "subscription": {
    "id": "uuid",
    "user_id": "user-123",
    "plan_id": "uuid",
    "plan_name": "pro",
    "status": "active",
    "current_period_start": "2025-12-01T00:00:00Z",
    "current_period_end": "2025-12-31T23:59:59Z",
    "stripe_subscription_id": "sub_xxx",
    "billing_cycle": "monthly"
  }
}
```

### Checkout

#### POST /api/v1/billing/checkout
Create Stripe checkout session for subscription.

**Request Body**:
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "planId": "uuid-of-plan",
  "billingCycle": "monthly",
  "successUrl": "https://app.example.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://app.example.com/cancel",
  "couponCode": "LAUNCH50"
}
```

**Response**:
```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

**Frontend Implementation**:
```javascript
// 1. Create checkout session
const response = await fetch('/api/v1/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    email: currentUser.email,
    planId: selectedPlan.id,
    billingCycle: 'monthly',
    successUrl: `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/billing`,
  }),
});

const { url } = await response.json();

// 2. Redirect to Stripe Checkout
window.location.href = url;
```

#### GET /api/v1/billing/checkout/status/:sessionId
Get checkout session status after payment.

**Response**:
```json
{
  "status": "complete",
  "payment_status": "paid",
  "customer_email": "user@example.com",
  "metadata": {
    "user_id": "user-123",
    "plan_id": "uuid"
  }
}
```

**Frontend Polling Implementation**:
```javascript
// After redirect back from Stripe
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');

if (sessionId) {
  // Poll for payment status
  const checkStatus = async () => {
    const response = await fetch(`/api/v1/billing/checkout/status/${sessionId}`);
    const data = await response.json();
    
    if (data.payment_status === 'paid') {
      // Payment successful!
      showSuccessMessage();
    } else if (data.status === 'expired') {
      showErrorMessage();
    } else {
      // Still processing, poll again
      setTimeout(checkStatus, 2000);
    }
  };
  
  checkStatus();
}
```

### Usage Tracking

#### POST /api/v1/billing/usage
Record usage for metered billing.

**Request Body**:
```json
{
  "userId": "user-123",
  "usageType": "embeddings",
  "amount": 1000
}
```

**Usage Types**:
- `embeddings`: Number of vector embeddings created
- `llm_tokens`: Number of LLM tokens consumed

**Response**:
```json
{
  "success": true,
  "message": "Usage recorded"
}
```

**Backend Integration Example**:
```typescript
// When creating embeddings
const embeddings = await createEmbeddings(text);

// Record usage
await fetch('/api/v1/billing/usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    usageType: 'embeddings',
    amount: embeddings.length,
  }),
});
```

#### GET /api/v1/billing/usage/:userId
Get usage summary for current billing period.

**Response**:
```json
{
  "period_start": "2025-12-01T00:00:00Z",
  "period_end": "2025-12-31T23:59:59Z",
  "usage": [
    {
      "usage_type": "embeddings",
      "total_usage": "15000"
    },
    {
      "usage_type": "llm_tokens",
      "total_usage": "250000"
    }
  ]
}
```

### Customer Portal

#### POST /api/v1/billing/portal
Create Stripe customer portal session for managing subscription.

**Request Body**:
```json
{
  "userId": "user-123",
  "returnUrl": "https://app.example.com/settings/billing"
}
```

**Response**:
```json
{
  "url": "https://billing.stripe.com/session/xxx"
}
```

### Webhooks

#### POST /api/v1/billing/webhook
Handle Stripe webhook events (internal endpoint).

**Supported Events**:
- `checkout.session.completed`: Checkout session completed
- `customer.subscription.created`: New subscription created
- `customer.subscription.updated`: Subscription updated (plan change, renewal)
- `customer.subscription.deleted`: Subscription canceled
- `invoice.paid`: Invoice payment succeeded
- `invoice.payment_failed`: Invoice payment failed

**Webhook Configuration in Stripe**:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/v1/billing/webhook`
3. Select events: All subscription and invoice events
4. Copy webhook signing secret to `.env` as `STRIPE_WEBHOOK_SECRET`

## Database Schema

### subscription_plans
Defines available subscription tiers.

**Key Fields**:
- `plan_name`: Unique identifier (free, pro, team, enterprise)
- `monthly_price`, `annual_price`: Pricing
- `vector_quota`, `agent_quota`: Feature limits (NULL = unlimited)
- `embeddings_included`, `llm_tokens_included`: Free usage per period
- `embeddings_price_per_1k`, `llm_tokens_price_per_1k`: Overage pricing

### user_subscriptions
Active subscriptions for users.

**Key Fields**:
- `user_id`: Owner of subscription
- `stripe_subscription_id`: Stripe subscription ID
- `status`: active, canceled, past_due, trialing
- `current_period_start`, `current_period_end`: Billing period
- `cancel_at_period_end`: Will cancel at period end?

### subscription_seats
Team member seats (for Team and Enterprise plans).

**Key Fields**:
- `subscription_id`: Parent subscription
- `user_email`: Invited user email
- `status`: pending, active, revoked
- `role`: owner, admin, member

### usage_records
Tracks usage for metered billing.

**Key Fields**:
- `user_id`, `subscription_id`: User and subscription
- `usage_type`: embeddings, llm_tokens
- `usage_amount`: Number of units consumed
- `billing_period_start`, `billing_period_end`: Billing period
- `exported_to_stripe`: Has this been exported for billing?

### payment_transactions
All payment transactions.

**Key Fields**:
- `stripe_session_id`: Checkout session ID
- `status`: pending, succeeded, failed, canceled
- `transaction_type`: subscription, one_time, usage_charge

### stripe_webhook_events
Ensures idempotent webhook processing.

**Key Fields**:
- `stripe_event_id`: Unique Stripe event ID
- `processed`: Has this event been processed?
- `event_data`: Full event payload

## Feature Flags

Check subscription limits in your code:

```typescript
// Get user subscription
const subscription = await billingService.getUserSubscription(userId);

// Check if feature is available
if (!subscription.plan.auto_actions_enabled) {
  throw new Error('Auto-actions are only available on Pro plan or higher');
}

// Check quota
const currentVectorCount = await getVectorCount(userId);
if (subscription.plan.vector_quota && currentVectorCount >= subscription.plan.vector_quota) {
  throw new Error(`Vector quota exceeded. Upgrade to ${nextPlan.name} for ${nextPlan.vector_quota} vectors`);
}

// Check team seats
const activeSeats = await getActiveSeats(subscription.id);
if (activeSeats >= subscription.plan.max_team_seats) {
  throw new Error(`Team seat limit reached. Upgrade to add more members.`);
}
```

## Testing

### Test Stripe API Key
Development uses: `sk_test_emergent`

### Test Cards
Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

### Manual Testing
```bash
# Get all plans
curl http://localhost:8000/api/v1/billing/plans

# Get user subscription
curl 'http://localhost:8000/api/v1/billing/subscription?userId=test-user-123'

# Record usage
curl -X POST http://localhost:8000/api/v1/billing/usage \
  -H 'Content-Type: application/json' \
  -d '{"userId":"test-user-123","usageType":"embeddings","amount":1000}'

# Get usage summary
curl http://localhost:8000/api/v1/billing/usage/test-user-123
```

### Automated Tests
Run the test suite:
```bash
python3 /app/billing_test.py
```

## Migration to Production

1. **Get Stripe API Keys**:
   - Go to Stripe Dashboard → Developers → API keys
   - Copy live secret key
   - Update `.env`: `STRIPE_API_KEY=sk_live_xxx`

2. **Create Stripe Products & Prices**:
   ```bash
   # Create products in Stripe Dashboard or via API
   # Update subscription_plans table with price IDs
   UPDATE subscription_plans 
   SET stripe_price_id_monthly = 'price_xxx',
       stripe_price_id_annual = 'price_yyy'
   WHERE plan_name = 'pro';
   ```

3. **Set up Webhook Endpoint**:
   - Add webhook URL in Stripe Dashboard
   - Copy webhook signing secret
   - Update `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxx`

4. **Test in Production**:
   - Use test mode in production first
   - Verify all flows work
   - Enable live mode

## Cron Jobs

### Export Usage to Stripe
Run daily to export metered usage:

```typescript
import { billingService } from './services/billing/billingService';

// Schedule daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await billingService.exportUsageToStripe();
});
```

## Security Considerations

1. **Never trust client-side pricing**: All prices are defined server-side in `subscription_plans` table
2. **Verify webhook signatures**: All webhooks verify Stripe signature
3. **Idempotency**: Webhook events are deduplicated via `stripe_webhook_events` table
4. **User authorization**: Always verify `userId` matches authenticated user
5. **Rate limiting**: Consider adding rate limits to usage recording endpoints

## Support & Troubleshooting

### Common Issues

**"No Stripe price ID configured"**:
- Ensure `stripe_price_id_monthly` and `stripe_price_id_annual` are set in `subscription_plans` table
- Create products and prices in Stripe Dashboard first

**Webhook not working**:
- Verify `STRIPE_WEBHOOK_SECRET` is set in `.env`
- Check webhook endpoint is publicly accessible
- Verify webhook events are selected in Stripe Dashboard

**Usage not being billed**:
- Ensure metered pricing is set up in Stripe
- Run `exportUsageToStripe()` manually to test
- Check `usage_records` table has `exported_to_stripe = false` records

## Future Enhancements

- [ ] Add trial period support
- [ ] Implement proration for plan changes
- [ ] Add invoice PDF generation
- [ ] Create billing admin dashboard
- [ ] Add analytics for MRR, churn, etc.
- [ ] Implement usage alerts/notifications
- [ ] Add seat invitation flow UI
- [ ] Create billing email templates
