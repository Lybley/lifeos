import { google } from 'googleapis';
import logger from '../utils/logger';

/**
 * OAuth2 scopes required for Gmail integration
 */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Create OAuth2 client
 */
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing required Google OAuth2 configuration');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Set up automatic token refresh
  oauth2Client.on('tokens', (tokens) => {
    logger.info('OAuth2 tokens refreshed automatically');
    if (tokens.refresh_token) {
      logger.info('New refresh token received');
    }
  });

  return oauth2Client;
}

/**
 * Generate authorization URL
 */
export function getAuthUrl(oauth2Client: any, userId?: string): string {
  const state = userId ? JSON.stringify({ userId }) : undefined;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required for refresh token
    prompt: 'consent', // Force consent to get refresh token
    scope: GMAIL_SCOPES,
    state,
  });
}
