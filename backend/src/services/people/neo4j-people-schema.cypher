// ============================================================================
// PEOPLE INTELLIGENCE ENGINE - NEO4J GRAPH SCHEMA
// ============================================================================

// ----------------------------------------------------------------------------
// NODE CONSTRAINTS & INDEXES
// ----------------------------------------------------------------------------

// Person Node Constraint
CREATE CONSTRAINT person_id_unique IF NOT EXISTS
FOR (p:Person) REQUIRE p.id IS UNIQUE;

// Conversation Node Constraint
CREATE CONSTRAINT conversation_id_unique IF NOT EXISTS
FOR (c:Conversation) REQUIRE c.id IS UNIQUE;

// Indexes for Person properties
CREATE INDEX person_user_idx IF NOT EXISTS
FOR (p:Person) ON (p.userId);

CREATE INDEX person_health_idx IF NOT EXISTS
FOR (p:Person) ON (p.relationshipHealth);

CREATE INDEX person_risk_idx IF NOT EXISTS
FOR (p:Person) ON (p.riskLevel);

CREATE INDEX person_strength_idx IF NOT EXISTS
FOR (p:Person) ON (p.relationshipStrength);

// Indexes for Conversation properties
CREATE INDEX conversation_timestamp_idx IF NOT EXISTS
FOR (c:Conversation) ON (c.timestamp);

CREATE INDEX conversation_sentiment_idx IF NOT EXISTS
FOR (c:Conversation) ON (c.sentimentOverall);

// Full-text search for person names
CREATE FULLTEXT INDEX person_name_fulltext IF NOT EXISTS
FOR (p:Person) ON EACH [p.name, p.email];

// ----------------------------------------------------------------------------
// ENHANCED PERSON NODE STRUCTURE
// ----------------------------------------------------------------------------

/*
CREATE (p:Person {
  id: 'person_001',
  userId: 'user_123',
  
  // Core identity
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  phone: '+1-555-0123',
  
  // Relationship metrics (0-1)
  relationshipStrength: 0.85,
  conversationFrequency: 0.72,
  sentimentTrend: 0.65,
  trustScore: 0.90,
  
  // Communication patterns
  commStyle: 'responsive',
  responseTimeAvg: 3.5, // hours
  initiationRatio: 0.55,
  
  // Temporal
  lastContact: datetime('2025-01-14T15:30:00Z'),
  firstContact: datetime('2024-03-15T10:00:00Z'),
  totalInteractions: 87,
  
  // Derived insights
  relationshipHealth: 'excellent',
  riskLevel: 'low',
  engagementTrend: 'improving',
  
  // Context
  relationshipType: 'colleague',
  tags: ['marketing', 'project-alpha', 'mentor'],
  notes: 'Key stakeholder for project alpha',
  
  // Metadata
  createdAt: datetime(),
  updatedAt: datetime(),
  nextSuggestedContact: datetime('2025-01-20T10:00:00Z')
})
*/

// ----------------------------------------------------------------------------
// CONVERSATION NODE STRUCTURE
// ----------------------------------------------------------------------------

/*
CREATE (c:Conversation {
  id: 'conv_001',
  personId: 'person_001',
  userId: 'user_123',
  
  // Temporal
  timestamp: datetime('2025-01-14T15:30:00Z'),
  duration: 25, // minutes
  
  // Participants
  initiatedBy: 'user',
  
  // Content
  messageCount: 12,
  wordCount: 450,
  topics: ['project-update', 'deadline', 'resources'],
  
  // Sentiment
  sentimentOverall: 0.65,
  sentimentCompound: 0.72,
  sentimentPositive: 0.75,
  sentimentNegative: 0.10,
  sentimentNeutral: 0.15,
  sentimentConfidence: 0.88,
  
  // Response
  responseTime: 2.5, // hours
  userEngagement: 0.85,
  personEngagement: 0.80,
  
  // Channel
  channel: 'email',
  
  // Quality
  hadConflict: false,
  wasPositive: true,
  wasProductive: true,
  
  createdAt: datetime()
})
*/

// ----------------------------------------------------------------------------
// RELATIONSHIP TYPES & PROPERTIES
// ----------------------------------------------------------------------------

// HAS_CONVERSATION: Person ← User had conversation
// Properties: none (conversation details in Conversation node)

// INITIATED_BY: Conversation → Person (who started it)
// Properties: none

// SIMILAR_COMMUNICATION: Person → Person (similar comm patterns)
// Properties: similarityScore (0-1), basis (string)

// INFLUENCES: Person → Person (one person influences another)
// Properties: strength (0-1), type (string)

// BELONGS_TO_NETWORK: Person → Network (social network grouping)
// Properties: role (string), joinedAt (datetime)

// RECOMMENDED_ACTION: Person → Action (suggested action)
// Properties: priority (string), createdAt (datetime), status (string)

// HAS_RISK_FACTOR: Person → RiskFactor
// Properties: severity (string), identifiedAt (datetime)

// HAS_STRENGTH: Person → Strength
// Properties: value (string), identifiedAt (datetime)

// ----------------------------------------------------------------------------
// SAMPLE GRAPH CREATION
// ----------------------------------------------------------------------------

/*
// Create user
CREATE (u:User {
  id: 'user_123',
  name: 'John Doe',
  email: 'john@example.com'
})

// Create people with varied relationship health
CREATE (p1:Person {
  id: 'person_001',
  userId: 'user_123',
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  relationshipStrength: 0.85,
  sentimentTrend: 0.65,
  trustScore: 0.90,
  commStyle: 'responsive',
  relationshipHealth: 'excellent',
  riskLevel: 'low',
  relationshipType: 'colleague',
  lastContact: datetime('2025-01-14T15:30:00Z'),
  totalInteractions: 87
})

CREATE (p2:Person {
  id: 'person_002',
  userId: 'user_123',
  name: 'Mike Chen',
  email: 'mike@example.com',
  relationshipStrength: 0.60,
  sentimentTrend: -0.20,
  trustScore: 0.55,
  commStyle: 'slow',
  relationshipHealth: 'at_risk',
  riskLevel: 'high',
  relationshipType: 'client',
  lastContact: datetime('2024-12-15T10:00:00Z'),
  totalInteractions: 23
})

CREATE (p3:Person {
  id: 'person_003',
  userId: 'user_123',
  name: 'Emily Davis',
  email: 'emily@example.com',
  relationshipStrength: 0.92,
  sentimentTrend: 0.80,
  trustScore: 0.95,
  commStyle: 'casual',
  relationshipHealth: 'excellent',
  riskLevel: 'none',
  relationshipType: 'friend',
  lastContact: datetime('2025-01-13T20:00:00Z'),
  totalInteractions: 234
})

// Create conversations
CREATE (c1:Conversation {
  id: 'conv_001',
  personId: 'person_001',
  timestamp: datetime('2025-01-14T15:30:00Z'),
  sentimentOverall: 0.65,
  userEngagement: 0.85,
  personEngagement: 0.80,
  channel: 'email',
  initiatedBy: 'user',
  wasPositive: true
})

CREATE (c2:Conversation {
  id: 'conv_002',
  personId: 'person_002',
  timestamp: datetime('2024-12-15T10:00:00Z'),
  sentimentOverall: -0.35,
  userEngagement: 0.45,
  personEngagement: 0.30,
  channel: 'email',
  initiatedBy: 'user',
  hadConflict: true
})

// Create relationships
MATCH (u:User {id: 'user_123'})
MATCH (p1:Person {id: 'person_001'})
MATCH (c1:Conversation {id: 'conv_001'})
CREATE (u)-[:KNOWS]->(p1)
CREATE (p1)-[:HAS_CONVERSATION]->(c1)
CREATE (c1)-[:INITIATED_BY]->(u)

MATCH (u:User {id: 'user_123'})
MATCH (p2:Person {id: 'person_002'})
MATCH (c2:Conversation {id: 'conv_002'})
CREATE (u)-[:KNOWS]->(p2)
CREATE (p2)-[:HAS_CONVERSATION]->(c2)
CREATE (c2)-[:INITIATED_BY]->(u)

// Create similar communication pattern link
MATCH (p1:Person {id: 'person_001'})
MATCH (p3:Person {id: 'person_003'})
CREATE (p1)-[:SIMILAR_COMMUNICATION {
  similarityScore: 0.82,
  basis: 'responsive_and_engaged'
}]->(p3)

// Create recommended action
CREATE (a1:RecommendedAction {
  id: 'action_001',
  personId: 'person_002',
  actionType: 'check_in',
  priority: 'urgent',
  reason: 'No contact in 30 days, declining sentiment',
  template: 'Hey Mike, wanted to check in...',
  status: 'pending',
  createdAt: datetime()
})

MATCH (p2:Person {id: 'person_002'})
MATCH (a1:RecommendedAction {id: 'action_001'})
CREATE (p2)-[:HAS_RECOMMENDED_ACTION]->(a1)
*/

// ----------------------------------------------------------------------------
// QUERY PATTERNS
// ----------------------------------------------------------------------------

// Query 1: Get person with full intelligence data
/*
MATCH (p:Person {userId: $userId, id: $personId})
OPTIONAL MATCH (p)-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime() - duration({days: 30})
WITH p, collect(c) as recentConversations
RETURN p, 
       recentConversations,
       size(recentConversations) as conversationCount30d,
       avg([c IN recentConversations | c.sentimentOverall]) as avgSentiment30d
*/

// Query 2: Get at-risk relationships
/*
MATCH (p:Person {userId: $userId})
WHERE p.riskLevel IN ['high', 'critical']
   OR p.relationshipHealth IN ['at_risk', 'needs_attention']
OPTIONAL MATCH (p)-[:HAS_RECOMMENDED_ACTION]->(a:RecommendedAction)
WHERE a.status = 'pending'
RETURN p, collect(a) as pendingActions
ORDER BY p.riskLevel DESC, 
         duration.between(p.lastContact, datetime()).days DESC
LIMIT 20
*/

// Query 3: Get people needing attention (no recent contact)
/*
MATCH (p:Person {userId: $userId})
WHERE duration.between(p.lastContact, datetime()).days > 14
  AND p.relationshipStrength > 0.5
RETURN p
ORDER BY duration.between(p.lastContact, datetime()).days DESC
LIMIT 10
*/

// Query 4: Get relationship health distribution
/*
MATCH (p:Person {userId: $userId})
WITH p.relationshipHealth as health, count(*) as count
RETURN health, count
ORDER BY count DESC
*/

// Query 5: Get strongest relationships
/*
MATCH (p:Person {userId: $userId})
WHERE p.relationshipStrength > 0.7
OPTIONAL MATCH (p)-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime() - duration({days: 7})
RETURN p, count(c) as recentConversations
ORDER BY p.relationshipStrength DESC, recentConversations DESC
LIMIT 10
*/

// Query 6: Get conversation timeline for person
/*
MATCH (p:Person {id: $personId})-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime($startDate)
  AND c.timestamp <= datetime($endDate)
RETURN c
ORDER BY c.timestamp DESC
*/

// Query 7: Find people with similar communication styles
/*
MATCH (p1:Person {id: $personId})
MATCH (p2:Person {userId: p1.userId})
WHERE p2.id <> p1.id
  AND p2.commStyle = p1.commStyle
  AND abs(p2.responseTimeAvg - p1.responseTimeAvg) < 5
RETURN p2, 
       abs(p2.responseTimeAvg - p1.responseTimeAvg) as timeDiff
ORDER BY timeDiff ASC
LIMIT 5
*/

// Query 8: Get network of mutual connections (if tracking)
/*
MATCH (p1:Person {id: $personId})-[:KNOWS]-(p2:Person)
WHERE p2.userId = p1.userId
RETURN p1, collect(p2) as connections
*/

// Query 9: Track sentiment trends over time
/*
MATCH (p:Person {id: $personId})-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime() - duration({days: 90})
WITH c
ORDER BY c.timestamp
RETURN date(c.timestamp) as date,
       avg(c.sentimentOverall) as avgSentiment,
       count(c) as conversationCount
*/

// Query 10: Get recommended actions sorted by priority
/*
MATCH (p:Person {userId: $userId})-[:HAS_RECOMMENDED_ACTION]->(a:RecommendedAction)
WHERE a.status = 'pending'
  AND a.suggestedTiming <= datetime()
WITH p, a,
     CASE a.priority
       WHEN 'urgent' THEN 4
       WHEN 'high' THEN 3
       WHEN 'medium' THEN 2
       ELSE 1
     END as priorityWeight
RETURN p.name as personName,
       a.actionType,
       a.priority,
       a.reason,
       a.template
ORDER BY priorityWeight DESC, a.createdAt ASC
LIMIT 20
*/

// ----------------------------------------------------------------------------
// ANALYTICS QUERIES
// ----------------------------------------------------------------------------

// Overall relationship health metrics
/*
MATCH (p:Person {userId: $userId})
WITH 
  count(p) as totalPeople,
  avg(p.relationshipStrength) as avgStrength,
  avg(p.trustScore) as avgTrust,
  sum(CASE WHEN p.relationshipHealth = 'excellent' THEN 1 ELSE 0 END) as excellent,
  sum(CASE WHEN p.relationshipHealth = 'good' THEN 1 ELSE 0 END) as good,
  sum(CASE WHEN p.relationshipHealth = 'fair' THEN 1 ELSE 0 END) as fair,
  sum(CASE WHEN p.relationshipHealth = 'at_risk' THEN 1 ELSE 0 END) as atRisk,
  sum(CASE WHEN p.relationshipHealth = 'needs_attention' THEN 1 ELSE 0 END) as needsAttention
RETURN 
  totalPeople,
  avgStrength,
  avgTrust,
  excellent,
  good,
  fair,
  atRisk,
  needsAttention,
  (excellent + good) * 1.0 / totalPeople as healthyRatio
*/

// Engagement trends
/*
MATCH (p:Person {userId: $userId})-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime() - duration({days: 30})
WITH date.truncate('week', c.timestamp) as week,
     avg(c.userEngagement) as avgUserEngagement,
     avg(c.personEngagement) as avgPersonEngagement,
     count(c) as conversationCount
RETURN week, avgUserEngagement, avgPersonEngagement, conversationCount
ORDER BY week
*/

// Communication channel preferences
/*
MATCH (p:Person {userId: $userId})-[:HAS_CONVERSATION]->(c:Conversation)
WHERE c.timestamp >= datetime() - duration({days: 30})
RETURN c.channel as channel,
       count(*) as count,
       avg(c.sentimentOverall) as avgSentiment,
       avg(c.userEngagement) as avgEngagement
ORDER BY count DESC
*/
