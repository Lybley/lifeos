/**
 * Token Manager Service
 * 
 * Handles OAuth2 token storage, retrieval, and refresh
 */

import { postgresClient } from '../config/databases';
import { createOAuth2Client } from '../config/oauth';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

export interface StoredTokens extends OAuthTokens {
  id: string;
  user_id: string;
  drive_email: string;
  created_at: Date;
  updated_at: Date;
  is_valid: boolean;
}

/**
 * Store OAuth tokens in database
 */
export async function storeTokens(
  userId: string,
  driveEmail: string,
  tokens: OAuthTokens
): Promise<string> {
  const query = `
    INSERT INTO oauth_tokens (
      id, user_id, provider, gmail_email,
      access_token, refresh_token, expiry_date,
      scope, token_type, is_valid, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      gmail_email = EXCLUDED.gmail_email,
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
      expiry_date = EXCLUDED.expiry_date,
      scope = EXCLUDED.scope,
      token_type = EXCLUDED.token_type,
      is_valid = true,
      updated_at = NOW()
    RETURNING id
  `;

  try {
    const result = await postgresClient.query(query, [
      uuidv4(),
      userId,
      'google_drive',
      driveEmail,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      tokens.scope || null,
      tokens.token_type || 'Bearer',
    ]);

    const tokenId = result.rows[0].id;
    logger.info(`Stored OAuth tokens for user ${userId}`);
    return tokenId;
  } catch (error) {
    logger.error('Failed to store OAuth tokens:', error);
    throw new Error('Failed to store OAuth tokens');
  }
}

/**
 * Retrieve OAuth tokens for a user
 */
export async function getTokens(userId: string): Promise<StoredTokens | null> {
  const query = `
    SELECT * FROM oauth_tokens
    WHERE user_id = $1 AND provider = 'google_drive' AND is_valid = true
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  try {
    const result = await postgresClient.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      user_id: row.user_id,
      drive_email: row.gmail_email,
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expiry_date: row.expiry_date ? new Date(row.expiry_date).getTime() : undefined,
      scope: row.scope,
      token_type: row.token_type,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_valid: row.is_valid,
    };
  } catch (error) {
    logger.error('Failed to retrieve OAuth tokens:', error);
    throw new Error('Failed to retrieve OAuth tokens');
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expiry_date) {
    return false;
  }

  const bufferMs = 5 * 60 * 1000;
  return Date.now() >= tokens.expiry_date - bufferMs;
}

/**
 * Refresh OAuth token if needed
 */
export async function refreshTokenIfNeeded(
  userId: string
): Promise<OAuthTokens> {
  const storedTokens = await getTokens(userId);

  if (!storedTokens) {
    throw new Error('No tokens found for user');
  }

  if (!isTokenExpired(storedTokens)) {
    logger.info(`Token for user ${userId} is still valid`);
    return storedTokens;
  }

  if (!storedTokens.refresh_token) {
    throw new Error('No refresh token available. User must re-authenticate.');
  }

  logger.info(`Refreshing token for user ${userId}`);

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: storedTokens.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await storeTokens(userId, storedTokens.drive_email, {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || storedTokens.refresh_token,
      expiry_date: credentials.expiry_date,
      scope: credentials.scope,
      token_type: credentials.token_type,
    });

    logger.info(`Successfully refreshed token for user ${userId}`);

    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || storedTokens.refresh_token,
      expiry_date: credentials.expiry_date,
      scope: credentials.scope,
      token_type: credentials.token_type,
    };
  } catch (error) {
    logger.error(`Failed to refresh token for user ${userId}:`, error);
    await invalidateTokens(userId);
    throw new Error('Token refresh failed. User must re-authenticate.');
  }
}

/**
 * Invalidate user's OAuth tokens
 */
export async function invalidateTokens(userId: string): Promise<void> {
  const query = `
    UPDATE oauth_tokens
    SET is_valid = false, updated_at = NOW()
    WHERE user_id = $1 AND provider = 'google_drive'
  `;

  try {
    await postgresClient.query(query, [userId]);
    logger.info(`Invalidated tokens for user ${userId}`);
  } catch (error) {
    logger.error('Failed to invalidate tokens:', error);
    throw new Error('Failed to invalidate tokens');
  }
}

/**
 * Delete user's OAuth tokens
 */
export async function deleteTokens(userId: string): Promise<void> {
  const query = `
    DELETE FROM oauth_tokens
    WHERE user_id = $1 AND provider = 'google_drive'
  `;

  try {
    await postgresClient.query(query, [userId]);
    logger.info(`Deleted tokens for user ${userId}`);
  } catch (error) {
    logger.error('Failed to delete tokens:', error);
    throw new Error('Failed to delete tokens');
  }
}

/**
 * Get authenticated OAuth2 client for user
 */
export async function getAuthenticatedClient(userId: string) {
  const tokens = await refreshTokenIfNeeded(userId);

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    scope: tokens.scope,
    token_type: tokens.token_type,
  });

  return oauth2Client;
}
