/**
 * Marketing & Email Capture Routes
 * Handles landing page email subscriptions
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/marketing/subscribe
 * Capture email from landing page
 */
router.post(
  '/subscribe',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('source').optional().isString().withMessage('Source must be a string'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, source = 'landing_page', metadata = {} } = req.body;

      logger.info('Email subscription received', { email, source });

      // Store in database for tracking
      // In production, this would integrate with Mailchimp/HubSpot
      const subscription = {
        email,
        source,
        subscribed_at: new Date().toISOString(),
        metadata,
        status: 'pending',
      };

      // TODO: Integrate with email marketing service
      // Option 1: Mailchimp
      if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
        await subscribeToMailchimp(email, source, metadata);
      }
      
      // Option 2: HubSpot
      else if (process.env.HUBSPOT_API_KEY) {
        await subscribeToHubSpot(email, source, metadata);
      }
      
      // Option 3: Store in database for manual export
      else {
        // For now, just log the subscription
        // In production, this would store in database
        logger.info('Email subscription logged (DB not configured)', { 
          email, 
          source, 
          metadata,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Successfully subscribed to newsletter',
        email,
      });
    } catch (error) {
      logger.error('Email subscription failed:', error);
      return res.status(500).json({
        error: 'Subscription failed',
        message: 'An error occurred while processing your subscription. Please try again.',
      });
    }
  }
);

/**
 * Subscribe to Mailchimp
 */
async function subscribeToMailchimp(
  email: string,
  source: string,
  metadata: any
): Promise<void> {
  const mailchimp = require('@mailchimp/mailchimp_marketing');

  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX || 'us1',
  });

  try {
    const response = await mailchimp.lists.addListMember(
      process.env.MAILCHIMP_LIST_ID,
      {
        email_address: email,
        status: 'subscribed',
        tags: [source],
        merge_fields: {
          SOURCE: source,
          SIGNUP_DT: new Date().toISOString(),
        },
      }
    );

    logger.info('Mailchimp subscription successful', { email, response });
  } catch (error: any) {
    // Handle "already subscribed" as success
    if (error.status === 400 && error.response?.body?.title === 'Member Exists') {
      logger.info('Email already subscribed to Mailchimp', { email });
      return;
    }
    throw error;
  }
}

/**
 * Subscribe to HubSpot
 */
async function subscribeToHubSpot(
  email: string,
  source: string,
  metadata: any
): Promise<void> {
  const hubspot = require('@hubspot/api-client');
  const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_API_KEY });

  try {
    const contactObj = {
      properties: {
        email,
        lifecyclestage: 'lead',
        hs_lead_status: 'NEW',
        source,
        signup_date: new Date().toISOString(),
      },
    };

    const response = await hubspotClient.crm.contacts.basicApi.create(contactObj);
    logger.info('HubSpot subscription successful', { email, response });
  } catch (error: any) {
    // Handle "contact already exists" as success
    if (error.statusCode === 409) {
      logger.info('Email already exists in HubSpot', { email });
      return;
    }
    throw error;
  }
}

/**
 * Store subscription in database (fallback)
 */
async function storeSubscriptionInDB(
  email: string,
  source: string,
  metadata: any
): Promise<void> {
  // Store in PostgreSQL
  const { postgresClient } = await import('../config/postgres');

  const query = `
    INSERT INTO email_subscriptions (email, source, metadata, subscribed_at, status)
    VALUES ($1, $2, $3, NOW(), 'pending')
    ON CONFLICT (email) 
    DO UPDATE SET 
      source = EXCLUDED.source,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `;

  await postgresClient.query(query, [email, source, JSON.stringify(metadata)]);
  logger.info('Email stored in database', { email, source });
}

/**
 * GET /api/v1/marketing/subscriptions/count
 * Get total subscription count (admin only)
 */
router.get('/subscriptions/count', async (req: Request, res: Response) => {
  try {
    const { postgresClient } = await import('../config/postgres');
    
    const result = await postgresClient.query(
      'SELECT COUNT(*) as total FROM email_subscriptions WHERE status = $1',
      ['pending']
    );

    return res.json({
      total: parseInt(result.rows[0]?.total || '0', 10),
    });
  } catch (error) {
    logger.error('Failed to get subscription count:', error);
    return res.status(500).json({ error: 'Failed to retrieve count' });
  }
});

export default router;
