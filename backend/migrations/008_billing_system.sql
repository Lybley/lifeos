-- Billing and Subscription Management Schema
-- Supports Stripe integration, subscription plans, usage-based billing, and seat management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SUBSCRIPTION PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_name VARCHAR(50) NOT NULL UNIQUE, -- free, pro, team, enterprise
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pricing
  monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  annual_price DECIMAL(10, 2) DEFAULT NULL,
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_annual VARCHAR(255),
  
  -- Feature Limits
  vector_quota INTEGER DEFAULT NULL, -- NULL = unlimited
  agent_quota INTEGER DEFAULT NULL,
  auto_actions_enabled BOOLEAN DEFAULT FALSE,
  max_team_seats INTEGER DEFAULT 1,
  
  -- Usage-based pricing
  embeddings_included INTEGER DEFAULT 0, -- free embeddings per month
  llm_tokens_included BIGINT DEFAULT 0, -- free tokens per month
  embeddings_price_per_1k DECIMAL(10, 4) DEFAULT 0.00,
  llm_tokens_price_per_1k DECIMAL(10, 4) DEFAULT 0.00,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb, -- Array of feature descriptions
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX idx_subscription_plans_name ON subscription_plans(plan_name);

-- ============================================================================
-- USER SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  -- Stripe Data
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_subscription_status VARCHAR(50), -- active, past_due, canceled, etc.
  
  -- Subscription Period
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, canceled, past_due, trialing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  
  -- Trial
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  
  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, annual
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

-- ============================================================================
-- TEAM SEATS (for Team plan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, active, revoked
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  -- Permissions
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(subscription_id, user_email)
);

CREATE INDEX idx_subscription_seats_subscription ON subscription_seats(subscription_id);
CREATE INDEX idx_subscription_seats_user_email ON subscription_seats(user_email);
CREATE INDEX idx_subscription_seats_status ON subscription_seats(status);

-- ============================================================================
-- USAGE TRACKING (for metering)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Usage Type
  usage_type VARCHAR(50) NOT NULL, -- embeddings, llm_tokens, vector_search, etc.
  usage_amount BIGINT NOT NULL, -- number of units consumed
  
  -- Billing Period
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP DEFAULT NOW(),
  
  -- Stripe Metering
  stripe_usage_record_id VARCHAR(255),
  exported_to_stripe BOOLEAN DEFAULT FALSE,
  exported_at TIMESTAMP
);

CREATE INDEX idx_usage_records_user ON usage_records(user_id);
CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_type ON usage_records(usage_type);
CREATE INDEX idx_usage_records_period ON usage_records(billing_period_start, billing_period_end);
CREATE INDEX idx_usage_records_export ON usage_records(exported_to_stripe, exported_at);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Stripe Data
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255),
  
  -- Invoice Details
  invoice_number VARCHAR(100),
  status VARCHAR(50) NOT NULL, -- draft, open, paid, void, uncollectible
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'usd',
  
  -- Dates
  invoice_date TIMESTAMP,
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  
  -- URLs
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ============================================================================
-- COUPONS & DISCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  
  -- Discount
  discount_type VARCHAR(20) NOT NULL, -- percentage, fixed_amount
  discount_value DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'usd',
  
  -- Stripe
  stripe_coupon_id VARCHAR(255),
  
  -- Validity
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  max_redemptions INTEGER,
  times_redeemed INTEGER DEFAULT 0,
  
  -- Restrictions
  applicable_plans TEXT[], -- array of plan names
  first_time_only BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active, valid_until);

-- User coupon redemptions
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  user_id VARCHAR(255) NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  redeemed_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(coupon_id, user_id)
);

CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions(user_id);

-- ============================================================================
-- PAYMENT TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255),
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Stripe Data
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  
  -- Transaction Details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, canceled
  payment_status VARCHAR(50), -- Stripe payment status
  
  -- Type
  transaction_type VARCHAR(50) NOT NULL, -- subscription, one_time, usage_charge
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_session ON payment_transactions(stripe_session_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- ============================================================================
-- WEBHOOK EVENTS (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  
  -- Data
  event_data JSONB NOT NULL,
  error_message TEXT,
  
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stripe_webhook_events_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- ============================================================================
-- SEED DATA - DEFAULT PLANS
-- ============================================================================

INSERT INTO subscription_plans (plan_name, display_name, description, monthly_price, annual_price, 
  vector_quota, agent_quota, auto_actions_enabled, max_team_seats, 
  embeddings_included, llm_tokens_included, embeddings_price_per_1k, llm_tokens_price_per_1k,
  sort_order, features)
VALUES
  -- Free Plan
  ('free', 'Free', 'Perfect for trying out LifeOS', 0.00, 0.00,
   1000, 1, FALSE, 1,
   1000, 10000, 0.00, 0.00,
   1, '["1,000 vector embeddings", "1 AI agent", "10K LLM tokens/month", "Basic memory graph"]'::jsonb),
  
  -- Pro Plan
  ('pro', 'Pro', 'For power users and professionals', 29.00, 290.00,
   50000, 5, TRUE, 1,
   10000, 500000, 0.001, 0.0001,
   2, '["50,000 vector embeddings", "5 AI agents", "500K LLM tokens/month", "Auto-actions enabled", "Advanced memory features", "Priority support"]'::jsonb),
  
  -- Team Plan
  ('team', 'Team', 'Collaborate with your team', 99.00, 990.00,
   200000, 20, TRUE, 10,
   50000, 2000000, 0.0008, 0.00008,
   3, '["200,000 vector embeddings", "20 AI agents", "2M LLM tokens/month", "Up to 10 team members", "Shared memory spaces", "Team analytics", "Admin controls", "Priority support"]'::jsonb),
  
  -- Enterprise Plan
  ('enterprise', 'Enterprise', 'Custom solution for large organizations', 499.00, 4990.00,
   NULL, NULL, TRUE, 100,
   200000, 10000000, 0.0005, 0.00005,
   4, '["Unlimited embeddings", "Unlimited agents", "10M+ LLM tokens/month", "Up to 100 team members", "SSO integration", "Custom integrations", "Dedicated support", "SLA guarantees", "Advanced security"]'::jsonb)
ON CONFLICT (plan_name) DO NOTHING;

-- Comments
COMMENT ON TABLE subscription_plans IS 'Defines available subscription tiers with feature limits and pricing';
COMMENT ON TABLE user_subscriptions IS 'Tracks active subscriptions for users';
COMMENT ON TABLE subscription_seats IS 'Manages team member seats for Team plan';
COMMENT ON TABLE usage_records IS 'Tracks usage for metered billing (embeddings, tokens)';
COMMENT ON TABLE invoices IS 'Stores invoice records from Stripe';
COMMENT ON TABLE coupons IS 'Discount codes and promotional offers';
COMMENT ON TABLE payment_transactions IS 'All payment transactions and checkout sessions';
COMMENT ON TABLE stripe_webhook_events IS 'Ensures idempotent webhook processing';
