/**
 * Planner Engine Data Models
 * 
 * Models for tasks, events, energy profiles, and scheduling
 */

// ============================================================================
// TASK MODELS
// ============================================================================

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  
  // Scheduling properties
  dueDate?: Date;
  estimatedDuration: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Context
  category: 'work' | 'personal' | 'health' | 'learning' | 'social' | 'other';
  tags: string[];
  project?: string;
  
  // Requirements
  requiresFocus: boolean;
  requiresEnergy: 'low' | 'medium' | 'high';
  canSplit: boolean; // Can be broken into multiple sessions
  minSessionDuration?: number; // Minimum continuous time needed
  
  // Dependencies
  dependsOn?: string[]; // Other task IDs
  blockedBy?: string[];
  
  // Status
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EVENT/CALENDAR MODELS
// ============================================================================

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  
  // Time
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string;
  
  // Type
  type: 'meeting' | 'appointment' | 'deadline' | 'personal' | 'other';
  isRecurring: boolean;
  recurrenceRule?: string;
  
  // Flexibility
  isMovable: boolean; // Can be rescheduled
  minNotice: number; // Hours of notice needed to reschedule
  
  // Participants
  attendees?: string[];
  organizer?: string;
  
  // Status
  status: 'confirmed' | 'tentative' | 'cancelled';
  
  // Source
  source: 'google_calendar' | 'outlook' | 'manual' | 'generated';
  externalId?: string;
}

// ============================================================================
// ENERGY PROFILE
// ============================================================================

export interface EnergyProfile {
  userId: string;
  
  // Daily patterns (0-1 energy level for each hour)
  hourlyPattern: {
    monday: number[];
    tuesday: number[];
    wednesday: number[];
    thursday: number[];
    friday: number[];
    saturday: number[];
    sunday: number[];
  };
  
  // Peak windows
  peakFocusWindows: FocusWindow[];
  
  // Preferences
  preferredWorkHours: {
    start: string; // HH:MM
    end: string;
  };
  
  // Sleep schedule
  typicalSleepTime: string;
  typicalWakeTime: string;
  
  // Breaks
  preferredBreakDuration: number; // minutes
  breakFrequency: number; // every X minutes
  
  // Work style
  deepWorkCapacity: number; // hours per day
  maxMeetingsPerDay: number;
  
  // Context
  lastUpdated: Date;
  confidence: number; // How well the profile has been learned
}

export interface FocusWindow {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM
  endTime: string;
  energy: number; // 0-1
  focusQuality: number; // 0-1
}

// ============================================================================
// PLANNER REQUEST & RESPONSE
// ============================================================================

export interface PlannerRequest {
  userId: string;
  horizon: 'daily' | 'weekly';
  date?: Date; // Start date, defaults to today
  
  // Constraints
  constraints?: PlannerConstraints;
  
  // Preferences
  preferences?: PlannerPreferences;
}

export interface PlannerConstraints {
  maxHoursPerDay?: number;
  requiredBreaks?: boolean;
  honorEnergyProfile?: boolean;
  avoidEarlyMornings?: boolean; // Before 8am
  avoidLateNights?: boolean; // After 8pm
  blockedTimeSlots?: TimeSlot[];
}

export interface PlannerPreferences {
  batchSimilarTasks?: boolean;
  frontloadHighPriority?: boolean;
  bufferBetweenMeetings?: number; // minutes
  preferMorningForDeepWork?: boolean;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  reason?: string;
}

export interface PlannerResponse {
  userId: string;
  horizon: 'daily' | 'weekly';
  generatedAt: Date;
  
  // Plans by day
  dailyPlans: DailyPlan[];
  
  // Summary
  summary: PlanSummary;
  
  // Metadata
  confidence: number; // 0-1
  totalTasksScheduled: number;
  totalTasksUnscheduled: number;
  warnings: string[];
}

export interface DailyPlan {
  date: Date;
  dayOfWeek: string;
  
  // Scheduled blocks
  blocks: ScheduledBlock[];
  
  // Metrics
  totalScheduledTime: number; // minutes
  deepWorkTime: number;
  meetingTime: number;
  breakTime: number;
  freeTime: number;
  
  // Health
  overloadRisk: number; // 0-1
  energyAlignment: number; // 0-1 (how well aligned with energy profile)
}

export interface ScheduledBlock {
  id: string;
  
  // Time
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  
  // Content
  type: 'task' | 'meeting' | 'break' | 'buffer' | 'focus_time';
  taskId?: string;
  eventId?: string;
  title: string;
  description?: string;
  
  // Scoring
  confidenceScore: number; // 0-1
  priorityScore: number; // 0-1
  energyMatch: number; // 0-1
  
  // Rationale
  rationale: string[];
  
  // Status
  status: 'proposed' | 'confirmed' | 'rejected';
  isFlexible: boolean;
  
  // Conflicts
  hasConflicts: boolean;
  conflicts?: Conflict[];
}

export interface Conflict {
  type: 'time_overlap' | 'energy_mismatch' | 'dependency_violation' | 'overload' | 'buffer_violation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedBlocks: string[];
  suggestedResolution?: string;
}

export interface PlanSummary {
  totalTasks: number;
  completedTasks: number;
  scheduledTasks: number;
  unscheduledTasks: number;
  
  totalMeetings: number;
  totalDeepWorkHours: number;
  totalBreakTime: number;
  
  averageConfidence: number;
  overallFeasibility: number; // 0-1
  
  topPriorities: string[]; // Task titles
  potentialIssues: string[];
  recommendations: string[];
}

// ============================================================================
// AUTO-SCHEDULING
// ============================================================================

export interface SchedulingCandidate {
  candidateId: string;
  taskId: string;
  
  // Proposed time
  proposedStart: Date;
  proposedEnd: Date;
  
  // Scoring
  score: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
  
  // Alternatives
  alternatives: AlternativeSlot[];
  
  // Status
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface ScoreBreakdown {
  energyScore: number;
  urgencyScore: number;
  contextScore: number;
  conflictScore: number;
  preferenceScore: number;
  totalScore: number;
  
  weights: {
    energy: number;
    urgency: number;
    context: number;
    conflict: number;
    preference: number;
  };
}

export interface AlternativeSlot {
  startTime: Date;
  endTime: Date;
  score: number;
  reason: string;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  candidates: SchedulingCandidate[];
  
  // Communication
  approvalLink: string;
  expiresAt: Date;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  respondedAt?: Date;
}

// ============================================================================
// ML MODELS
// ============================================================================

export interface SchedulingFeatures {
  // Temporal features
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  daysUntilDue: number;
  
  // Task features
  taskDuration: number;
  taskPriority: number; // 0-1
  requiresFocus: boolean;
  requiredEnergy: number; // 0-1
  
  // User context
  energyLevel: number; // 0-1
  focusQuality: number; // 0-1
  recentMeetingCount: number;
  hoursWorkedToday: number;
  
  // Environmental
  hasUpcomingMeeting: boolean;
  timeUntilNextMeeting: number; // minutes
  hasRecentBreak: boolean;
  timeSinceLastBreak: number; // minutes
  
  // Historical
  successRateAtTime: number; // 0-1
  avgCompletionRate: number; // 0-1
}

export interface MLSchedulingModel {
  modelVersion: string;
  trainedAt: Date;
  accuracy: number;
  
  // Model weights (simplified linear model)
  weights: {
    [key: string]: number;
  };
  
  // Feature importance
  featureImportance: {
    feature: string;
    importance: number;
  }[];
}

// ============================================================================
// BUFFER & RESCHEDULING
// ============================================================================

export interface BufferRule {
  id: string;
  name: string;
  
  // Trigger
  appliesTo: 'meeting' | 'task' | 'deep_work' | 'all';
  
  // Buffer specification
  beforeDuration: number; // minutes
  afterDuration: number; // minutes
  
  // Conditions
  conditions: BufferCondition[];
  
  // Priority
  priority: number; // Higher = more important
  isRequired: boolean;
}

export interface BufferCondition {
  type: 'task_type' | 'time_of_day' | 'day_of_week' | 'energy_level' | 'consecutive_count';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface ReschedulingPolicy {
  id: string;
  name: string;
  
  // When to trigger
  triggerEvents: ('conflict' | 'overload' | 'low_energy' | 'urgent_task' | 'manual')[];
  
  // Strategy
  strategy: 'earliest_available' | 'energy_optimal' | 'minimize_disruption' | 'user_preference';
  
  // Constraints
  maxReschedulesPerDay: number;
  noticeRequired: number; // hours
  
  // Priorities
  protectedBlocks: string[]; // Block IDs that can't be moved
  rescheduleOrder: ('low_priority' | 'flexible' | 'non_urgent')[];
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface PlannerMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  
  // Completion rates
  tasksScheduled: number;
  tasksCompleted: number;
  completionRate: number;
  
  // Timing accuracy
  avgTimingError: number; // minutes
  blocksRescheduled: number;
  
  // Energy alignment
  avgEnergyAlignment: number;
  peakPerformanceUtilization: number;
  
  // User satisfaction
  approvalRate: number;
  manualOverrides: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface PlannerConfig {
  // Scheduling windows
  defaultWorkDayStart: string; // "09:00"
  defaultWorkDayEnd: string; // "17:00"
  
  // Buffer defaults
  defaultMeetingBuffer: number; // minutes
  defaultDeepWorkBuffer: number;
  
  // Constraints
  maxConsecutiveMeetings: number;
  minBreakDuration: number;
  maxDailyHours: number;
  
  // ML weights
  mlWeights: {
    energy: number;
    urgency: number;
    context: number;
    conflict: number;
    preference: number;
  };
  
  // Features
  enableAutoRescheduling: boolean;
  enableEnergyOptimization: boolean;
  requireApprovalForNewBlocks: boolean;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  defaultWorkDayStart: "09:00",
  defaultWorkDayEnd: "17:00",
  defaultMeetingBuffer: 15,
  defaultDeepWorkBuffer: 30,
  maxConsecutiveMeetings: 3,
  minBreakDuration: 15,
  maxDailyHours: 10,
  mlWeights: {
    energy: 0.30,
    urgency: 0.25,
    context: 0.20,
    conflict: 0.15,
    preference: 0.10,
  },
  enableAutoRescheduling: true,
  enableEnergyOptimization: true,
  requireApprovalForNewBlocks: true,
};
