/**
 * People Intelligence Engine - Data Models
 * 
 * Defines enriched person nodes with relationship intelligence features
 */

// ============================================================================
// PERSON INTELLIGENCE FEATURES
// ============================================================================

export interface PersonIntelligence {
  personId: string;
  userId: string; // Owner of the relationship
  
  // Core identity
  name: string;
  email?: string;
  phone?: string;
  
  // Relationship metrics (0-1 normalized scores)
  relationshipStrength: number;
  conversationFrequency: number;
  sentimentTrend: number;
  trustScore: number;
  
  // Communication patterns
  commStyle: CommunicationStyle;
  responseTimeAvg: number; // hours
  initiationRatio: number; // 0-1: who starts conversations
  
  // Temporal tracking
  lastContact: Date;
  firstContact: Date;
  totalInteractions: number;
  
  // Derived insights
  relationshipHealth: RelationshipHealth;
  riskLevel: RiskLevel;
  engagementTrend: 'improving' | 'stable' | 'declining';
  
  // Context
  relationshipType: RelationshipType;
  tags: string[];
  notes?: string;
  
  // Computed timestamps
  lastUpdated: Date;
  nextSuggestedContact?: Date;
}

export enum CommunicationStyle {
  FORMAL = 'formal',
  CASUAL = 'casual',
  BRIEF = 'brief',
  DETAILED = 'detailed',
  RESPONSIVE = 'responsive',
  SLOW = 'slow',
}

export enum RelationshipType {
  FAMILY = 'family',
  FRIEND = 'friend',
  COLLEAGUE = 'colleague',
  MANAGER = 'manager',
  CLIENT = 'client',
  MENTOR = 'mentor',
  ACQUAINTANCE = 'acquaintance',
}

export enum RelationshipHealth {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  AT_RISK = 'at_risk',
  NEEDS_ATTENTION = 'needs_attention',
}

export enum RiskLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================================================
// CONVERSATION METADATA
// ============================================================================

export interface ConversationMetadata {
  conversationId: string;
  personId: string;
  userId: string;
  
  // Temporal
  timestamp: Date;
  duration?: number; // minutes
  
  // Participants
  initiatedBy: 'user' | 'person';
  
  // Content analysis
  messageCount: number;
  wordCount: number;
  sentiment: SentimentScore;
  topics: string[];
  
  // Response patterns
  responseTime?: number; // hours
  userEngagement: number; // 0-1
  personEngagement: number; // 0-1
  
  // Channel
  channel: 'email' | 'call' | 'meeting' | 'chat' | 'social';
  
  // Quality indicators
  hadConflict: boolean;
  wasPositive: boolean;
  wasProductive: boolean;
}

export interface SentimentScore {
  overall: number; // -1 to 1
  compound: number;
  positive: number;
  negative: number;
  neutral: number;
  confidence: number;
}

// ============================================================================
// COMPUTED FEATURES (Weekly Aggregates)
// ============================================================================

export interface WeeklyFeatures {
  personId: string;
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  
  // Volume metrics
  conversationCount: number;
  totalDuration: number;
  messageCount: number;
  
  // Initiation patterns
  userInitiated: number;
  personInitiated: number;
  initiationRatio: number;
  
  // Response metrics
  avgResponseTime: number;
  maxResponseTime: number;
  missedResponses: number;
  
  // Sentiment aggregates
  avgSentiment: number;
  sentimentVariance: number;
  positiveInteractions: number;
  negativeInteractions: number;
  
  // Engagement
  avgUserEngagement: number;
  avgPersonEngagement: number;
  mutualEngagement: number;
  
  // Quality
  conflictCount: number;
  productiveCount: number;
  
  // Channels
  channelDistribution: Record<string, number>;
  preferredChannel: string;
}

// ============================================================================
// RELATIONSHIP INSIGHTS
// ============================================================================

export interface RelationshipInsights {
  personId: string;
  userId: string;
  computedAt: Date;
  
  // Health assessment
  healthScore: number; // 0-100
  healthStatus: RelationshipHealth;
  riskFactors: RiskFactor[];
  strengths: string[];
  
  // Trends
  strengthTrend: TrendIndicator;
  sentimentTrend: TrendIndicator;
  frequencyTrend: TrendIndicator;
  
  // Predictions
  churnRisk: number; // 0-1
  nextContactPrediction: Date;
  recommendedActions: RecommendedAction[];
  
  // Context
  comparisonToPeers: {
    percentile: number; // 0-100
    avgHealthScore: number;
  };
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export interface TrendIndicator {
  direction: 'up' | 'down' | 'stable';
  magnitude: number; // Change magnitude
  confidence: number; // 0-1
}

export interface RecommendedAction {
  action: ActionType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  suggestedTiming: Date;
  template?: string;
}

export enum ActionType {
  CHECK_IN = 'check_in',
  APOLOGIZE = 'apologize',
  SHARE_UPDATE = 'share_update',
  CELEBRATE = 'celebrate',
  FOLLOW_UP = 'follow_up',
  SCHEDULE_MEETING = 'schedule_meeting',
  SEND_APPRECIATION = 'send_appreciation',
  REQUEST_FEEDBACK = 'request_feedback',
}

// ============================================================================
// MODEL FEATURES (for ML)
// ============================================================================

export interface ModelFeatures {
  // Temporal features
  daysSinceLastContact: number;
  daysSinceFirstContact: number;
  contactsPerMonth: number;
  
  // Frequency features
  conversationFrequency7d: number;
  conversationFrequency30d: number;
  conversationFrequency90d: number;
  frequencyTrend: number; // Slope
  
  // Sentiment features
  avgSentiment7d: number;
  avgSentiment30d: number;
  sentimentVolatility: number; // Std dev
  lastSentiment: number;
  sentimentMomentum: number; // Recent change
  
  // Response features
  avgResponseTime: number;
  responseTimeConsistency: number;
  reciprocityScore: number; // Balance of initiation
  
  // Engagement features
  avgEngagement: number;
  engagementTrend: number;
  mutualEngagementScore: number;
  
  // Quality features
  conflictRatio: number;
  positiveRatio: number;
  productivityScore: number;
  
  // Relationship context
  relationshipAge: number; // days
  totalInteractions: number;
  channelDiversity: number; // Number of channels used
  
  // Derived ratios
  recentActivityRatio: number; // Recent / historical
  engagementBalance: number; // User vs person engagement
  healthScore: number; // Computed health (0-1)
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface PeopleEngineConfig {
  // Score weights
  weights: {
    frequency: number;
    sentiment: number;
    recency: number;
    trust: number;
    engagement: number;
  };
  
  // Thresholds
  thresholds: {
    excellentHealth: number;
    goodHealth: number;
    fairHealth: number;
    atRiskHealth: number;
    
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    
    slowResponder: number; // hours
    fastResponder: number; // hours
  };
  
  // Timeframes
  timeframes: {
    shortTerm: number; // days
    mediumTerm: number; // days
    longTerm: number; // days
  };
  
  // Action triggers
  triggers: {
    daysSinceContactForCheckIn: number;
    negativeStreakForApology: number;
    positiveStreakForCelebration: number;
  };
}

export const DEFAULT_CONFIG: PeopleEngineConfig = {
  weights: {
    frequency: 0.25,
    sentiment: 0.30,
    recency: 0.20,
    trust: 0.15,
    engagement: 0.10,
  },
  
  thresholds: {
    excellentHealth: 0.85,
    goodHealth: 0.70,
    fairHealth: 0.50,
    atRiskHealth: 0.30,
    
    highRisk: 0.70,
    mediumRisk: 0.40,
    lowRisk: 0.20,
    
    slowResponder: 48,
    fastResponder: 4,
  },
  
  timeframes: {
    shortTerm: 7,
    mediumTerm: 30,
    longTerm: 90,
  },
  
  triggers: {
    daysSinceContactForCheckIn: 14,
    negativeStreakForApology: 3,
    positiveStreakForCelebration: 5,
  },
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PersonHealthSummary {
  personId: string;
  name: string;
  relationshipHealth: RelationshipHealth;
  healthScore: number;
  riskLevel: RiskLevel;
  daysSinceLastContact: number;
  recommendedActions: RecommendedAction[];
  insights: string[];
}

export interface RelationshipDashboard {
  userId: string;
  generatedAt: Date;
  
  // Overview
  totalConnections: number;
  healthDistribution: Record<RelationshipHealth, number>;
  riskDistribution: Record<RiskLevel, number>;
  
  // Top insights
  strongestRelationships: PersonHealthSummary[];
  atRiskRelationships: PersonHealthSummary[];
  needsAttention: PersonHealthSummary[];
  
  // Trends
  overallHealthTrend: TrendIndicator;
  activeRelationships: number; // Contacted in last 30 days
  dormantRelationships: number; // Not contacted in 90+ days
  
  // Actions
  urgentActions: RecommendedAction[];
  upcomingActions: RecommendedAction[];
}
