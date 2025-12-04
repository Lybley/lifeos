/**
 * Billing Service
 * Handles subscription management, usage tracking, and Stripe integration
 */

import { stripe } from '../../config/stripe';
import { postgresClient as db } from '../../config/postgres';
import logger from '../../utils/logger';
import Stripe from 'stripe';

export interface SubscriptionPlan {
  id: string;
  plan_name: string;
  display_name: string;
  monthly_price: number;
  annual_price: number;
  features: string[];
}

export interface CreateSubscriptionParams {
  userId: string;
  planId: string;
  billingCycle: 'monthly' | 'annual';
  couponCode?: string;
}

export interface UsageRecord {
  userId: string;
  usageType: 'embeddings' | 'llm_tokens';
  amount: number;
}

class BillingService {
  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const result = await db.query(
      `SELECT id, plan_name, display_name, description, monthly_price, annual_price, 
              vector_quota, agent_quota, auto_actions_enabled, max_team_seats, features
       FROM subscription_plans
       WHERE is_active = true
       ORDER BY sort_order`
    );
    return result.rows;
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string) {
    const result = await db.query(
      `SELECT s.*, p.plan_name, p.display_name, p.monthly_price, p.annual_price, p.features
       FROM user_subscriptions s
       JOIN subscription_plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create or get Stripe customer
   */
  async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    // Check if customer already exists
    const existingSub = await this.getUserSubscription(userId);
    if (existingSub?.stripe_customer_id) {
      return existingSub.stripe_customer_id;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });

    logger.info(`Created Stripe customer ${customer.id} for user ${userId}`);
    return customer.id;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(params: {
    userId: string;
    email: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
    couponCode?: string;
  }) {
    const { userId, email, planId, billingCycle, successUrl, cancelUrl, couponCode } = params;

    // Get plan details
    const planResult = await db.query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );
    const plan = planResult.rows[0];
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Get or create Stripe customer
    const customerId = await this.getOrCreateStripeCustomer(userId, email);

    // Get appropriate price ID
    const priceId = billingCycle === 'monthly' 
      ? plan.stripe_price_id_monthly 
      : plan.stripe_price_id_annual;

    if (!priceId) {
      throw new Error(`No Stripe price ID configured for ${plan.plan_name} ${billingCycle}`);
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        plan_id: planId,
        billing_cycle: billingCycle,
      },
    };

    // Add coupon if provided
    if (couponCode) {
      const coupon = await this.validateCoupon(couponCode, plan.plan_name);
      if (coupon && coupon.stripe_coupon_id) {
        sessionParams.discounts = [{ coupon: coupon.stripe_coupon_id }];
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create pending transaction record
    await db.query(
      `INSERT INTO payment_transactions (user_id, stripe_session_id, amount, currency, status, transaction_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        session.id,
        billingCycle === 'monthly' ? plan.monthly_price : plan.annual_price,
        'usd',
        'pending',
        'subscription',
        JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      ]
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Validate and apply coupon
   */
  async validateCoupon(code: string, planName: string) {
    const result = await db.query(
      `SELECT * FROM coupons 
       WHERE code = $1 AND is_active = true 
       AND (valid_until IS NULL OR valid_until > NOW())
       AND (max_redemptions IS NULL OR times_redeemed < max_redemptions)`,
      [code]
    );

    const coupon = result.rows[0];
    if (!coupon) return null;

    // Check if coupon is applicable to this plan
    if (coupon.applicable_plans && coupon.applicable_plans.length > 0) {
      if (!coupon.applicable_plans.includes(planName)) {
        return null;
      }
    }

    return coupon;
  }

  /**
   * Handle successful subscription
   */
  async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.user_id;
    const planId = subscription.metadata.plan_id;

    if (!userId || !planId) {
      logger.error('Missing user_id or plan_id in subscription metadata');
      return;
    }

    // Create or update user subscription
    await db.query(
      `INSERT INTO user_subscriptions 
       (user_id, plan_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_status,
        status, current_period_start, current_period_end, billing_cycle)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), to_timestamp($8), $9)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        stripe_subscription_status = EXCLUDED.stripe_subscription_status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = NOW()`,
      [
        userId,
        planId,
        subscription.customer as string,
        subscription.id,
        subscription.status,
        'active',
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.metadata.billing_cycle || 'monthly',
      ]
    );

    logger.info(`Created subscription for user ${userId}`);
  }

  /**
   * Handle subscription update
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await db.query(
      `UPDATE user_subscriptions SET
        stripe_subscription_status = $1,
        status = $2,
        current_period_start = to_timestamp($3),
        current_period_end = to_timestamp($4),
        cancel_at_period_end = $5,
        updated_at = NOW()
       WHERE stripe_subscription_id = $6`,
      [
        subscription.status,
        subscription.status === 'active' ? 'active' : subscription.status,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.cancel_at_period_end,
        subscription.id,
      ]
    );
  }

  /**
   * Handle subscription canceled
   */
  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await db.query(
      `UPDATE user_subscriptions SET
        status = 'canceled',
        canceled_at = NOW(),
        updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  }

  /**
   * Record usage for metering
   */
  async recordUsage(params: UsageRecord) {
    const { userId, usageType, amount } = params;

    // Get current subscription
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      logger.warn(`No subscription found for user ${userId}`);
      return;
    }

    // Get current billing period
    const periodStart = subscription.current_period_start;
    const periodEnd = subscription.current_period_end;

    // Record usage
    await db.query(
      `INSERT INTO usage_records 
       (user_id, subscription_id, usage_type, usage_amount, billing_period_start, billing_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, subscription.id, usageType, amount, periodStart, periodEnd]
    );

    logger.info(`Recorded ${amount} ${usageType} usage for user ${userId}`);
  }

  /**
   * Get usage summary for current period
   */
  async getUsageSummary(userId: string) {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return null;

    const result = await db.query(
      `SELECT usage_type, SUM(usage_amount) as total_usage
       FROM usage_records
       WHERE subscription_id = $1
         AND billing_period_start = $2
         AND billing_period_end = $3
       GROUP BY usage_type`,
      [subscription.id, subscription.current_period_start, subscription.current_period_end]
    );

    return {
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      usage: result.rows,
    };
  }

  /**
   * Export usage to Stripe for billing
   */
  async exportUsageToStripe() {
    // Get all unexported usage records
    const result = await db.query(
      `SELECT ur.*, us.stripe_subscription_id
       FROM usage_records ur
       JOIN user_subscriptions us ON ur.subscription_id = us.id
       WHERE ur.exported_to_stripe = false
         AND us.stripe_subscription_id IS NOT NULL
       ORDER BY ur.recorded_at ASC
       LIMIT 1000`
    );

    for (const record of result.rows) {
      try {
        // Find subscription item for metering
        const subscription = await stripe.subscriptions.retrieve(
          record.stripe_subscription_id
        );

        const meteringItem = subscription.items.data.find(
          (item) => item.price.recurring?.usage_type === 'metered'
        );

        if (meteringItem) {
          // Report usage to Stripe
          await stripe.subscriptionItems.createUsageRecord(
            meteringItem.id,
            {
              quantity: record.usage_amount,
              timestamp: Math.floor(new Date(record.recorded_at).getTime() / 1000),
              action: 'increment',
            }
          );

          // Mark as exported
          await db.query(
            `UPDATE usage_records SET 
             exported_to_stripe = true, 
             exported_at = NOW()
             WHERE id = $1`,
            [record.id]
          );

          logger.info(`Exported usage record ${record.id} to Stripe`);
        }
      } catch (error) {
        logger.error(`Failed to export usage record ${record.id}:`, error);
      }
    }
  }

  /**
   * Check if webhook event was already processed
   */
  async isWebhookProcessed(eventId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT processed FROM stripe_webhook_events WHERE stripe_event_id = $1',
      [eventId]
    );
    return result.rows.length > 0 && result.rows[0].processed;
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(eventId: string, eventType: string, eventData: any) {
    await db.query(
      `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, event_data, processed, processed_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (stripe_event_id) DO UPDATE SET
        processed = true,
        processed_at = NOW()`,
      [eventId, eventType, JSON.stringify(eventData)]
    );
  }
}

export const billingService = new BillingService();
