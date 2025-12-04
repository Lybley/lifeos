/**
 * Relationship Agent
 * 
 * AI-powered agent that suggests relationship actions with templated messages
 */

import {
  PersonIntelligence,
  ModelFeatures,
  RecommendedAction,
  ActionType,
  RelationshipInsights,
  RiskFactor,
  RelationshipType,
  DEFAULT_CONFIG,
  PeopleEngineConfig,
} from './peopleModels';
import logger from '../../utils/logger';

// ============================================================================
// RELATIONSHIP AGENT CLASS
// ============================================================================

export class RelationshipAgent {
  private config: PeopleEngineConfig;
  
  constructor(config: PeopleEngineConfig = DEFAULT_CONFIG) {
    this.config = config;
  }
  
  /**
   * Generate recommended actions for a person
   */
  generateRecommendations(
    person: PersonIntelligence,
    features: ModelFeatures,
    insights: RelationshipInsights
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    
    // 1. Check-in recommendations
    const checkInAction = this.evaluateCheckIn(person, features);
    if (checkInAction) actions.push(checkInAction);
    
    // 2. Apology recommendations
    const apologyAction = this.evaluateApology(person, features);
    if (apologyAction) actions.push(apologyAction);
    
    // 3. Share update recommendations
    const updateAction = this.evaluateShareUpdate(person, features);
    if (updateAction) actions.push(updateAction);
    
    // 4. Celebration recommendations
    const celebrateAction = this.evaluateCelebration(person, features);
    if (celebrateAction) actions.push(celebrateAction);
    
    // 5. Follow-up recommendations
    const followUpAction = this.evaluateFollowUp(person, features);
    if (followUpAction) actions.push(followUpAction);
    
    // 6. Meeting recommendations
    const meetingAction = this.evaluateMeeting(person, features);
    if (meetingAction) actions.push(meetingAction);
    
    // 7. Appreciation recommendations
    const appreciationAction = this.evaluateAppreciation(person, features);
    if (appreciationAction) actions.push(appreciationAction);
    
    // Sort by priority
    return actions.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }
  
  /**
   * Evaluate if check-in is needed
   */
  private evaluateCheckIn(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    const daysSince = features.daysSinceLastContact;
    const threshold = this.config.triggers.daysSinceContactForCheckIn;
    
    if (daysSince > threshold) {
      const urgency = daysSince > threshold * 2 ? 'urgent' :
                     daysSince > threshold * 1.5 ? 'high' : 'medium';
      
      const template = this.generateCheckInTemplate(person, daysSince);
      
      return {
        action: ActionType.CHECK_IN,
        priority: urgency as any,
        reason: `No contact in ${Math.floor(daysSince)} days. Relationship may be drifting.`,
        suggestedTiming: new Date(),
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if apology is needed
   */
  private evaluateApology(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Check for negative sentiment streak or high conflict
    if (features.lastSentiment < -0.3 || features.conflictRatio > 0.25) {
      const template = this.generateApologyTemplate(person);
      
      return {
        action: ActionType.APOLOGIZE,
        priority: 'high',
        reason: features.conflictRatio > 0.25
          ? 'Recent interactions show conflict patterns.'
          : 'Recent sentiment is negative. May need to address concerns.',
        suggestedTiming: new Date(),
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if update should be shared
   */
  private evaluateShareUpdate(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Good relationship but low recent activity
    if (features.healthScore > 0.6 && features.daysSinceLastContact > 7 && features.daysSinceLastContact < 30) {
      const template = this.generateUpdateTemplate(person);
      
      return {
        action: ActionType.SHARE_UPDATE,
        priority: 'low',
        reason: 'Strong relationship with moderate gap. Good opportunity to share news.',
        suggestedTiming: new Date(),
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if celebration is warranted
   */
  private evaluateCelebration(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Positive streak or high positive ratio
    if (features.positiveRatio > 0.8 && features.avgSentiment30d > 0.5) {
      const template = this.generateCelebrationTemplate(person);
      
      return {
        action: ActionType.CELEBRATE,
        priority: 'medium',
        reason: 'Relationship is thriving. Acknowledge the positive connection.',
        suggestedTiming: new Date(),
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if follow-up is needed
   */
  private evaluateFollowUp(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Recent conversation but low engagement
    if (features.daysSinceLastContact < 5 && features.avgEngagement < 0.5) {
      const template = this.generateFollowUpTemplate(person);
      
      return {
        action: ActionType.FOLLOW_UP,
        priority: 'medium',
        reason: 'Recent interaction but low engagement. Follow up to deepen connection.',
        suggestedTiming: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if meeting should be scheduled
   */
  private evaluateMeeting(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Frequent text interactions but no face-to-face
    const textOnlyScore = features.channelDiversity < 2 && features.conversationFrequency30d > 10;
    
    if (textOnlyScore && features.healthScore > 0.6) {
      const template = this.generateMeetingTemplate(person);
      
      return {
        action: ActionType.SCHEDULE_MEETING,
        priority: 'medium',
        reason: 'Frequent text interactions. Meeting could strengthen relationship.',
        suggestedTiming: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        template,
      };
    }
    
    return null;
  }
  
  /**
   * Evaluate if appreciation should be sent
   */
  private evaluateAppreciation(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RecommendedAction | null {
    // Consistent mutual engagement
    if (features.mutualEngagementScore > 0.7 && features.reciprocityScore > 0.4 && features.reciprocityScore < 0.6) {
      const template = this.generateAppreciationTemplate(person);
      
      return {
        action: ActionType.SEND_APPRECIATION,
        priority: 'low',
        reason: 'Balanced and engaging relationship. Express gratitude.',
        suggestedTiming: new Date(),
        template,
      };
    }
    
    return null;
  }
  
  // ============================================================================
  // TEMPLATE GENERATORS
  // ============================================================================
  
  private generateCheckInTemplate(person: PersonIntelligence, daysSince: number): string {
    const name = person.name.split(' ')[0]; // First name
    
    const templates = [
      `Hey ${name}! It's been a while since we last connected. How have you been? Would love to catch up soon!`,
      
      `Hi ${name}, I realized it's been ${Math.floor(daysSince)} days since we talked. Hope all is well with you! What's new in your world?`,
      
      `${name}, just checking in! I've been thinking about you and wanted to see how things are going. Any exciting updates?`,
      
      `Hey ${name}! Long time no talk. I'd love to hear what you've been up to lately. Coffee/call sometime soon?`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateApologyTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `Hi ${name}, I wanted to reach out because I feel like our last conversation didn't go as well as I'd hoped. I value our relationship and want to make sure we're on good terms. Can we talk?`,
      
      `${name}, I've been reflecting on our recent interaction and I'm concerned I may have said or done something that upset you. That was never my intention. I'd appreciate the chance to clear the air.`,
      
      `Hey ${name}, I wanted to apologize if I came across the wrong way recently. Our relationship means a lot to me, and I want to make things right. Can we chat?`,
      
      `${name}, I realize I may not have been as attentive/responsive as I should have been. I'm sorry about that. You're important to me, and I want to do better.`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateUpdateTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `Hey ${name}! Quick update: [Share your news here]. I thought you'd be interested to hear about it. How are things on your end?`,
      
      `Hi ${name}, wanted to share some news with you: [Your update]. Would love to hear what you've been working on too!`,
      
      `${name}, hope you're doing well! I wanted to fill you in on [recent development]. What's new with you?`,
      
      `Hey ${name}! Been meaning to tell you about [update]. Also curious to hear what's happening in your world!`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateCelebrationTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `${name}, I just wanted to say how much I appreciate our friendship/relationship. You've been such a positive presence in my life!`,
      
      `Hey ${name}! I was thinking about how great it's been connecting with you lately. Really value our conversations and your perspective.`,
      
      `${name}, wanted to take a moment to tell you how much I appreciate you. Our recent interactions have been really meaningful to me.`,
      
      `Hi ${name}! Just reflecting on how lucky I am to have you in my life. Thanks for being such an amazing [friend/colleague/mentor]!`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateFollowUpTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `Hey ${name}, wanted to follow up on our last conversation. I was thinking more about [topic] and would love to continue that discussion.`,
      
      `Hi ${name}, following up from our chat - did you get a chance to [action item/topic]? Let me know if you need anything!`,
      
      `${name}, just circling back on [topic]. Would be great to hear your thoughts on this when you have a moment.`,
      
      `Hey ${name}, wanted to check in on [previous discussion]. Any updates or thoughts you'd like to share?`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateMeetingTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `Hey ${name}, we've been chatting a lot lately and I think it would be great to meet up in person/have a video call. Are you free next week for coffee/lunch?`,
      
      `Hi ${name}, would love to schedule some time to connect face-to-face. How does your calendar look for a quick meeting?`,
      
      `${name}, I've really enjoyed our recent conversations. Want to take it offline and grab coffee or have a proper catch-up call?`,
      
      `Hey ${name}, let's find time to meet up! Would be great to discuss [topic] in person. What works for you?`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  private generateAppreciationTemplate(person: PersonIntelligence): string {
    const name = person.name.split(' ')[0];
    
    const templates = [
      `${name}, I wanted to express my gratitude for [specific thing]. Your support/input/friendship means a lot to me!`,
      
      `Hey ${name}, just wanted to say thank you for being so reliable and engaged in our relationship. I really appreciate you!`,
      
      `Hi ${name}, I don't say this enough, but I'm really grateful for your [quality/support/friendship]. Thank you!`,
      
      `${name}, wanted to take a moment to acknowledge how much I value our connection. Thanks for being awesome!`,
    ];
    
    return this.selectTemplate(templates, person);
  }
  
  /**
   * Select appropriate template based on relationship context
   */
  private selectTemplate(templates: string[], person: PersonIntelligence): string {
    // For now, use relationship type to select
    // Could be enhanced with ML-based selection
    
    const index = person.relationshipType === RelationshipType.FORMAL ||
                 person.relationshipType === RelationshipType.CLIENT
      ? 1 // More formal template
      : 0; // Casual template
    
    return templates[Math.min(index, templates.length - 1)];
  }
  
  private getPriorityWeight(priority: string): number {
    const weights = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return weights[priority as keyof typeof weights] || 0;
  }
  
  // ============================================================================
  // RISK FACTOR IDENTIFICATION
  // ============================================================================
  
  /**
   * Identify risk factors in the relationship
   */
  identifyRiskFactors(
    person: PersonIntelligence,
    features: ModelFeatures
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];
    
    // 1. Long time since contact
    if (features.daysSinceLastContact > this.config.triggers.daysSinceContactForCheckIn) {
      risks.push({
        factor: 'No Recent Contact',
        severity: features.daysSinceLastContact > 30 ? 'high' : 'medium',
        description: `Last contact was ${Math.floor(features.daysSinceLastContact)} days ago`,
        recommendation: 'Reach out soon with a genuine check-in',
      });
    }
    
    // 2. Declining frequency
    if (features.frequencyTrend < -0.2) {
      risks.push({
        factor: 'Declining Interaction Frequency',
        severity: 'medium',
        description: 'Communication frequency has been decreasing over time',
        recommendation: 'Increase touchpoints and be more proactive in initiating',
      });
    }
    
    // 3. Negative sentiment
    if (features.avgSentiment30d < 0) {
      risks.push({
        factor: 'Negative Sentiment',
        severity: features.avgSentiment30d < -0.5 ? 'high' : 'medium',
        description: 'Recent interactions have had negative sentiment',
        recommendation: 'Address concerns directly and work to improve relationship quality',
      });
    }
    
    // 4. High conflict ratio
    if (features.conflictRatio > 0.2) {
      risks.push({
        factor: 'Frequent Conflicts',
        severity: 'high',
        description: `${(features.conflictRatio * 100).toFixed(0)}% of interactions involve conflict`,
        recommendation: 'Consider conflict resolution strategies or mediation',
      });
    }
    
    // 5. Low engagement
    if (features.avgEngagement < 0.3) {
      risks.push({
        factor: 'Low Engagement',
        severity: 'medium',
        description: 'Both parties show low engagement in conversations',
        recommendation: 'Find topics of mutual interest or new ways to connect',
      });
    }
    
    // 6. Imbalanced initiation
    if (features.reciprocityScore < 0.2 || features.reciprocityScore > 0.8) {
      risks.push({
        factor: 'Imbalanced Initiation',
        severity: 'low',
        description: features.reciprocityScore < 0.5
          ? 'You rarely initiate conversations'
          : 'They rarely initiate conversations',
        recommendation: 'Work toward more balanced initiation of contact',
      });
    }
    
    return risks;
  }
  
  /**
   * Identify relationship strengths
   */
  identifyStrengths(
    person: PersonIntelligence,
    features: ModelFeatures
  ): string[] {
    const strengths: string[] = [];
    
    if (features.positiveRatio > 0.7) {
      strengths.push(`High positive interaction rate (${(features.positiveRatio * 100).toFixed(0)}%)`);
    }
    
    if (features.mutualEngagementScore > 0.7) {
      strengths.push('Strong mutual engagement in conversations');
    }
    
    if (features.reciprocityScore > 0.4 && features.reciprocityScore < 0.6) {
      strengths.push('Balanced initiation of contact');
    }
    
    if (features.avgSentiment30d > 0.5) {
      strengths.push('Consistently positive sentiment');
    }
    
    if (features.conversationFrequency30d > 10) {
      strengths.push('Frequent and regular communication');
    }
    
    if (features.responseTimeConsistency > 0.7) {
      strengths.push('Reliable and consistent response patterns');
    }
    
    if (features.channelDiversity > 2) {
      strengths.push('Diverse communication channels');
    }
    
    return strengths;
  }
}
