/**
 * Example Retrieval Traces
 * 
 * Demonstrates how the multi-layer memory system retrieves and ranks
 * memories across working → episodic → semantic layers
 */

import { MemoryType } from './memoryTypes';
import { RankedMemory, RetrievalTrace } from './MemoryRanker';

// ============================================================================
// EXAMPLE 1: Recent Task Query
// ============================================================================

export const EXAMPLE_1_RECENT_TASK: RetrievalTrace = {
  query: "What do I need to finish today?",
  timestamp: new Date('2025-01-15T14:30:00Z'),
  layers: [
    {
      layer: MemoryType.WORKING,
      queriedAt: new Date('2025-01-15T14:30:00.100Z'),
      resultsCount: 8,
      topMemory: {
        id: 'mem_w_001',
        score: 0.92,
        reason: 'Relevance: 0.95, Composite: 0.88',
      },
    },
    {
      layer: MemoryType.EPISODIC,
      queriedAt: new Date('2025-01-15T14:30:00.250Z'),
      resultsCount: 3,
      topMemory: {
        id: 'mem_e_045',
        score: 0.76,
        reason: 'Relevance: 0.82, Composite: 0.68',
      },
    },
    {
      layer: MemoryType.SEMANTIC,
      queriedAt: new Date('2025-01-15T14:30:00.400Z'),
      resultsCount: 0,
      topMemory: undefined, // No semantic matches for task query
    },
    {
      layer: MemoryType.SOCIAL,
      queriedAt: new Date('2025-01-15T14:30:00.500Z'),
      resultsCount: 1,
      topMemory: {
        id: 'mem_so_012',
        score: 0.65,
        reason: 'Relevance: 0.70, Composite: 0.58',
      },
    },
  ],
  finalSelection: [
    {
      memoryId: 'mem_w_001',
      memoryType: MemoryType.WORKING,
      score: 0.92,
      selectionReason: 'working layer, score=0.920 - Q4 budget review deadline',
    },
    {
      memoryId: 'mem_w_003',
      memoryType: MemoryType.WORKING,
      score: 0.88,
      selectionReason: 'working layer, score=0.880 - Client presentation prep',
    },
    {
      memoryId: 'mem_e_045',
      memoryType: MemoryType.EPISODIC,
      score: 0.76,
      selectionReason: 'episodic layer, score=0.760 - Weekly team meeting notes',
    },
    {
      memoryId: 'mem_w_007',
      memoryType: MemoryType.WORKING,
      score: 0.74,
      selectionReason: 'working layer, score=0.740 - Code review for PR#234',
    },
    {
      memoryId: 'mem_so_012',
      memoryType: MemoryType.SOCIAL,
      score: 0.65,
      selectionReason: 'social layer, score=0.650 - Follow up with Sarah',
    },
  ],
  totalTime: 450, // milliseconds
};

// Analysis: Working memory dominated (8/12 results) because query is about
// immediate tasks. System correctly prioritized recent, high-priority items.

// ============================================================================
// EXAMPLE 2: Factual Knowledge Query
// ============================================================================

export const EXAMPLE_2_FACTUAL_QUERY: RetrievalTrace = {
  query: "How does OAuth 2.0 work?",
  timestamp: new Date('2025-01-15T15:45:00Z'),
  layers: [
    {
      layer: MemoryType.WORKING,
      queriedAt: new Date('2025-01-15T15:45:00.100Z'),
      resultsCount: 1,
      topMemory: {
        id: 'mem_w_045',
        score: 0.68,
        reason: 'Relevance: 0.75, Composite: 0.58',
      },
    },
    {
      layer: MemoryType.EPISODIC,
      queriedAt: new Date('2025-01-15T15:45:00.250Z'),
      resultsCount: 2,
      topMemory: {
        id: 'mem_e_234',
        score: 0.72,
        reason: 'Relevance: 0.78, Composite: 0.64',
      },
    },
    {
      layer: MemoryType.SEMANTIC,
      queriedAt: new Date('2025-01-15T15:45:00.400Z'),
      resultsCount: 12,
      topMemory: {
        id: 'mem_s_089',
        score: 0.94,
        reason: 'Relevance: 0.97, Composite: 0.90',
      },
    },
    {
      layer: MemoryType.SOCIAL,
      queriedAt: new Date('2025-01-15T15:45:00.550Z'),
      resultsCount: 0,
      topMemory: undefined,
    },
  ],
  finalSelection: [
    {
      memoryId: 'mem_s_089',
      memoryType: MemoryType.SEMANTIC,
      score: 0.94,
      selectionReason: 'semantic layer, score=0.940 - OAuth 2.0 flow explanation',
    },
    {
      memoryId: 'mem_s_091',
      memoryType: MemoryType.SEMANTIC,
      score: 0.91,
      selectionReason: 'semantic layer, score=0.910 - JWT vs OAuth comparison',
    },
    {
      memoryId: 'mem_s_090',
      memoryType: MemoryType.SEMANTIC,
      score: 0.87,
      selectionReason: 'semantic layer, score=0.870 - Authorization code grant',
    },
    {
      memoryId: 'mem_e_234',
      memoryType: MemoryType.EPISODIC,
      score: 0.72,
      selectionReason: 'episodic layer, score=0.720 - Implemented OAuth in project X',
    },
    {
      memoryId: 'mem_s_125',
      memoryType: MemoryType.SEMANTIC,
      score: 0.71,
      selectionReason: 'semantic layer, score=0.710 - OAuth security best practices',
    },
  ],
  totalTime: 580,
};

// Analysis: Semantic memory dominated (12/15 results) because query is about
// factual knowledge. Episodic memory contributed practical implementation
// experience. Working memory had minimal relevance.

// ============================================================================
// EXAMPLE 3: Social/Emotional Query
// ============================================================================

export const EXAMPLE_3_SOCIAL_QUERY: RetrievalTrace = {
  query: "Tell me about my last conversation with Sarah",
  timestamp: new Date('2025-01-15T16:20:00Z'),
  layers: [
    {
      layer: MemoryType.WORKING,
      queriedAt: new Date('2025-01-15T16:20:00.100Z'),
      resultsCount: 2,
      topMemory: {
        id: 'mem_w_089',
        score: 0.78,
        reason: 'Relevance: 0.85, Composite: 0.68',
      },
    },
    {
      layer: MemoryType.SOCIAL,
      queriedAt: new Date('2025-01-15T16:20:00.200Z'),
      resultsCount: 8,
      topMemory: {
        id: 'mem_so_045',
        score: 0.96,
        reason: 'Relevance: 0.98, Composite: 0.93',
      },
    },
    {
      layer: MemoryType.EPISODIC,
      queriedAt: new Date('2025-01-15T16:20:00.350Z'),
      resultsCount: 6,
      topMemory: {
        id: 'mem_e_567',
        score: 0.91,
        reason: 'Relevance: 0.94, Composite: 0.86',
      },
    },
    {
      layer: MemoryType.EMOTIONAL,
      queriedAt: new Date('2025-01-15T16:20:00.450Z'),
      resultsCount: 3,
      topMemory: {
        id: 'mem_em_023',
        score: 0.82,
        reason: 'Relevance: 0.88, Composite: 0.74',
      },
    },
  ],
  finalSelection: [
    {
      memoryId: 'mem_so_045',
      memoryType: MemoryType.SOCIAL,
      score: 0.96,
      selectionReason: 'social layer, score=0.960 - Sarah Johnson profile',
    },
    {
      memoryId: 'mem_e_567',
      memoryType: MemoryType.EPISODIC,
      score: 0.91,
      selectionReason: 'episodic layer, score=0.910 - Lunch with Sarah, Jan 12',
    },
    {
      memoryId: 'mem_em_023',
      memoryType: MemoryType.EMOTIONAL,
      score: 0.82,
      selectionReason: 'emotional layer, score=0.820 - Positive interaction feeling',
    },
    {
      memoryId: 'mem_e_568',
      memoryType: MemoryType.EPISODIC,
      score: 0.79,
      selectionReason: 'episodic layer, score=0.790 - Project discussion with Sarah',
    },
    {
      memoryId: 'mem_w_089',
      memoryType: MemoryType.WORKING,
      score: 0.78,
      selectionReason: 'working layer, score=0.780 - Note to schedule call with Sarah',
    },
  ],
  totalTime: 520,
};

// Analysis: Social and episodic memories dominated. Social layer provided
// person profile, episodic provided recent interactions, emotional provided
// context about relationship quality.

// ============================================================================
// EXAMPLE 4: Mixed Context Query
// ============================================================================

export const EXAMPLE_4_MIXED_QUERY: RetrievalTrace = {
  query: "What have I learned about Python lately and what should I practice?",
  timestamp: new Date('2025-01-15T17:00:00Z'),
  layers: [
    {
      layer: MemoryType.WORKING,
      queriedAt: new Date('2025-01-15T17:00:00.100Z'),
      resultsCount: 4,
      topMemory: {
        id: 'mem_w_156',
        score: 0.84,
        reason: 'Relevance: 0.88, Composite: 0.79',
      },
    },
    {
      layer: MemoryType.EPISODIC,
      queriedAt: new Date('2025-01-15T17:00:00.250Z'),
      resultsCount: 7,
      topMemory: {
        id: 'mem_e_789',
        score: 0.87,
        reason: 'Relevance: 0.91, Composite: 0.81',
      },
    },
    {
      layer: MemoryType.SEMANTIC,
      queriedAt: new Date('2025-01-15T17:00:00.400Z'),
      resultsCount: 9,
      topMemory: {
        id: 'mem_s_234',
        score: 0.82,
        reason: 'Relevance: 0.89, Composite: 0.73',
      },
    },
    {
      layer: MemoryType.SOCIAL,
      queriedAt: new Date('2025-01-15T17:00:00.550Z'),
      resultsCount: 1,
      topMemory: {
        id: 'mem_so_089',
        score: 0.64,
        reason: 'Relevance: 0.70, Composite: 0.56',
      },
    },
  ],
  finalSelection: [
    {
      memoryId: 'mem_e_789',
      memoryType: MemoryType.EPISODIC,
      score: 0.87,
      selectionReason: 'episodic layer, score=0.870 - Completed async/await tutorial yesterday',
    },
    {
      memoryId: 'mem_w_156',
      memoryType: MemoryType.WORKING,
      score: 0.84,
      selectionReason: 'working layer, score=0.840 - Practice asyncio for project',
    },
    {
      memoryId: 'mem_s_234',
      memoryType: MemoryType.SEMANTIC,
      score: 0.82,
      selectionReason: 'semantic layer, score=0.820 - Python async programming concepts',
    },
    {
      memoryId: 'mem_e_790',
      memoryType: MemoryType.EPISODIC,
      score: 0.79,
      selectionReason: 'episodic layer, score=0.790 - Struggled with decorators last week',
    },
    {
      memoryId: 'mem_s_235',
      memoryType: MemoryType.SEMANTIC,
      score: 0.76,
      selectionReason: 'semantic layer, score=0.760 - Decorator pattern explanation',
    },
  ],
  totalTime: 620,
};

// Analysis: Balanced retrieval across layers. Episodic memories showed recent
// learning activities, working memory showed current practice goals, semantic
// provided theoretical knowledge. System successfully merged practical
// experience with conceptual understanding.

// ============================================================================
// DETAILED TRACE WITH SCORING BREAKDOWN
// ============================================================================

export interface DetailedMemoryTrace {
  memoryId: string;
  memoryType: MemoryType;
  content: string;
  
  // Individual score components
  vectorSimilarity: number;
  importanceScore: number;
  recencyScore: number;
  frequencyScore: number;
  emotionalScore: number;
  socialScore: number;
  
  // Composite calculations
  compositeScore: number;
  finalScore: number;
  
  // Boosts applied
  boostsApplied: {
    name: string;
    multiplier: number;
    reason: string;
  }[];
  
  // Context
  accessCount: number;
  lastAccessedHoursAgo: number;
  createdDaysAgo: number;
}

export const EXAMPLE_5_DETAILED_TRACE: DetailedMemoryTrace[] = [
  {
    memoryId: 'mem_w_001',
    memoryType: MemoryType.WORKING,
    content: 'Review Q4 budget report and prepare summary for board meeting',
    
    vectorSimilarity: 0.95,
    importanceScore: 0.90,
    recencyScore: 1.00,
    frequencyScore: 0.30,
    emotionalScore: 0.40,
    socialScore: 0.20,
    
    compositeScore: 0.88, // Weighted: 0.9*0.3 + 1.0*0.25 + 0.3*0.2 + 0.4*0.15 + 0.2*0.1
    finalScore: 0.92,     // 0.95*0.6 + 0.88*0.4 = 0.57 + 0.352 + boosts
    
    boostsApplied: [
      {
        name: 'working_memory_priority',
        multiplier: 1.25,
        reason: 'Query context indicated recent task query',
      },
      {
        name: 'high_importance',
        multiplier: 1.05,
        reason: 'Importance score > 0.85',
      },
    ],
    
    accessCount: 3,
    lastAccessedHoursAgo: 2,
    createdDaysAgo: 0.5,
  },
  
  {
    memoryId: 'mem_e_045',
    memoryType: MemoryType.EPISODIC,
    content: 'Weekly team meeting - discussed Q4 goals, Sarah presented marketing metrics',
    
    vectorSimilarity: 0.82,
    importanceScore: 0.70,
    recencyScore: 0.75,
    frequencyScore: 0.40,
    emotionalScore: 0.60,
    socialScore: 0.80,
    
    compositeScore: 0.68,
    finalScore: 0.76,
    
    boostsApplied: [
      {
        name: 'social_context',
        multiplier: 1.15,
        reason: 'High social score and query may involve collaboration',
      },
    ],
    
    accessCount: 8,
    lastAccessedHoursAgo: 36,
    createdDaysAgo: 2,
  },
  
  {
    memoryId: 'mem_s_089',
    memoryType: MemoryType.SEMANTIC,
    content: 'Budget forecasting methodology: bottom-up approach combining departmental estimates',
    
    vectorSimilarity: 0.88,
    importanceScore: 0.85,
    recencyScore: 0.40,
    frequencyScore: 0.75,
    emotionalScore: 0.00,
    socialScore: 0.00,
    
    compositeScore: 0.71,
    finalScore: 0.74,
    
    boostsApplied: [
      {
        name: 'high_frequency',
        multiplier: 1.08,
        reason: 'Frequently accessed knowledge',
      },
    ],
    
    accessCount: 24,
    lastAccessedHoursAgo: 120,
    createdDaysAgo: 180,
  },
];

// ============================================================================
// RETRIEVAL PATH VISUALIZATION
// ============================================================================

export const RETRIEVAL_PATH_EXAMPLE = `
Query: "What do I need to finish today?"
Timestamp: 2025-01-15 14:30:00

┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: WORKING MEMORY (Priority: HIGH)                    │
├─────────────────────────────────────────────────────────────┤
│ ✓ Found 8 matches (100ms)                                   │
│   [1] mem_w_001 | Score: 0.92 | Q4 budget review           │
│   [2] mem_w_003 | Score: 0.88 | Client presentation        │
│   [3] mem_w_007 | Score: 0.74 | Code review PR#234         │
│   ... (5 more)                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: EPISODIC MEMORY (Priority: MEDIUM)                │
├─────────────────────────────────────────────────────────────┤
│ ✓ Found 3 matches (150ms)                                   │
│   [1] mem_e_045 | Score: 0.76 | Team meeting notes         │
│   [2] mem_e_234 | Score: 0.68 | Project discussion         │
│   [3] mem_e_089 | Score: 0.62 | Earlier task planning      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: SEMANTIC MEMORY (Priority: LOW)                   │
├─────────────────────────────────────────────────────────────┤
│ ✗ No relevant matches (150ms)                               │
│   Reason: Query is task-specific, not factual              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: SOCIAL MEMORY (Priority: MEDIUM)                  │
├─────────────────────────────────────────────────────────────┤
│ ✓ Found 1 match (150ms)                                     │
│   [1] mem_so_012 | Score: 0.65 | Follow up with Sarah      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ FINAL RANKING & SELECTION                                  │
├─────────────────────────────────────────────────────────────┤
│ Re-ranked 12 memories by composite score                    │
│ Applied context boosts: working_memory (+25%), recent (+10%)│
│ Selected top 5 for RAG context                              │
│                                                              │
│ Selected memories:                                          │
│   1. working → mem_w_001 (0.92) ← PRIMARY                   │
│   2. working → mem_w_003 (0.88)                             │
│   3. episodic → mem_e_045 (0.76)                            │
│   4. working → mem_w_007 (0.74)                             │
│   5. social → mem_so_012 (0.65)                             │
│                                                              │
│ Total retrieval time: 450ms                                 │
│ Memory efficiency: 41.7% (5/12 used)                        │
└─────────────────────────────────────────────────────────────┘
`;

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export const ALL_EXAMPLES = {
  recentTaskQuery: EXAMPLE_1_RECENT_TASK,
  factualQuery: EXAMPLE_2_FACTUAL_QUERY,
  socialQuery: EXAMPLE_3_SOCIAL_QUERY,
  mixedQuery: EXAMPLE_4_MIXED_QUERY,
  detailedTrace: EXAMPLE_5_DETAILED_TRACE,
  visualPath: RETRIEVAL_PATH_EXAMPLE,
};
