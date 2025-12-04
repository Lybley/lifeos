/**
 * Feature Engineering for People Intelligence
 * 
 * Computes ML features from conversation metadata and relationship history
 */

import {
  PersonIntelligence,
  ConversationMetadata,
  WeeklyFeatures,
  ModelFeatures,
  RelationshipHealth,
  RiskLevel,
  CommunicationStyle,
  DEFAULT_CONFIG,
  PeopleEngineConfig,
} from './peopleModels';
import logger from '../../utils/logger';

// ============================================================================
// FEATURE COMPUTATION
// ============================================================================

/**
 * Compute model features from person data and conversation history
 */
export function computeModelFeatures(
  person: PersonIntelligence,
  conversations: ConversationMetadata[],
  weeklyFeatures: WeeklyFeatures[]
): ModelFeatures {
  const now = new Date();
  
  // Sort conversations by date
  const sortedConvos = conversations.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
  
  // Temporal features
  const daysSinceLastContact = person.lastContact
    ? (now.getTime() - person.lastContact.getTime()) / (1000 * 60 * 60 * 24)
    : 9999;
  
  const daysSinceFirstContact = person.firstContact
    ? (now.getTime() - person.firstContact.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  
  // Frequency features
  const freq7d = getConversationFrequency(conversations, 7);
  const freq30d = getConversationFrequency(conversations, 30);
  const freq90d = getConversationFrequency(conversations, 90);
  
  const contactsPerMonth = daysSinceFirstContact > 0
    ? (person.totalInteractions / daysSinceFirstContact) * 30
    : 0;
  
  const frequencyTrend = calculateTrend(
    weeklyFeatures.map(w => w.conversationCount)
  );
  
  // Sentiment features
  const sentiments7d = getRecentSentiments(conversations, 7);
  const sentiments30d = getRecentSentiments(conversations, 30);
  
  const avgSentiment7d = average(sentiments7d);
  const avgSentiment30d = average(sentiments30d);
  const sentimentVolatility = standardDeviation(sentiments30d);
  const lastSentiment = sortedConvos[0]?.sentiment?.overall ?? 0;
  
  const sentimentMomentum = avgSentiment7d - avgSentiment30d;
  
  // Response features
  const responseTimes = conversations
    .filter(c => c.responseTime)
    .map(c => c.responseTime!);
  
  const avgResponseTime = average(responseTimes);
  const responseTimeConsistency = 1 - (standardDeviation(responseTimes) / (avgResponseTime || 1));
  const reciprocityScore = person.initiationRatio;
  
  // Engagement features
  const userEngagements = conversations.map(c => c.userEngagement);
  const personEngagements = conversations.map(c => c.personEngagement);
  
  const avgEngagement = (average(userEngagements) + average(personEngagements)) / 2;
  const engagementTrend = calculateTrend(
    weeklyFeatures.map(w => w.avgUserEngagement)
  );
  const mutualEngagementScore = average(
    conversations.map(c => Math.min(c.userEngagement, c.personEngagement))
  );
  
  // Quality features
  const totalConvos = conversations.length || 1;
  const conflictCount = conversations.filter(c => c.hadConflict).length;
  const positiveCount = conversations.filter(c => c.wasPositive).length;
  const productiveCount = conversations.filter(c => c.wasProductive).length;
  
  const conflictRatio = conflictCount / totalConvos;
  const positiveRatio = positiveCount / totalConvos;
  const productivityScore = productiveCount / totalConvos;
  
  // Relationship context
  const relationshipAge = daysSinceFirstContact;
  const totalInteractions = person.totalInteractions;
  
  const channels = new Set(conversations.map(c => c.channel));
  const channelDiversity = channels.size;
  
  // Derived ratios
  const recentCount = getConversationFrequency(conversations, 30);
  const historicalCount = person.totalInteractions;
  const recentActivityRatio = historicalCount > 0 
    ? recentCount / historicalCount 
    : 0;
  
  const engagementBalance = average(userEngagements) - average(personEngagements);
  
  // Compute health score
  const healthScore = computeHealthScore({
    daysSinceLastContact,
    avgSentiment30d,
    freq30d,
    avgEngagement,
    conflictRatio,
    positiveRatio,
  });
  
  return {
    daysSinceLastContact,
    daysSinceFirstContact,
    contactsPerMonth,
    conversationFrequency7d: freq7d,
    conversationFrequency30d: freq30d,
    conversationFrequency90d: freq90d,
    frequencyTrend,
    avgSentiment7d,
    avgSentiment30d,
    sentimentVolatility,
    lastSentiment,
    sentimentMomentum,
    avgResponseTime,
    responseTimeConsistency,
    reciprocityScore,
    avgEngagement,
    engagementTrend,
    mutualEngagementScore,
    conflictRatio,
    positiveRatio,
    productivityScore,
    relationshipAge,
    totalInteractions,
    channelDiversity,
    recentActivityRatio,
    engagementBalance,
    healthScore,
  };
}

// ============================================================================
// HEALTH SCORE COMPUTATION (Heuristic Model)
// ============================================================================

/**
 * Compute relationship health score using weighted heuristics
 */
export function computeHealthScore(
  features: {
    daysSinceLastContact: number;
    avgSentiment30d: number;
    freq30d: number;
    avgEngagement: number;
    conflictRatio: number;
    positiveRatio: number;
  },
  config: PeopleEngineConfig = DEFAULT_CONFIG
): number {
  const weights = config.weights;
  
  // Recency score (exponential decay)
  const recencyScore = Math.exp(-features.daysSinceLastContact / 30);
  
  // Sentiment score (normalized from -1..1 to 0..1)
  const sentimentScore = (features.avgSentiment30d + 1) / 2;
  
  // Frequency score (normalized, log scale)
  const frequencyScore = Math.min(1, Math.log(1 + features.freq30d) / Math.log(15));
  
  // Trust score (based on positive interactions and low conflict)
  const trustScore = features.positiveRatio * (1 - features.conflictRatio);
  
  // Engagement score
  const engagementScore = features.avgEngagement;
  
  // Weighted sum
  const healthScore = 
    (recencyScore * weights.recency) +
    (sentimentScore * weights.sentiment) +
    (frequencyScore * weights.frequency) +
    (trustScore * weights.trust) +
    (engagementScore * weights.engagement);
  
  return Math.max(0, Math.min(1, healthScore));
}

/**
 * Classify health status from score
 */
export function classifyHealthStatus(
  score: number,
  config: PeopleEngineConfig = DEFAULT_CONFIG
): RelationshipHealth {
  if (score >= config.thresholds.excellentHealth) {
    return RelationshipHealth.EXCELLENT;
  } else if (score >= config.thresholds.goodHealth) {
    return RelationshipHealth.GOOD;
  } else if (score >= config.thresholds.fairHealth) {
    return RelationshipHealth.FAIR;
  } else if (score >= config.thresholds.atRiskHealth) {
    return RelationshipHealth.AT_RISK;
  } else {
    return RelationshipHealth.NEEDS_ATTENTION;
  }
}

/**
 * Compute churn risk score
 */
export function computeChurnRisk(
  features: ModelFeatures,
  config: PeopleEngineConfig = DEFAULT_CONFIG
): number {
  let risk = 0;
  
  // High risk if no recent contact
  if (features.daysSinceLastContact > config.triggers.daysSinceContactForCheckIn) {
    risk += 0.3;
  }
  
  // High risk if frequency declining
  if (features.frequencyTrend < -0.2) {
    risk += 0.25;
  }
  
  // High risk if sentiment declining
  if (features.sentimentMomentum < -0.2) {
    risk += 0.25;
  }
  
  // Medium risk if low engagement
  if (features.avgEngagement < 0.4) {
    risk += 0.15;
  }
  
  // High risk if high conflict
  if (features.conflictRatio > 0.2) {
    risk += 0.2;
  }
  
  return Math.min(1, risk);
}

/**
 * Classify risk level from score
 */
export function classifyRiskLevel(
  score: number,
  config: PeopleEngineConfig = DEFAULT_CONFIG
): RiskLevel {
  if (score >= config.thresholds.highRisk) {
    return RiskLevel.CRITICAL;
  } else if (score >= config.thresholds.mediumRisk) {
    return RiskLevel.HIGH;
  } else if (score >= config.thresholds.lowRisk) {
    return RiskLevel.MEDIUM;
  } else if (score > 0) {
    return RiskLevel.LOW;
  } else {
    return RiskLevel.NONE;
  }
}

/**
 * Classify communication style
 */
export function classifyCommunicationStyle(
  features: ModelFeatures,
  conversations: ConversationMetadata[]
): CommunicationStyle {
  const avgWordCount = average(conversations.map(c => c.wordCount / c.messageCount));
  const avgMessageCount = average(conversations.map(c => c.messageCount));
  
  // Determine style based on patterns
  if (features.avgResponseTime < 4) {
    return CommunicationStyle.RESPONSIVE;
  } else if (features.avgResponseTime > 48) {
    return CommunicationStyle.SLOW;
  } else if (avgWordCount > 100) {
    return CommunicationStyle.DETAILED;
  } else if (avgWordCount < 20) {
    return CommunicationStyle.BRIEF;
  } else if (avgMessageCount > 10) {
    return CommunicationStyle.CASUAL;
  } else {
    return CommunicationStyle.FORMAL;
  }
}

// ============================================================================
// WEEKLY FEATURE AGGREGATION
// ============================================================================

/**
 * Aggregate conversation metadata into weekly features
 */
export function aggregateWeeklyFeatures(
  personId: string,
  userId: string,
  conversations: ConversationMetadata[],
  weekStart: Date,
  weekEnd: Date
): WeeklyFeatures {
  // Filter conversations in this week
  const weekConvos = conversations.filter(
    c => c.timestamp >= weekStart && c.timestamp < weekEnd
  );
  
  if (weekConvos.length === 0) {
    return createEmptyWeeklyFeatures(personId, userId, weekStart, weekEnd);
  }
  
  // Volume metrics
  const conversationCount = weekConvos.length;
  const totalDuration = sum(weekConvos.map(c => c.duration || 0));
  const messageCount = sum(weekConvos.map(c => c.messageCount));
  
  // Initiation patterns
  const userInitiated = weekConvos.filter(c => c.initiatedBy === 'user').length;
  const personInitiated = weekConvos.filter(c => c.initiatedBy === 'person').length;
  const initiationRatio = userInitiated / (userInitiated + personInitiated || 1);
  
  // Response metrics
  const responseTimes = weekConvos.filter(c => c.responseTime).map(c => c.responseTime!);
  const avgResponseTime = average(responseTimes);
  const maxResponseTime = Math.max(...responseTimes, 0);
  const missedResponses = 0; // TODO: Track from data
  
  // Sentiment aggregates
  const sentiments = weekConvos.map(c => c.sentiment.overall);
  const avgSentiment = average(sentiments);
  const sentimentVariance = variance(sentiments);
  const positiveInteractions = weekConvos.filter(c => c.wasPositive).length;
  const negativeInteractions = weekConvos.filter(c => c.sentiment.overall < -0.2).length;
  
  // Engagement
  const avgUserEngagement = average(weekConvos.map(c => c.userEngagement));
  const avgPersonEngagement = average(weekConvos.map(c => c.personEngagement));
  const mutualEngagement = average(
    weekConvos.map(c => Math.min(c.userEngagement, c.personEngagement))
  );
  
  // Quality
  const conflictCount = weekConvos.filter(c => c.hadConflict).length;
  const productiveCount = weekConvos.filter(c => c.wasProductive).length;
  
  // Channels
  const channelCounts: Record<string, number> = {};
  weekConvos.forEach(c => {
    channelCounts[c.channel] = (channelCounts[c.channel] || 0) + 1;
  });
  
  const preferredChannel = Object.entries(channelCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
  
  return {
    personId,
    userId,
    weekStart,
    weekEnd,
    conversationCount,
    totalDuration,
    messageCount,
    userInitiated,
    personInitiated,
    initiationRatio,
    avgResponseTime,
    maxResponseTime,
    missedResponses,
    avgSentiment,
    sentimentVariance,
    positiveInteractions,
    negativeInteractions,
    avgUserEngagement,
    avgPersonEngagement,
    mutualEngagement,
    conflictCount,
    productiveCount,
    channelDistribution: channelCounts,
    preferredChannel,
  };
}

function createEmptyWeeklyFeatures(
  personId: string,
  userId: string,
  weekStart: Date,
  weekEnd: Date
): WeeklyFeatures {
  return {
    personId,
    userId,
    weekStart,
    weekEnd,
    conversationCount: 0,
    totalDuration: 0,
    messageCount: 0,
    userInitiated: 0,
    personInitiated: 0,
    initiationRatio: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    missedResponses: 0,
    avgSentiment: 0,
    sentimentVariance: 0,
    positiveInteractions: 0,
    negativeInteractions: 0,
    avgUserEngagement: 0,
    avgPersonEngagement: 0,
    mutualEngagement: 0,
    conflictCount: 0,
    productiveCount: 0,
    channelDistribution: {},
    preferredChannel: 'unknown',
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getConversationFrequency(
  conversations: ConversationMetadata[],
  days: number
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return conversations.filter(c => c.timestamp >= cutoff).length;
}

function getRecentSentiments(
  conversations: ConversationMetadata[],
  days: number
): number[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return conversations
    .filter(c => c.timestamp >= cutoff)
    .map(c => c.sentiment.overall);
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  // Simple linear regression slope
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = average(values);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  return average(values.map(v => (v - avg) ** 2));
}

function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

// ============================================================================
// EXPORT BATCH PROCESSOR
// ============================================================================

/**
 * Batch process features for multiple people
 */
export async function batchComputeFeatures(
  people: PersonIntelligence[],
  conversationsByPerson: Map<string, ConversationMetadata[]>,
  weeklyFeaturesByPerson: Map<string, WeeklyFeatures[]>
): Promise<Map<string, ModelFeatures>> {
  const results = new Map<string, ModelFeatures>();
  
  for (const person of people) {
    try {
      const conversations = conversationsByPerson.get(person.personId) || [];
      const weeklyFeatures = weeklyFeaturesByPerson.get(person.personId) || [];
      
      const features = computeModelFeatures(person, conversations, weeklyFeatures);
      results.set(person.personId, features);
      
    } catch (error) {
      logger.error(`Failed to compute features for person ${person.personId}`, { error });
    }
  }
  
  logger.info(`Batch computed features for ${results.size}/${people.length} people`);
  
  return results;
}
