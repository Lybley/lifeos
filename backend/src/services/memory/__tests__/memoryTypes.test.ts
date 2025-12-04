/**
 * Unit Tests for Memory Types and Scoring
 */

import {
  MemoryType,
  MemoryMetadata,
  calculateRecencyScore,
  calculateFrequencyScore,
  calculateMemoryScore,
  shouldPromoteMemory,
  shouldArchiveMemory,
  reinforceMemory,
  getNextBoostSchedule,
  createDefaultMetadata,
  updateMemoryScores,
} from '../memoryTypes';

describe('Memory Scoring', () => {
  describe('calculateRecencyScore', () => {
    it('should return 1.0 for just-created memory', () => {
      const now = new Date();
      const score = calculateRecencyScore(now, now, 0.3, 168);
      expect(score).toBeCloseTo(1.0, 2);
    });
    
    it('should decay over time', () => {
      const created = new Date('2025-01-01');
      const accessed = new Date('2025-01-01');
      const halfLife = 24; // 24 hours
      const decayRate = 0.5;
      
      // Mock current time to 24 hours later
      const originalNow = Date.now;
      Date.now = jest.fn(() => new Date('2025-01-02').getTime());
      
      const score = calculateRecencyScore(created, accessed, decayRate, halfLife);
      
      // After one half-life with decay rate 0.5, should be around 0.7
      expect(score).toBeGreaterThan(0.6);
      expect(score).toBeLessThan(0.8);
      
      Date.now = originalNow;
    });
    
    it('should decay faster with higher decay rate', () => {
      const created = new Date('2025-01-01');
      const accessed = new Date('2025-01-01');
      const halfLife = 24;
      
      Date.now = jest.fn(() => new Date('2025-01-02').getTime());
      
      const lowDecay = calculateRecencyScore(created, accessed, 0.2, halfLife);
      const highDecay = calculateRecencyScore(created, accessed, 0.8, halfLife);
      
      expect(highDecay).toBeLessThan(lowDecay);
      
      Date.now = jest.fn(() => Date.now());
    });
  });
  
  describe('calculateFrequencyScore', () => {
    it('should return 0 for never-accessed memory', () => {
      const score = calculateFrequencyScore(0, 0);
      expect(score).toBe(0);
    });
    
    it('should increase with access count', () => {
      const score1 = calculateFrequencyScore(1, 0);
      const score10 = calculateFrequencyScore(10, 0);
      const score100 = calculateFrequencyScore(100, 0);
      
      expect(score10).toBeGreaterThan(score1);
      expect(score100).toBeGreaterThan(score10);
    });
    
    it('should weight reinforcements more than regular accesses', () => {
      const regularAccess = calculateFrequencyScore(10, 0);
      const withReinforcement = calculateFrequencyScore(5, 5);
      
      expect(withReinforcement).toBeGreaterThan(regularAccess);
    });
    
    it('should use logarithmic scaling', () => {
      const score10 = calculateFrequencyScore(10, 0);
      const score20 = calculateFrequencyScore(20, 0);
      const score100 = calculateFrequencyScore(100, 0);
      
      // Difference between 10 and 20 should be larger than 20 to 100
      const diff1 = score20 - score10;
      const diff2 = score100 - score20;
      
      expect(diff1).toBeGreaterThan(diff2);
    });
  });
  
  describe('calculateMemoryScore', () => {
    it('should calculate weighted composite score', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.EPISODIC,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        importanceScore: 0.8,
        recencyScore: 0.7,
        frequencyScore: 0.6,
        emotionalScore: 0.5,
        socialScore: 0.4,
        accessCount: 5,
        reinforcementCount: 1,
        decayRate: 0.3,
        halfLife: 168,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const score = calculateMemoryScore(metadata);
      
      // With given weights: 0.8*0.3 + 0.7*0.25 + 0.6*0.2 + 0.5*0.15 + 0.4*0.1
      const expected = 0.24 + 0.175 + 0.12 + 0.075 + 0.04;
      
      expect(score).toBeCloseTo(expected, 2);
    });
    
    it('should return value between 0 and 1', () => {
      const metadata = createDefaultMetadata(
        MemoryType.WORKING,
        'user123',
        'test'
      );
      
      const score = calculateMemoryScore(metadata);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('Memory Promotion and Archival', () => {
  describe('shouldPromoteMemory', () => {
    it('should promote working memory to episodic when criteria met', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.WORKING,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        lastAccessedAt: new Date(),
        importanceScore: 0.85,
        recencyScore: 0.8,
        frequencyScore: 0.7,
        emotionalScore: 0.5,
        socialScore: 0.6,
        accessCount: 10,
        reinforcementCount: 2,
        decayRate: 0.8,
        halfLife: 2,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const promotion = shouldPromoteMemory(metadata);
      
      expect(promotion).toBe(MemoryType.EPISODIC);
    });
    
    it('should not promote if access count too low', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.WORKING,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date(),
        importanceScore: 0.85,
        recencyScore: 0.8,
        frequencyScore: 0.7,
        emotionalScore: 0.5,
        socialScore: 0.6,
        accessCount: 2, // Too low
        reinforcementCount: 0,
        decayRate: 0.8,
        halfLife: 2,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const promotion = shouldPromoteMemory(metadata);
      
      expect(promotion).toBeNull();
    });
    
    it('should promote episodic to semantic when criteria met', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.EPISODIC,
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        lastAccessedAt: new Date(),
        importanceScore: 0.85,
        recencyScore: 0.4,
        frequencyScore: 0.8,
        emotionalScore: 0.2, // Low emotional
        socialScore: 0.3,
        accessCount: 15,
        reinforcementCount: 3,
        decayRate: 0.3,
        halfLife: 168,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const promotion = shouldPromoteMemory(metadata);
      
      expect(promotion).toBe(MemoryType.SEMANTIC);
    });
  });
  
  describe('shouldArchiveMemory', () => {
    it('should archive if expired', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.WORKING,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
        importanceScore: 0.9,
        recencyScore: 1.0,
        frequencyScore: 0.5,
        emotionalScore: 0.5,
        socialScore: 0.5,
        accessCount: 10,
        reinforcementCount: 2,
        decayRate: 0.8,
        halfLife: 2,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const should Archive = shouldArchiveMemory(metadata);
      
      expect(shouldArchive).toBe(true);
    });
    
    it('should archive if beyond max retention', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.WORKING,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        lastAccessedAt: new Date(),
        importanceScore: 0.5,
        recencyScore: 0.2,
        frequencyScore: 0.3,
        emotionalScore: 0.2,
        socialScore: 0.1,
        accessCount: 2,
        reinforcementCount: 0,
        decayRate: 0.8,
        halfLife: 2,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const shouldArchive = shouldArchiveMemory(metadata);
      
      // Working memory max retention is 7 days
      expect(shouldArchive).toBe(true);
    });
    
    it('should not archive high-score recent memory', () => {
      const metadata: MemoryMetadata = {
        memoryType: MemoryType.EPISODIC,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date(),
        importanceScore: 0.9,
        recencyScore: 0.8,
        frequencyScore: 0.7,
        emotionalScore: 0.6,
        socialScore: 0.5,
        accessCount: 10,
        reinforcementCount: 3,
        decayRate: 0.3,
        halfLife: 168,
        context: [],
        relatedMemories: [],
        source: 'test',
        userId: 'user123',
      };
      
      const shouldArchive = shouldArchiveMemory(metadata);
      
      expect(shouldArchive).toBe(false);
    });
  });
});

describe('Memory Reinforcement', () => {
  describe('reinforceMemory', () => {
    it('should boost importance based on contextual relevance', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.importanceScore = 0.7;
      
      const result = reinforceMemory(metadata, 0.8);
      
      expect(result.newImportanceScore).toBeGreaterThan(0.7);
      expect(result.newImportanceScore).toBeLessThanOrEqual(1.0);
    });
    
    it('should reset recency score', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.recencyScore = 0.3;
      
      const result = reinforceMemory(metadata, 0.5);
      
      expect(result.newRecencyScore).toBe(0.95);
    });
    
    it('should suggest boost for spaced repetition', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.lastAccessedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      metadata.accessCount = 5;
      
      const result = reinforceMemory(metadata, 0.7);
      
      expect(result.shouldBoost).toBe(true);
      expect(result.boostReason).toBe('spaced_repetition');
    });
    
    it('should suggest boost for emotional significance', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EMOTIONAL,
        'user123',
        'test'
      );
      metadata.emotionalScore = 0.8;
      metadata.lastAccessedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      
      const result = reinforceMemory(metadata, 0.6);
      
      expect(result.shouldBoost).toBe(true);
      expect(result.boostReason).toBe('emotional_significance');
    });
  });
  
  describe('getNextBoostSchedule', () => {
    it('should schedule daily boost for high-score memories', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.importanceScore = 0.9;
      metadata.recencyScore = 0.9;
      metadata.frequencyScore = 0.8;
      metadata.emotionalScore = 0.7;
      metadata.socialScore = 0.6;
      
      const nextBoost = getNextBoostSchedule(metadata);
      
      expect(nextBoost).not.toBeNull();
      if (nextBoost) {
        const hoursDiff = (nextBoost.getTime() - metadata.createdAt.getTime()) / (1000 * 60 * 60);
        expect(hoursDiff).toBeCloseTo(24, 1);
      }
    });
    
    it('should not schedule boost for semantic memories', () => {
      const metadata = createDefaultMetadata(
        MemoryType.SEMANTIC,
        'user123',
        'test'
      );
      
      const nextBoost = getNextBoostSchedule(metadata);
      
      expect(nextBoost).toBeNull();
    });
    
    it('should not schedule boost for low-score memories', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.importanceScore = 0.2;
      metadata.recencyScore = 0.3;
      metadata.frequencyScore = 0.1;
      
      const nextBoost = getNextBoostSchedule(metadata);
      
      expect(nextBoost).toBeNull();
    });
  });
});

describe('Utility Functions', () => {
  describe('createDefaultMetadata', () => {
    it('should create metadata with correct defaults', () => {
      const metadata = createDefaultMetadata(
        MemoryType.WORKING,
        'user123',
        'calendar'
      );
      
      expect(metadata.memoryType).toBe(MemoryType.WORKING);
      expect(metadata.userId).toBe('user123');
      expect(metadata.source).toBe('calendar');
      expect(metadata.importanceScore).toBe(0.9); // Working memory default
      expect(metadata.recencyScore).toBe(1.0);
      expect(metadata.frequencyScore).toBe(0.0);
      expect(metadata.accessCount).toBe(0);
      expect(metadata.decayRate).toBe(0.8); // Working memory default
      expect(metadata.halfLife).toBe(2); // Working memory default
    });
  });
  
  describe('updateMemoryScores', () => {
    it('should recalculate recency and frequency scores', () => {
      const metadata = createDefaultMetadata(
        MemoryType.EPISODIC,
        'user123',
        'test'
      );
      metadata.accessCount = 10;
      metadata.reinforcementCount = 2;
      metadata.lastAccessedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      
      const updated = updateMemoryScores(metadata);
      
      expect(updated.recencyScore).toBeLessThan(1.0);
      expect(updated.frequencyScore).toBeGreaterThan(0);
    });
  });
});
