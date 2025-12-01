/**
 * Safety Checks - Rate limiting, approval requirements, blocked actions
 */

import { postgresClient } from '../../config/postgres';
import { queueConnection } from '../../config/queue';
import {
  ActionType,
  SafetyCheckResult,
  SafetyRule,
  RateLimitConfig,
} from './types';
import logger from '../../utils/logger';

/**
 * Perform safety checks before allowing action
 */
export async function performSafetyChecks(
  actionType: ActionType,
  userId: string,
  payload: any
): Promise<SafetyCheckResult> {
  logger.info(`Performing safety checks for ${actionType} (user: ${userId})`);

  try {
    // Get all enabled safety rules for this action type
    const rules = await getSafetyRules(actionType);

    let requiresApproval = false;
    let requiresKyc = false;
    let blocked = false;
    let reason: string | undefined;
    let rateLimitExceeded = false;

    // Check each rule
    for (const rule of rules) {
      switch (rule.rule_type) {
        case 'blocked':
          blocked = true;
          reason = rule.rule_config.reason || 'This action type is currently disabled';
          logger.warn(`Action ${actionType} blocked: ${reason}`);
          break;

        case 'requires_approval':
          requiresApproval = true;
          logger.info(`Action ${actionType} requires approval`);
          break;

        case 'requires_kyc':
          // Check if user has completed KYC
          const hasKyc = await checkUserKyc(userId);
          if (!hasKyc) {
            requiresKyc = true;
            blocked = true;
            reason = rule.rule_config.reason || 'KYC verification required';
            logger.warn(`Action ${actionType} requires KYC for user ${userId}`);
          }
          break;

        case 'rate_limit':
          const rateLimitConfig = rule.rule_config as RateLimitConfig;
          const rateLimitKey = `${actionType}:${userId}:${rule.rule_name}`;
          const withinLimit = await checkRateLimit(
            rateLimitKey,
            rateLimitConfig.limit,
            rateLimitConfig.window
          );

          if (!withinLimit) {
            rateLimitExceeded = true;
            blocked = true;
            reason = `Rate limit exceeded: ${rateLimitConfig.limit} per ${rateLimitConfig.window}`;
            logger.warn(`Rate limit exceeded for ${actionType} (user: ${userId})`);
          }
          break;
      }

      // If blocked, stop checking other rules
      if (blocked) {
        break;
      }
    }

    const result: SafetyCheckResult = {
      allowed: !blocked,
      requires_approval: requiresApproval,
      requires_kyc: requiresKyc,
      blocked,
      reason,
      rate_limit_exceeded: rateLimitExceeded,
    };

    logger.info(`Safety check result:`, result);
    return result;
  } catch (error) {
    logger.error('Safety check failed:', error);
    // Fail safe: block action if safety check fails
    return {
      allowed: false,
      requires_approval: true,
      requires_kyc: false,
      blocked: true,
      reason: 'Safety check system error - action blocked for security',
    };
  }
}

/**
 * Get safety rules for action type
 */
async function getSafetyRules(actionType: ActionType): Promise<SafetyRule[]> {
  const query = `
    SELECT * FROM action_safety_rules
    WHERE action_type = $1 AND enabled = true
    ORDER BY rule_type DESC
  `;

  const result = await postgresClient.query(query, [actionType]);
  return result.rows as SafetyRule[];
}

/**
 * Check user KYC status
 */
async function checkUserKyc(userId: string): Promise<boolean> {
  // TODO: Implement actual KYC check
  // For now, simulate KYC check
  // In production, this would query a KYC database or service
  
  // Simulate: users with ID containing 'verified' are KYC approved
  return userId.includes('verified');
}

/**
 * Check rate limit using Redis
 */
async function checkRateLimit(
  key: string,
  limit: number,
  window: string
): Promise<boolean> {
  try {
    // Parse window (e.g., '1 hour', '1 day')
    const windowSeconds = parseWindowToSeconds(window);
    
    // Use Redis for fast rate limiting
    const redisKey = `rate_limit:${key}`;
    
    // Increment counter
    const current = await queueConnection.incr(redisKey);
    
    // Set expiry on first increment
    if (current === 1) {
      await queueConnection.expire(redisKey, windowSeconds);
    }
    
    logger.info(`Rate limit check: ${key} = ${current}/${limit}`);
    
    return current <= limit;
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // Fail open (allow action) if rate limit check fails
    return true;
  }
}

/**
 * Parse window string to seconds
 */
function parseWindowToSeconds(window: string): number {
  const match = window.match(/^(\\d+)\\s*(second|minute|hour|day)s?$/i);
  
  if (!match) {
    logger.warn(`Invalid window format: ${window}, defaulting to 1 hour`);
    return 3600;
  }

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
  };

  return value * (multipliers[unit] || 3600);
}

/**
 * Increment rate limit counter (called after action execution)
 */
export async function incrementRateLimit(
  actionType: ActionType,
  userId: string
): Promise<void> {
  try {
    // Get rate limit rules
    const rules = await getSafetyRules(actionType);
    const rateLimitRules = rules.filter((r) => r.rule_type === 'rate_limit');

    for (const rule of rateLimitRules) {
      const rateLimitConfig = rule.rule_config as RateLimitConfig;
      const rateLimitKey = `${actionType}:${userId}:${rule.rule_name}`;
      
      // Increment has already happened in checkRateLimit
      // This function is here for explicit tracking if needed
      logger.info(`Rate limit incremented for ${rateLimitKey}`);
    }
  } catch (error) {
    logger.error('Failed to increment rate limit:', error);
  }
}

/**
 * Get current rate limit usage
 */
export async function getRateLimitUsage(
  actionType: ActionType,
  userId: string
): Promise<Array<{ rule: string; current: number; limit: number; window: string }>> {
  try {
    const rules = await getSafetyRules(actionType);
    const rateLimitRules = rules.filter((r) => r.rule_type === 'rate_limit');

    const usage = [];

    for (const rule of rateLimitRules) {
      const rateLimitConfig = rule.rule_config as RateLimitConfig;
      const rateLimitKey = `${actionType}:${userId}:${rule.rule_name}`;
      const redisKey = `rate_limit:${rateLimitKey}`;
      
      const currentStr = await queueConnection.get(redisKey);
      const current = currentStr ? parseInt(currentStr) : 0;

      usage.push({
        rule: rule.rule_name,
        current,
        limit: rateLimitConfig.limit,
        window: rateLimitConfig.window,
      });
    }

    return usage;
  } catch (error) {
    logger.error('Failed to get rate limit usage:', error);
    return [];
  }
}
