/**
 * Feature Engine Tests
 */

import {
  computeModelFeatures,
  computeHealthScore,
  classifyHealthStatus,
  computeChurnRisk,
  classifyRiskLevel,
  aggregateWeeklyFeatures,
} from '../featureEngine';
import {
  PersonIntelligence,
  ConversationMetadata,
  RelationshipHealth,
  RiskLevel,
  MemoryType,
} from '../peopleModels';

describe('Health Score Computation', () => {
  it('should compute high health score for strong relationship', () => {
    const score = computeHealthScore({
      daysSinceLastContact: 3,
      avgSentiment30d: 0.7,
      freq30d: 12,
      avgEngagement: 0.8,
      conflictRatio: 0.05,
      positiveRatio: 0.85,
    });
    
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThanOrEqual(1.0);
  });
  
  it('should compute low health score for weak relationship', () => {
    const score = computeHealthScore({
      daysSinceLastContact: 45,
      avgSentiment30d: -0.3,
      freq30d: 1,
      avgEngagement: 0.3,
      conflictRatio: 0.4,
      positiveRatio: 0.2,
    });
    
    expect(score).toBeLessThan(0.4);
    expect(score).toBeGreaterThanOrEqual(0);
  });
  
  it('should classify health status correctly', () => {
    expect(classifyHealthStatus(0.90)).toBe(RelationshipHealth.EXCELLENT);
    expect(classifyHealthStatus(0.75)).toBe(RelationshipHealth.GOOD);
    expect(classifyHealthStatus(0.55)).toBe(RelationshipHealth.FAIR);
    expect(classifyHealthStatus(0.35)).toBe(RelationshipHealth.AT_RISK);
    expect(classifyHealthStatus(0.20)).toBe(RelationshipHealth.NEEDS_ATTENTION);
  });
});

describe('Churn Risk Computation', () => {
  const createMockFeatures = (overrides: any = {}) => ({
    daysSinceLastContact: 7,
    daysSinceFirstContact: 180,
    contactsPerMonth: 5,
    conversationFrequency7d: 2,
    conversationFrequency30d: 8,
    conversationFrequency90d: 24,
    frequencyTrend: 0.1,
    avgSentiment7d: 0.5,
    avgSentiment30d: 0.5,
    sentimentVolatility: 0.2,
    lastSentiment: 0.5,
    sentimentMomentum: 0,
    avgResponseTime: 12,
    responseTimeConsistency: 0.7,
    reciprocityScore: 0.5,
    avgEngagement: 0.6,
    engagementTrend: 0,
    mutualEngagementScore: 0.6,
    conflictRatio: 0.1,
    positiveRatio: 0.7,
    productivityScore: 0.6,
    relationshipAge: 180,
    totalInteractions: 50,
    channelDiversity: 3,
    recentActivityRatio: 0.3,
    engagementBalance: 0,
    healthScore: 0.7,
    ...overrides,
  });
  
  it('should compute high churn risk for neglected relationship', () => {
    const features = createMockFeatures({
      daysSinceLastContact: 30,
      frequencyTrend: -0.5,
      sentimentMomentum: -0.4,
    });
    
    const risk = computeChurnRisk(features);
    
    expect(risk).toBeGreaterThan(0.5);
    expect(classifyRiskLevel(risk)).toBe(RiskLevel.CRITICAL);
  });
  
  it('should compute low churn risk for healthy relationship', () => {
    const features = createMockFeatures({
      daysSinceLastContact: 2,
      frequencyTrend: 0.2,
      sentimentMomentum: 0.1,
      avgEngagement: 0.8,
      conflictRatio: 0.05,
    });
    
    const risk = computeChurnRisk(features);
    
    expect(risk).toBeLessThan(0.3);
  });
});

describe('Weekly Feature Aggregation', () => {
  it('should aggregate conversation data into weekly features', () => {
    const weekStart = new Date('2025-01-01');
    const weekEnd = new Date('2025-01-08');
    
    const conversations: ConversationMetadata[] = [
      {
        conversationId: '1',
        personId: 'person_1',
        userId: 'user_1',
        timestamp: new Date('2025-01-02'),
        initiatedBy: 'user',
        messageCount: 5,
        wordCount: 100,
        sentiment: { overall: 0.6, compound: 0.6, positive: 0.7, negative: 0.1, neutral: 0.2, confidence: 0.8 },
        topics: [],
        userEngagement: 0.8,
        personEngagement: 0.7,
        channel: 'email',
        hadConflict: false,
        wasPositive: true,
        wasProductive: true,
      },
      {
        conversationId: '2',
        personId: 'person_1',
        userId: 'user_1',
        timestamp: new Date('2025-01-05'),
        initiatedBy: 'person',
        messageCount: 3,
        wordCount: 50,
        sentiment: { overall: 0.4, compound: 0.4, positive: 0.5, negative: 0.2, neutral: 0.3, confidence: 0.7 },
        topics: [],
        responseTime: 24,
        userEngagement: 0.6,
        personEngagement: 0.8,
        channel: 'chat',
        hadConflict: false,
        wasPositive: true,
        wasProductive: false,
      },
    ];
    
    const features = aggregateWeeklyFeatures('person_1', 'user_1', conversations, weekStart, weekEnd);
    
    expect(features.conversationCount).toBe(2);
    expect(features.messageCount).toBe(8);
    expect(features.userInitiated).toBe(1);
    expect(features.personInitiated).toBe(1);
    expect(features.avgSentiment).toBeCloseTo(0.5, 1);
    expect(features.positiveInteractions).toBe(2);
    expect(features.channelDistribution).toEqual({ email: 1, chat: 1 });
  });
  
  it('should return empty features for week with no conversations', () => {
    const weekStart = new Date('2025-01-01');
    const weekEnd = new Date('2025-01-08');
    
    const features = aggregateWeeklyFeatures('person_1', 'user_1', [], weekStart, weekEnd);
    
    expect(features.conversationCount).toBe(0);
    expect(features.avgSentiment).toBe(0);
  });
});
