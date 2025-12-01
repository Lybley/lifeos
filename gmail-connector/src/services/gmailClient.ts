/**
 * Gmail API Client with Retry and Rate Limiting
 */

import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient } from './tokenManager';
import logger from '../utils/logger';

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  payload?: gmail_v1.Schema$MessagePart;
  internalDate: string;
  historyId?: string;
  sizeEstimate?: number;
}

export interface GmailListResponse {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
  initialDelayMs: parseInt(process.env.INITIAL_RETRY_DELAY_MS || '1000'),
  maxDelayMs: parseInt(process.env.MAX_RETRY_DELAY_MS || '60000'),
  backoffMultiplier: 2,
};

/**
 * Rate limiter to respect Gmail API quotas
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  
  constructor(
    private maxConcurrent: number = 10,
    private maxPerSecond: number = parseInt(process.env.GMAIL_QUOTA_PER_SECOND || '25')
  ) {}

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for rate limit window
    await this.waitForRateLimit();

    // Wait for concurrent slot
    await this.waitForConcurrentSlot();

    this.activeRequests++;
    this.requestTimestamps.push(Date.now());

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove timestamps older than 1 second
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > oneSecondAgo
    );

    // If we've hit the rate limit, wait
    if (this.requestTimestamps.length >= this.maxPerSecond) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 1000 - (now - oldestTimestamp);

      if (waitTime > 0) {
        logger.info(`Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }
  }

  private async waitForConcurrentSlot(): Promise<void> {
    while (this.activeRequests >= this.maxConcurrent) {
      await this.sleep(100);
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const fn = this.queue.shift();
      if (fn) {
        fn();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter();

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );

  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Rate limit errors
  if (error.code === 429 || error.status === 429) {
    return true;
  }

  // Quota exceeded
  if (error.message?.includes('Quota exceeded')) {
    return true;
  }

  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Server errors (5xx)
  if (error.code >= 500 && error.code < 600) {
    return true;
  }

  return false;
}

/**
 * Execute function with retry logic and exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateBackoff(attempt - 1, config);
        logger.info(`Retry attempt ${attempt}/${config.maxRetries} for ${context} after ${delay}ms`);
        await sleep(delay);
      }

      return await fn();
    } catch (error: any) {
      lastError = error;

      logger.warn(`${context} failed (attempt ${attempt + 1}/${config.maxRetries + 1}):`, {
        error: error.message,
        code: error.code,
        status: error.status,
      });

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        logger.error(`Non-retryable error for ${context}:`, error);
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === config.maxRetries) {
        break;
      }

      // Special handling for rate limit errors
      if (error.code === 429 || error.status === 429) {
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) {
          const waitTime = parseInt(retryAfter) * 1000;
          logger.info(`Rate limited. Waiting ${waitTime}ms as per Retry-After header`);
          await sleep(waitTime);
        }
      }
    }
  }

  logger.error(`All retry attempts exhausted for ${context}`);
  throw lastError || new Error(`Failed after ${config.maxRetries} retries`);
}

/**
 * Gmail API Client
 */
export class GmailClient {
  private gmail: gmail_v1.Gmail | null = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize Gmail client
   */
  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    if (!this.gmail) {
      const auth = await getAuthenticatedClient(this.userId);
      this.gmail = google.gmail({ version: 'v1', auth });
    }
    return this.gmail;
  }

  /**
   * List messages with pagination
   */
  async listMessages(
    query?: string,
    maxResults: number = 100,
    pageToken?: string
  ): Promise<GmailListResponse> {
    return rateLimiter.execute(async () => {
      return withRetry(
        async () => {
          const gmail = await this.getGmailClient();

          const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults,
            pageToken,
          });

          return {
            messages: (response.data.messages || []) as GmailMessage[],
            nextPageToken: response.data.nextPageToken,
            resultSizeEstimate: response.data.resultSizeEstimate,
          };
        },
        DEFAULT_RETRY_CONFIG,
        `listMessages(query=${query}, page=${pageToken || 'first'})`
      );
    });
  }

  /**
   * Get message details
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    return rateLimiter.execute(async () => {
      return withRetry(
        async () => {
          const gmail = await this.getGmailClient();

          const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
          });

          return response.data as GmailMessage;
        },
        DEFAULT_RETRY_CONFIG,
        `getMessage(${messageId})`
      );
    });
  }

  /**
   * Batch get messages (more efficient)
   */
  async batchGetMessages(messageIds: string[]): Promise<GmailMessage[]> {
    const messages: GmailMessage[] = [];
    const batchSize = 50; // Gmail batch API limit

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);

      const batchMessages = await Promise.all(
        batch.map((id) => this.getMessage(id))
      );

      messages.push(...batchMessages);

      logger.info(`Fetched batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messageIds.length / batchSize)}`);
    }

    return messages;
  }

  /**
   * Get all messages in date range
   */
  async getMessagesInDateRange(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<GmailMessage[]> {
    const query = `after:${Math.floor(startDate.getTime() / 1000)} before:${Math.floor(
      endDate.getTime() / 1000
    )}`;

    const allMessages: GmailMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.listMessages(query, 100, pageToken);
      
      // Get full message details
      const messageIds = response.messages.map((m) => m.id);
      if (messageIds.length > 0) {
        const fullMessages = await this.batchGetMessages(messageIds);
        allMessages.push(...fullMessages);
      }

      pageToken = response.nextPageToken;

      logger.info(
        `Fetched ${allMessages.length} messages so far (page token: ${pageToken ? 'has more' : 'done'})`
      );
    } while (pageToken);

    return allMessages;
  }
}
