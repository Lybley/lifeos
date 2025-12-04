/**
 * Billing API Routes
 * Handles subscription management, checkout, webhooks, and usage tracking
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe';
import { billingService } from '../services/billing/billingService';
import logger from '../utils/logger';
import Stripe from 'stripe';

const router = Router();

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

/**
 * GET /api/v1/billing/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ plans });
  } catch (error) {
    logger.error('Failed to get plans:', error);
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

/**
 * GET /api/v1/billing/subscription
 * Get user's current subscription
 */
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const subscription = await billingService.getUserSubscription(userId);
    res.json({ subscription });
  } catch (error) {
    logger.error('Failed to get subscription:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription' });
  }
});

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * POST /api/v1/billing/checkout
 * Create Stripe checkout session
 */
router.post(
  '/checkout',
  [
    body('userId').isString().notEmpty(),
    body('email').isEmail(),
    body('planId').isString().notEmpty(),
    body('billingCycle').isIn(['monthly', 'annual']),
    body('successUrl').isString().notEmpty(),
    body('cancelUrl').isString().notEmpty(),
    body('couponCode').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, email, planId, billingCycle, successUrl, cancelUrl, couponCode } = req.body;

      const session = await billingService.createCheckoutSession({
        userId,
        email,
        planId,
        billingCycle,
        successUrl,
        cancelUrl,
        couponCode,
      });

      res.json(session);
    } catch (error: any) {
      logger.error('Failed to create checkout session:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  }
);

/**
 * GET /api/v1/billing/checkout/status/:sessionId
 * Get checkout session status
 */
router.get('/checkout/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_email,
      metadata: session.metadata,
    });
  } catch (error) {
    logger.error('Failed to get checkout status:', error);
    res.status(500).json({ error: 'Failed to retrieve checkout status' });
  }
});

// ============================================================================
// WEBHOOKS
// ============================================================================

/**
 * POST /api/v1/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // Check if event was already processed (idempotency)
    const alreadyProcessed = await billingService.isWebhookProcessed(event.id);
    if (alreadyProcessed) {
      logger.info(`Webhook event ${event.id} already processed`);
      return res.json({ received: true, already_processed: true });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        logger.info(`Checkout session completed: ${session.id}`);
        
        // If this is a subscription, the subscription.created event will handle it
        if (session.mode === 'subscription' && session.subscription) {
          // Optionally store session completion
        }
        break;

      case 'customer.subscription.created':
        const createdSub = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionCreated(createdSub);
        break;

      case 'customer.subscription.updated':
        const updatedSub = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionUpdated(updatedSub);
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionDeleted(deletedSub);
        break;

      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice;
        logger.info(`Invoice paid: ${invoice.id}`);
        // Store invoice record
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        logger.warn(`Invoice payment failed: ${failedInvoice.id}`);
        // Handle payment failure
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark event as processed
    await billingService.markWebhookProcessed(event.id, event.type, event.data.object);

    res.json({ received: true });
  } catch (error: any) {
    logger.error(`Webhook processing failed: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * POST /api/v1/billing/usage
 * Record usage for metering
 */
router.post(
  '/usage',
  [
    body('userId').isString().notEmpty(),
    body('usageType').isIn(['embeddings', 'llm_tokens']),
    body('amount').isInt({ min: 1 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, usageType, amount } = req.body;

      await billingService.recordUsage({ userId, usageType, amount });

      res.json({ success: true, message: 'Usage recorded' });
    } catch (error) {
      logger.error('Failed to record usage:', error);
      res.status(500).json({ error: 'Failed to record usage' });
    }
  }
);

/**
 * GET /api/v1/billing/usage/:userId
 * Get usage summary for user
 */
router.get('/usage/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const summary = await billingService.getUsageSummary(userId);

    if (!summary) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(summary);
  } catch (error) {
    logger.error('Failed to get usage summary:', error);
    res.status(500).json({ error: 'Failed to retrieve usage summary' });
  }
});

// ============================================================================
// CUSTOMER PORTAL
// ============================================================================

/**
 * POST /api/v1/billing/portal
 * Create customer portal session
 */
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const { userId, returnUrl } = req.body;

    if (!userId || !returnUrl) {
      return res.status(400).json({ error: 'userId and returnUrl are required' });
    }

    const subscription = await billingService.getUserSubscription(userId);
    if (!subscription || !subscription.stripe_customer_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error('Failed to create portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
