-- Migration: Email Subscriptions & Marketing
-- Created: 2025-12-15

-- Email Subscriptions Table
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    source VARCHAR(100) DEFAULT 'landing_page',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    subscribed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    unsubscribed_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_status ON email_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_source ON email_subscriptions(source);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_subscribed_at ON email_subscriptions(subscribed_at DESC);

-- Email Campaign Tracking (optional for future)
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    sent_at TIMESTAMP,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE email_subscriptions IS 'Stores email subscriptions from landing page and other sources';
COMMENT ON TABLE email_campaigns IS 'Tracks email marketing campaigns (future use)';
