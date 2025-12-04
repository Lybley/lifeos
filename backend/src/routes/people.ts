/**
 * People Intelligence API Routes
 * 
 * Endpoints for accessing relationship health metrics and recommended actions
 */

import { Router, Request, Response } from 'express';
import { postgresClient } from '../config/postgres';
import { RelationshipAgent } from '../services/people/RelationshipAgent';
import {
  computeModelFeatures,
  computeHealthScore,
  classifyHealthStatus,
  computeChurnRisk,
  classifyRiskLevel,
  classifyCommunicationStyle,
} from '../services/people/featureEngine';
import {
  PersonIntelligence,
  ConversationMetadata,
  WeeklyFeatures,
  PersonHealthSummary,
  RelationshipDashboard,
  RelationshipHealth,
  RiskLevel,
} from '../services/people/peopleModels';
import logger from '../utils/logger';

const router = Router();
const relationshipAgent = new RelationshipAgent();

/**
 * GET /api/v1/people/:id/health
 * Get comprehensive health metrics and recommended actions for a person
 */
router.get('/:id/health', async (req: Request, res: Response) => {
  try {
    const personId = req.params.id;
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    // Fetch person data
    const personResult = await postgresClient.query(
      'SELECT * FROM people WHERE id = $1 AND user_id = $2',
      [personId, userId]
    );
    
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    const personRow = personResult.rows[0];
    const person: PersonIntelligence = mapRowToPerson(personRow);
    
    // Fetch conversations (last 90 days)
    const conversationsResult = await postgresClient.query(
      `SELECT * FROM conversations 
       WHERE person_id = $1 
       AND timestamp >= NOW() - INTERVAL '90 days'
       ORDER BY timestamp DESC`,
      [personId]
    );
    
    const conversations: ConversationMetadata[] = conversationsResult.rows.map(mapRowToConversation);
    
    // Fetch weekly features
    const weeklyResult = await postgresClient.query(
      `SELECT * FROM weekly_features 
       WHERE person_id = $1 
       ORDER BY week_start DESC 
       LIMIT 12`,
      [personId]
    );
    
    const weeklyFeatures: WeeklyFeatures[] = weeklyResult.rows.map(mapRowToWeeklyFeatures);
    
    // Compute features
    const features = computeModelFeatures(person, conversations, weeklyFeatures);
    
    // Compute health metrics
    const healthScore = computeHealthScore({
      daysSinceLastContact: features.daysSinceLastContact,
      avgSentiment30d: features.avgSentiment30d,
      freq30d: features.conversationFrequency30d,
      avgEngagement: features.avgEngagement,
      conflictRatio: features.conflictRatio,
      positiveRatio: features.positiveRatio,
    });
    
    const healthStatus = classifyHealthStatus(healthScore);
    const churnRisk = computeChurnRisk(features);
    const riskLevel = classifyRiskLevel(churnRisk);
    
    // Generate insights
    const insights = {
      personId,
      userId,
      computedAt: new Date(),
      healthScore: healthScore * 100,
      healthStatus,
      riskFactors: relationshipAgent.identifyRiskFactors(person, features),
      strengths: relationshipAgent.identifyStrengths(person, features),
      strengthTrend: {
        direction: features.frequencyTrend > 0 ? 'up' : features.frequencyTrend < 0 ? 'down' : 'stable',
        magnitude: Math.abs(features.frequencyTrend),
        confidence: 0.7,
      },
      sentimentTrend: {
        direction: features.sentimentMomentum > 0 ? 'up' : features.sentimentMomentum < 0 ? 'down' : 'stable',
        magnitude: Math.abs(features.sentimentMomentum),
        confidence: 0.8,
      },
      frequencyTrend: {
        direction: features.frequencyTrend > 0 ? 'up' : features.frequencyTrend < 0 ? 'down' : 'stable',
        magnitude: Math.abs(features.frequencyTrend),
        confidence: 0.75,
      },
      churnRisk,
      nextContactPrediction: new Date(Date.now() + features.daysSinceLastContact * 24 * 60 * 60 * 1000),
      recommendedActions: [],
      comparisonToPeers: {
        percentile: 65, // TODO: Compute from database
        avgHealthScore: 68,
      },
    };
    
    // Generate recommendations
    const recommendations = relationshipAgent.generateRecommendations(person, features, insights);
    
    // Prepare response
    const response = {
      person: {
        id: person.personId,
        name: person.name,
        email: person.email,
        relationshipType: person.relationshipType,
      },
      
      metrics: {
        healthScore: healthScore * 100,
        healthStatus,
        riskLevel,
        churnRisk,
        
        relationshipStrength: person.relationshipStrength,
        trustScore: person.trustScore,
        
        daysSinceLastContact: features.daysSinceLastContact,
        totalInteractions: person.totalInteractions,
        
        sentimentTrend: features.avgSentiment30d,
        conversationFrequency: features.conversationFrequency30d,
        avgEngagement: features.avgEngagement,
        
        communicationStyle: person.commStyle,
        responseTimeAvg: person.responseTimeAvg,
        initiationRatio: person.initiationRatio,
      },
      
      insights: {
        riskFactors: insights.riskFactors,
        strengths: insights.strengths,
        trends: {
          strength: insights.strengthTrend,
          sentiment: insights.sentimentTrend,
          frequency: insights.frequencyTrend,
        },
      },
      
      recommendations: recommendations.map(r => ({
        action: r.action,
        priority: r.priority,
        reason: r.reason,
        suggestedTiming: r.suggestedTiming,
        template: r.template,
      })),
      
      recentActivity: {
        conversations7d: features.conversationFrequency7d,
        conversations30d: features.conversationFrequency30d,
        avgSentiment7d: features.avgSentiment7d,
        avgSentiment30d: features.avgSentiment30d,
      },
      
      comparison: insights.comparisonToPeers,
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to get person health', { error, personId: req.params.id });
    res.status(500).json({
      error: 'Failed to retrieve person health metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/people/dashboard
 * Get overall relationship dashboard for user
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    // Get dashboard view data
    const dashboardResult = await postgresClient.query(
      'SELECT * FROM relationship_health_dashboard WHERE user_id = $1',
      [userId]
    );
    
    if (dashboardResult.rows.length === 0) {
      return res.json(createEmptyDashboard(userId));
    }
    
    const dashData = dashboardResult.rows[0];
    
    // Get top relationships by health
    const strongestResult = await postgresClient.query(
      `SELECT p.id, p.name, p.relationship_health, p.relationship_strength, 
              EXTRACT(DAY FROM NOW() - p.last_contact) as days_since_contact
       FROM people p
       WHERE p.user_id = $1 
       AND p.relationship_health IN ('excellent', 'good')
       ORDER BY p.relationship_strength DESC
       LIMIT 5`,
      [userId]
    );
    
    // Get at-risk relationships
    const atRiskResult = await postgresClient.query(
      'SELECT * FROM at_risk_relationships WHERE user_id = $1 LIMIT 10',
      [userId]
    );
    
    // Get pending actions
    const actionsResult = await postgresClient.query(
      `SELECT ra.*, p.name as person_name
       FROM recommended_actions ra
       JOIN people p ON ra.person_id = p.id
       WHERE ra.user_id = $1 
       AND ra.status = 'pending'
       ORDER BY 
         CASE ra.priority
           WHEN 'urgent' THEN 4
           WHEN 'high' THEN 3
           WHEN 'medium' THEN 2
           ELSE 1
         END DESC,
         ra.suggested_timing ASC
       LIMIT 20`,
      [userId]
    );
    
    const dashboard: RelationshipDashboard = {
      userId,
      generatedAt: new Date(),
      
      totalConnections: dashData.total_connections,
      healthDistribution: {
        [RelationshipHealth.EXCELLENT]: dashData.excellent_count,
        [RelationshipHealth.GOOD]: dashData.good_count,
        [RelationshipHealth.FAIR]: dashData.fair_count,
        [RelationshipHealth.AT_RISK]: dashData.at_risk_count,
        [RelationshipHealth.NEEDS_ATTENTION]: dashData.needs_attention_count,
      },
      riskDistribution: {
        [RiskLevel.NONE]: 0,
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: dashData.high_risk_count,
        [RiskLevel.CRITICAL]: 0,
      },
      
      strongestRelationships: strongestResult.rows.map(r => ({
        personId: r.id,
        name: r.name,
        relationshipHealth: r.relationship_health,
        healthScore: r.relationship_strength * 100,
        riskLevel: RiskLevel.LOW,
        daysSinceLastContact: r.days_since_contact || 0,
        recommendedActions: [],
        insights: [],
      })),
      
      atRiskRelationships: atRiskResult.rows.map(r => ({
        personId: r.id,
        name: r.name,
        relationshipHealth: r.relationship_health,
        healthScore: r.health_score || 0,
        riskLevel: r.risk_level,
        daysSinceLastContact: r.days_since_contact || 9999,
        recommendedActions: [],
        insights: [],
      })),
      
      needsAttention: atRiskResult.rows.slice(0, 5).map(r => ({
        personId: r.id,
        name: r.name,
        relationshipHealth: r.relationship_health,
        healthScore: r.health_score || 0,
        riskLevel: r.risk_level,
        daysSinceLastContact: r.days_since_contact || 9999,
        recommendedActions: [],
        insights: [`${r.pending_actions} pending actions`],
      })),
      
      overallHealthTrend: {
        direction: 'stable',
        magnitude: 0,
        confidence: 0.5,
      },
      
      activeRelationships: dashData.active_last_30d,
      dormantRelationships: dashData.dormant_90d,
      
      urgentActions: actionsResult.rows
        .filter(r => r.priority === 'urgent')
        .map(r => ({
          action: r.action_type,
          priority: r.priority,
          reason: r.reason,
          suggestedTiming: r.suggested_timing,
          template: r.template,
        })),
      
      upcomingActions: actionsResult.rows
        .filter(r => r.priority !== 'urgent')
        .map(r => ({
          action: r.action_type,
          priority: r.priority,
          reason: r.reason,
          suggestedTiming: r.suggested_timing,
          template: r.template,
        })),
    };
    
    res.json(dashboard);
    
  } catch (error) {
    logger.error('Failed to get dashboard', { error });
    res.status(500).json({
      error: 'Failed to retrieve relationship dashboard',
    });
  }
});

/**
 * GET /api/v1/people
 * List all people for a user with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const healthFilter = req.query.health as string;
    const riskFilter = req.query.risk as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    let query = 'SELECT * FROM people WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;
    
    if (healthFilter) {
      query += ` AND relationship_health = $${paramIndex}`;
      params.push(healthFilter);
      paramIndex++;
    }
    
    if (riskFilter) {
      query += ` AND risk_level = $${paramIndex}`;
      params.push(riskFilter);
      paramIndex++;
    }
    
    query += ' ORDER BY relationship_strength DESC, last_contact DESC';
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await postgresClient.query(query, params);
    
    const people = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      relationshipType: r.relationship_type,
      relationshipStrength: parseFloat(r.relationship_strength),
      relationshipHealth: r.relationship_health,
      riskLevel: r.risk_level,
      lastContact: r.last_contact,
      totalInteractions: r.total_interactions,
      sentimentTrend: parseFloat(r.sentiment_trend),
      commStyle: r.comm_style,
    }));
    
    res.json({
      count: people.length,
      people,
    });
    
  } catch (error) {
    logger.error('Failed to list people', { error });
    res.status(500).json({ error: 'Failed to retrieve people' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapRowToPerson(row: any): PersonIntelligence {
  return {
    personId: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    relationshipStrength: parseFloat(row.relationship_strength),
    conversationFrequency: parseFloat(row.conversation_frequency),
    sentimentTrend: parseFloat(row.sentiment_trend),
    trustScore: parseFloat(row.trust_score),
    commStyle: row.comm_style,
    responseTimeAvg: parseFloat(row.response_time_avg),
    initiationRatio: parseFloat(row.initiation_ratio),
    lastContact: row.last_contact,
    firstContact: row.first_contact,
    totalInteractions: row.total_interactions,
    relationshipHealth: row.relationship_health,
    riskLevel: row.risk_level,
    engagementTrend: row.engagement_trend,
    relationshipType: row.relationship_type,
    tags: row.tags || [],
    notes: row.notes,
    lastUpdated: row.updated_at,
    nextSuggestedContact: row.next_suggested_contact,
  };
}

function mapRowToConversation(row: any): ConversationMetadata {
  return {
    conversationId: row.id,
    personId: row.person_id,
    userId: row.user_id,
    timestamp: row.timestamp,
    duration: row.duration,
    initiatedBy: row.initiated_by,
    messageCount: row.message_count,
    wordCount: row.word_count,
    sentiment: {
      overall: parseFloat(row.sentiment_overall),
      compound: parseFloat(row.sentiment_compound),
      positive: parseFloat(row.sentiment_positive),
      negative: parseFloat(row.sentiment_negative),
      neutral: parseFloat(row.sentiment_neutral),
      confidence: parseFloat(row.sentiment_confidence),
    },
    topics: row.topics || [],
    responseTime: row.response_time ? parseFloat(row.response_time) : undefined,
    userEngagement: parseFloat(row.user_engagement),
    personEngagement: parseFloat(row.person_engagement),
    channel: row.channel,
    hadConflict: row.had_conflict,
    wasPositive: row.was_positive,
    wasProductive: row.was_productive,
  };
}

function mapRowToWeeklyFeatures(row: any): WeeklyFeatures {
  return {
    personId: row.person_id,
    userId: row.user_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    conversationCount: row.conversation_count,
    totalDuration: row.total_duration,
    messageCount: row.message_count,
    userInitiated: row.user_initiated,
    personInitiated: row.person_initiated,
    initiationRatio: parseFloat(row.initiation_ratio),
    avgResponseTime: parseFloat(row.avg_response_time),
    maxResponseTime: parseFloat(row.max_response_time),
    missedResponses: row.missed_responses,
    avgSentiment: parseFloat(row.avg_sentiment),
    sentimentVariance: parseFloat(row.sentiment_variance),
    positiveInteractions: row.positive_interactions,
    negativeInteractions: row.negative_interactions,
    avgUserEngagement: parseFloat(row.avg_user_engagement),
    avgPersonEngagement: parseFloat(row.avg_person_engagement),
    mutualEngagement: parseFloat(row.mutual_engagement),
    conflictCount: row.conflict_count,
    productiveCount: row.productive_count,
    channelDistribution: row.channel_distribution || {},
    preferredChannel: row.preferred_channel,
  };
}

function createEmptyDashboard(userId: string): RelationshipDashboard {
  return {
    userId,
    generatedAt: new Date(),
    totalConnections: 0,
    healthDistribution: {} as any,
    riskDistribution: {} as any,
    strongestRelationships: [],
    atRiskRelationships: [],
    needsAttention: [],
    overallHealthTrend: { direction: 'stable', magnitude: 0, confidence: 0 },
    activeRelationships: 0,
    dormantRelationships: 0,
    urgentActions: [],
    upcomingActions: [],
  };
}

export default router;
