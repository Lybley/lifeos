/**
 * Multi-Layer Memory Architecture
 * 
 * Defines memory types, scoring algorithms, and decay/reinforcement rules
 * for the Personal Memory Graph (PMG)
 */

// ============================================================================
// MEMORY TYPE DEFINITIONS
// ============================================================================

export enum MemoryType {
  WORKING = 'working',       // Short-term, actively used
  EPISODIC = 'episodic',     // Personal experiences, events
  SEMANTIC = 'semantic',     // Facts, knowledge, concepts
  SOCIAL = 'social',         // People, relationships, interactions
  EMOTIONAL = 'emotional',   // Emotional states, feelings, reactions
}

export interface MemoryMetadata {
  memoryType: MemoryType;
  
  // Temporal properties
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt?: Date;
  
  // Scoring properties
  importanceScore: number;    // 0-1: Intrinsic importance
  recencyScore: number;       // 0-1: Time-based relevance
  frequencyScore: number;     // 0-1: Access frequency
  emotionalScore: number;     // 0-1: Emotional intensity
  socialScore: number;        // 0-1: Social significance
  
  // Reinforcement tracking
  accessCount: number;
  lastReinforcedAt?: Date;
  reinforcementCount: number;
  
  // Decay properties
  decayRate: number;          // How fast it decays (0-1)
  halfLife: number;           // Time in hours for 50% decay
  
  // Context
  context: string[];          // Tags, categories
  relatedMemories: string[];  // IDs of connected memories
  
  // Source tracking
  source: string;             // Origin (email, calendar, manual, etc.)
  userId: string;
}

// ============================================================================
// MEMORY TYPE CHARACTERISTICS
// ============================================================================

export interface MemoryTypeConfig {
  defaultImportance: number;
  defaultDecayRate: number;
  defaultHalfLife: number;    // hours
  maxRetentionDays: number;
  requiresReinforcement: boolean;
  vectorIndexSuffix: string;
}

export const MEMORY_TYPE_CONFIGS: Record<MemoryType, MemoryTypeConfig> = {
  [MemoryType.WORKING]: {
    defaultImportance: 0.9,
    defaultDecayRate: 0.8,       // Decays quickly
    defaultHalfLife: 2,           // 2 hours
    maxRetentionDays: 7,          // Max 7 days in working memory
    requiresReinforcement: true,
    vectorIndexSuffix: 'working',
  },
  
  [MemoryType.EPISODIC]: {
    defaultImportance: 0.7,
    defaultDecayRate: 0.3,       // Moderate decay
    defaultHalfLife: 168,         // 7 days
    maxRetentionDays: 365,        // Keep for 1 year
    requiresReinforcement: true,
    vectorIndexSuffix: 'episodic',
  },
  
  [MemoryType.SEMANTIC]: {
    defaultImportance: 0.8,
    defaultDecayRate: 0.1,       // Very slow decay
    defaultHalfLife: 720,         // 30 days
    maxRetentionDays: 1825,       // Keep for 5 years
    requiresReinforcement: false,
    vectorIndexSuffix: 'semantic',
  },
  
  [MemoryType.SOCIAL]: {
    defaultImportance: 0.75,
    defaultDecayRate: 0.2,       // Slow decay
    defaultHalfLife: 336,         // 14 days
    maxRetentionDays: 730,        // Keep for 2 years
    requiresReinforcement: true,
    vectorIndexSuffix: 'social',
  },
  
  [MemoryType.EMOTIONAL]: {
    defaultImportance: 0.85,
    defaultDecayRate: 0.4,       // Moderate-fast decay
    defaultHalfLife: 72,          // 3 days
    maxRetentionDays: 365,        // Keep for 1 year
    requiresReinforcement: true,
    vectorIndexSuffix: 'emotional',
  },
};

// ============================================================================
// SCORING ALGORITHMS
// ============================================================================

/**
 * Calculate recency score based on time decay
 * Uses exponential decay: score = e^(-λt)
 */
export function calculateRecencyScore(
  createdAt: Date,
  lastAccessedAt: Date,
  decayRate: number,
  halfLife: number
): number {
  const now = new Date();
  const timeSinceAccess = (now.getTime() - lastAccessedAt.getTime()) / (1000 * 60 * 60); // hours
  
  // Exponential decay formula
  const lambda = Math.log(2) / halfLife;
  const score = Math.exp(-lambda * timeSinceAccess * decayRate);
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate frequency score based on access patterns
 * Uses logarithmic scaling to prevent over-weighting frequent items
 */
export function calculateFrequencyScore(
  accessCount: number,
  reinforcementCount: number
): number {
  const totalInteractions = accessCount + (reinforcementCount * 2); // Reinforcements count double
  
  // Logarithmic scaling: log(1 + count) / log(1 + maxExpected)
  const maxExpected = 100;
  const score = Math.log(1 + totalInteractions) / Math.log(1 + maxExpected);
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate composite memory score
 * Weighted combination of all factors
 */
export function calculateMemoryScore(metadata: MemoryMetadata): number {
  const weights = {
    importance: 0.3,
    recency: 0.25,
    frequency: 0.20,
    emotional: 0.15,
    social: 0.10,
  };
  
  const score = 
    (metadata.importanceScore * weights.importance) +
    (metadata.recencyScore * weights.recency) +
    (metadata.frequencyScore * weights.frequency) +
    (metadata.emotionalScore * weights.emotional) +
    (metadata.socialScore * weights.social);
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Determine if memory should be promoted to different layer
 */
export function shouldPromoteMemory(metadata: MemoryMetadata): MemoryType | null {
  const compositeScore = calculateMemoryScore(metadata);
  const age = (Date.now() - metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days
  
  // Working → Episodic: High importance + frequent access
  if (metadata.memoryType === MemoryType.WORKING) {
    if (compositeScore > 0.7 && metadata.accessCount > 5 && age > 1) {
      return MemoryType.EPISODIC;
    }
  }
  
  // Episodic → Semantic: Very high importance + low emotional content
  if (metadata.memoryType === MemoryType.EPISODIC) {
    if (
      metadata.importanceScore > 0.8 &&
      metadata.emotionalScore < 0.3 &&
      metadata.accessCount > 10 &&
      age > 30
    ) {
      return MemoryType.SEMANTIC;
    }
  }
  
  return null;
}

/**
 * Determine if memory should be demoted or archived
 */
export function shouldArchiveMemory(metadata: MemoryMetadata): boolean {
  const compositeScore = calculateMemoryScore(metadata);
  const age = (Date.now() - metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days
  const config = MEMORY_TYPE_CONFIGS[metadata.memoryType];
  
  // Archive if expired
  if (metadata.expiresAt && new Date() > metadata.expiresAt) {
    return true;
  }
  
  // Archive if beyond max retention
  if (age > config.maxRetentionDays) {
    return true;
  }
  
  // Archive if score too low and old
  if (compositeScore < 0.1 && age > 30) {
    return true;
  }
  
  return false;
}

// ============================================================================
// REINFORCEMENT LOGIC
// ============================================================================

export interface ReinforcementResult {
  newImportanceScore: number;
  newRecencyScore: number;
  shouldBoost: boolean;
  boostReason?: string;
}

/**
 * Apply reinforcement when memory is accessed
 */
export function reinforceMemory(
  metadata: MemoryMetadata,
  contextualRelevance: number // 0-1: How relevant to current context
): ReinforcementResult {
  const now = new Date();
  const timeSinceLastAccess = (now.getTime() - metadata.lastAccessedAt.getTime()) / (1000 * 60 * 60);
  
  // Boost importance based on contextual relevance
  const importanceBoost = contextualRelevance * 0.1;
  const newImportanceScore = Math.min(1, metadata.importanceScore + importanceBoost);
  
  // Reset recency score to high value
  const newRecencyScore = 0.95;
  
  // Determine if should apply scheduled boost
  let shouldBoost = false;
  let boostReason: string | undefined;
  
  // Boost if accessed multiple times in short period (spaced repetition)
  if (timeSinceLastAccess < 24 && metadata.accessCount > 2) {
    shouldBoost = true;
    boostReason = 'spaced_repetition';
  }
  
  // Boost if high emotional content and recently accessed
  if (metadata.emotionalScore > 0.7 && timeSinceLastAccess < 72) {
    shouldBoost = true;
    boostReason = 'emotional_significance';
  }
  
  return {
    newImportanceScore,
    newRecencyScore,
    shouldBoost,
    boostReason,
  };
}

/**
 * Schedule periodic boost for important memories
 */
export function getNextBoostSchedule(
  metadata: MemoryMetadata
): Date | null {
  const config = MEMORY_TYPE_CONFIGS[metadata.memoryType];
  
  if (!config.requiresReinforcement) {
    return null;
  }
  
  const compositeScore = calculateMemoryScore(metadata);
  
  // High importance memories get more frequent boosts
  let boostIntervalHours: number;
  
  if (compositeScore > 0.8) {
    boostIntervalHours = 24; // Daily
  } else if (compositeScore > 0.6) {
    boostIntervalHours = 72; // Every 3 days
  } else if (compositeScore > 0.4) {
    boostIntervalHours = 168; // Weekly
  } else {
    return null; // No boost needed
  }
  
  const lastBoost = metadata.lastReinforcedAt || metadata.createdAt;
  const nextBoost = new Date(lastBoost.getTime() + (boostIntervalHours * 60 * 60 * 1000));
  
  return nextBoost;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default metadata for a memory type
 */
export function createDefaultMetadata(
  memoryType: MemoryType,
  userId: string,
  source: string
): MemoryMetadata {
  const config = MEMORY_TYPE_CONFIGS[memoryType];
  const now = new Date();
  
  return {
    memoryType,
    createdAt: now,
    lastAccessedAt: now,
    importanceScore: config.defaultImportance,
    recencyScore: 1.0,
    frequencyScore: 0.0,
    emotionalScore: 0.0,
    socialScore: 0.0,
    accessCount: 0,
    reinforcementCount: 0,
    decayRate: config.defaultDecayRate,
    halfLife: config.defaultHalfLife,
    context: [],
    relatedMemories: [],
    source,
    userId,
  };
}

/**
 * Update scores based on current state
 */
export function updateMemoryScores(metadata: MemoryMetadata): MemoryMetadata {
  return {
    ...metadata,
    recencyScore: calculateRecencyScore(
      metadata.createdAt,
      metadata.lastAccessedAt,
      metadata.decayRate,
      metadata.halfLife
    ),
    frequencyScore: calculateFrequencyScore(
      metadata.accessCount,
      metadata.reinforcementCount
    ),
  };
}
