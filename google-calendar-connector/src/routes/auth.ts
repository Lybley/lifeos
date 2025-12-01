/**
 * OAuth Authentication Routes
 */

import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { createOAuth2Client, getAuthUrl } from '../config/oauth';
import { storeTokens } from '../services/tokenManager';
import { queueCalendarSync } from '../services/syncQueue';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /auth/google
 * Initiate OAuth flow
 */
router.get('/google', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const oauth2Client = createOAuth2Client();
  const authUrl = getAuthUrl(oauth2Client, userId);

  logger.info(`Initiating OAuth flow for user ${userId}`);

  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * OAuth callback handler
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    let userId = 'default-user';
    if (state) {
      try {
        const stateObj = JSON.parse(state);
        userId = stateObj.userId || userId;
      } catch (e) {
        logger.warn('Failed to parse state parameter');
      }
    }

    logger.info(`Processing OAuth callback for user ${userId}`);

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const calendarEmail = userInfo.data.email;

    if (!calendarEmail) {
      throw new Error('Could not retrieve email from Google profile');
    }

    logger.info(`Retrieved Calendar email: ${calendarEmail}`);

    await storeTokens(userId, calendarEmail, tokens);

    await queueCalendarSync(userId, {
      isInitialSync: true,
      monthsBack: parseInt(process.env.SYNC_MONTHS_BACK || '6'),
    });

    logger.info(`Successfully connected Google Calendar account for user ${userId}`);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #2d3748; margin-bottom: 1rem; }
            p { color: #4a5568; line-height: 1.6; }
            .success { color: #48bb78; font-size: 3rem; margin-bottom: 1rem; }
            .email { 
              background: #f7fafc; 
              padding: 0.75rem 1.5rem; 
              border-radius: 0.5rem; 
              margin: 1.5rem 0;
              font-family: monospace;
            }
            .info {
              background: #edf2f7;
              padding: 1rem;
              border-radius: 0.5rem;
              margin-top: 1.5rem;
              font-size: 0.875rem;
              color: #4a5568;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Google Calendar Connected Successfully!</h1>
            <p>Your Google Calendar account has been connected to LifeOS.</p>
            <div class="email">${calendarEmail}</div>
            <div class="info">
              <strong>What's happening now:</strong><br>
              We're syncing your calendar events from the last 6 months. This may take a few minutes.
            </div>
            <p style="margin-top: 2rem; font-size: 0.875rem;">
              You can close this window.
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('OAuth callback failed:', error);

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #2d3748; margin-bottom: 1rem; }
            p { color: #4a5568; line-height: 1.6; }
            .error { color: #f56565; font-size: 3rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">✗</div>
            <h1>Connection Failed</h1>
            <p>We couldn't connect your Google Calendar account. Please try again.</p>
            <p style="font-size: 0.875rem; color: #718096; margin-top: 1.5rem;">
              Error: ${error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * POST /auth/disconnect
 * Disconnect Calendar account
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { deleteTokens } = await import('../services/tokenManager');
    await deleteTokens(userId);

    logger.info(`Disconnected Google Calendar for user ${userId}`);

    res.json({
      success: true,
      message: 'Google Calendar account disconnected',
    });
  } catch (error) {
    logger.error('Failed to disconnect Calendar:', error);
    res.status(500).json({
      error: 'Failed to disconnect Google Calendar account',
    });
  }
});

/**
 * GET /auth/status
 * Check OAuth connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { getTokens } = await import('../services/tokenManager');
    const tokens = await getTokens(userId);

    if (!tokens) {
      return res.json({
        connected: false,
        message: 'No Google Calendar account connected',
      });
    }

    res.json({
      connected: true,
      calendar_email: tokens.calendar_email,
      connected_at: tokens.created_at,
      last_updated: tokens.updated_at,
    });
  } catch (error) {
    logger.error('Failed to check OAuth status:', error);
    res.status(500).json({
      error: 'Failed to check connection status',
    });
  }
});

export default router;
