/**
 * Planner Engine
 * 
 * Analyzes tasks, events, energy profiles to produce optimal daily/weekly plans
 */

import {
  Task,
  CalendarEvent,
  EnergyProfile,
  PlannerRequest,
  PlannerResponse,
  DailyPlan,
  ScheduledBlock,
  Conflict,
  PlanSummary,
  SchedulingFeatures,
  ScoreBreakdown,
  DEFAULT_PLANNER_CONFIG,
  PlannerConfig,
} from './plannerModels';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

// ============================================================================
// PLANNER ENGINE CLASS
// ============================================================================

export class PlannerEngine {
  private config: PlannerConfig;
  
  constructor(config: PlannerConfig = DEFAULT_PLANNER_CONFIG) {
    this.config = config;
  }
  
  /**
   * Main planning method - generates daily/weekly plans
   */
  async generatePlan(
    request: PlannerRequest,
    tasks: Task[],
    events: CalendarEvent[],
    energyProfile: EnergyProfile
  ): Promise<PlannerResponse> {
    logger.info('Generating plan', {
      userId: request.userId,
      horizon: request.horizon,
      tasksCount: tasks.length,
      eventsCount: events.length,
    });
    
    const startDate = request.date || new Date();
    const days = request.horizon === 'daily' ? 1 : 7;
    
    // Generate daily plans
    const dailyPlans: DailyPlan[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayPlan = await this.generateDailyPlan(
        date,
        tasks,
        events,
        energyProfile,
        request
      );
      
      dailyPlans.push(dayPlan);
    }
    
    // Generate summary
    const summary = this.generateSummary(dailyPlans, tasks);
    
    // Calculate overall confidence
    const avgConfidence = dailyPlans.reduce((sum, day) => {
      const dayConfidence = day.blocks.reduce((s, b) => s + b.confidenceScore, 0) / (day.blocks.length || 1);
      return sum + dayConfidence;
    }, 0) / days;
    
    const totalScheduled = dailyPlans.reduce((sum, day) => 
      day.blocks.filter(b => b.type === 'task').length, 0
    );
    
    const warnings = this.generateWarnings(dailyPlans);
    
    return {
      userId: request.userId,
      horizon: request.horizon,
      generatedAt: new Date(),
      dailyPlans,
      summary,
      confidence: avgConfidence,
      totalTasksScheduled: totalScheduled,
      totalTasksUnscheduled: tasks.filter(t => t.status === 'pending').length - totalScheduled,
      warnings,
    };
  }
  
  /**
   * Generate plan for a single day
   */
  private async generateDailyPlan(
    date: Date,
    allTasks: Task[],
    allEvents: CalendarEvent[],
    energyProfile: EnergyProfile,
    request: PlannerRequest
  ): Promise<DailyPlan> {
    // Filter tasks and events for this day
    const dayTasks = this.getTasksForDay(date, allTasks);
    const dayEvents = this.getEventsForDay(date, allEvents);
    
    // Get available time slots
    const availableSlots = this.calculateAvailableSlots(
      date,
      dayEvents,
      energyProfile,
      request
    );
    
    // Score and sort tasks
    const scoredTasks = this.scoreTasks(dayTasks, date, energyProfile);
    
    // Schedule tasks into available slots
    const blocks = await this.scheduleTasksIntoSlots(
      scoredTasks,
      availableSlots,
      dayEvents,
      energyProfile,
      date
    );
    
    // Add event blocks
    const eventBlocks = this.createEventBlocks(dayEvents);
    blocks.push(...eventBlocks);
    
    // Sort blocks by time
    blocks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Calculate metrics
    const metrics = this.calculateDayMetrics(blocks, energyProfile, date);
    
    return {
      date,
      dayOfWeek: this.getDayOfWeek(date),
      blocks,
      ...metrics,
    };
  }
  
  /**
   * Calculate available time slots for scheduling
   */
  private calculateAvailableSlots(
    date: Date,
    events: CalendarEvent[],
    energyProfile: EnergyProfile,
    request: PlannerRequest
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    // Start with work hours
    const workStart = this.parseTime(this.config.defaultWorkDayStart);
    const workEnd = this.parseTime(this.config.defaultWorkDayEnd);
    
    const dayStart = new Date(date);
    dayStart.setHours(workStart.hours, workStart.minutes, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(workEnd.hours, workEnd.minutes, 0, 0);
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    );
    
    let currentTime = dayStart;
    
    for (const event of sortedEvents) {
      // Add slot before event if there's gap
      if (event.startTime.getTime() > currentTime.getTime()) {
        const duration = (event.startTime.getTime() - currentTime.getTime()) / (1000 * 60);
        
        if (duration >= 30) { // Minimum 30 min slot
          slots.push({
            start: new Date(currentTime),
            end: new Date(event.startTime),
          });
        }
      }
      
      // Move current time to after event (with buffer)
      currentTime = new Date(event.endTime);
      currentTime.setMinutes(currentTime.getMinutes() + this.config.defaultMeetingBuffer);
    }
    
    // Add slot after last event until day end
    if (currentTime.getTime() < dayEnd.getTime()) {
      slots.push({
        start: new Date(currentTime),
        end: dayEnd,
      });
    }
    
    // Apply user constraints
    if (request.constraints?.blockedTimeSlots) {
      return this.removeBlockedSlots(slots, request.constraints.blockedTimeSlots);
    }
    
    return slots;
  }
  
  /**
   * Score tasks using ML-based and heuristic scoring
   */
  private scoreTasks(
    tasks: Task[],
    date: Date,
    energyProfile: EnergyProfile
  ): Array<Task & { score: number; urgencyScore: number }> {
    return tasks.map(task => {
      const urgencyScore = this.calculateUrgencyScore(task, date);
      const priorityScore = this.calculatePriorityScore(task);
      const energyScore = this.calculateTaskEnergyScore(task);
      
      // Combined score
      const score = 
        (urgencyScore * 0.35) +
        (priorityScore * 0.35) +
        (energyScore * 0.30);
      
      return {
        ...task,
        score,
        urgencyScore,
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * Schedule tasks into available slots with ML-based optimization
   */
  private async scheduleTasksIntoSlots(
    scoredTasks: Array<Task & { score: number }>,
    availableSlots: TimeSlot[],
    events: CalendarEvent[],
    energyProfile: EnergyProfile,
    date: Date
  ): Promise<ScheduledBlock[]> {
    const blocks: ScheduledBlock[] = [];
    const remainingSlots = [...availableSlots];
    
    for (const task of scoredTasks) {
      // Find best slot for this task
      const bestSlot = this.findBestSlot(
        task,
        remainingSlots,
        energyProfile,
        date,
        blocks
      );
      
      if (!bestSlot) {
        logger.warn('No suitable slot found for task', { taskId: task.id });
        continue;
      }
      
      // Create scheduled block
      const block = this.createTaskBlock(task, bestSlot, energyProfile, date);
      blocks.push(block);
      
      // Update remaining slots
      this.consumeSlot(remainingSlots, bestSlot);
      
      // Add buffer after deep work
      if (task.requiresFocus) {
        this.addBuffer(remainingSlots, bestSlot.end, this.config.defaultDeepWorkBuffer);
      }
    }
    
    return blocks;
  }
  
  /**
   * Find best time slot for a task using ML scoring
   */
  private findBestSlot(
    task: Task,
    slots: TimeSlot[],
    energyProfile: EnergyProfile,
    date: Date,
    existingBlocks: ScheduledBlock[]
  ): (TimeSlot & { score: number }) | null {
    let bestSlot: (TimeSlot & { score: number }) | null = null;
    let bestScore = -1;
    
    for (const slot of slots) {
      const duration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
      
      // Check if task fits
      if (duration < task.estimatedDuration) {
        continue;
      }
      
      // Calculate features
      const features = this.extractFeatures(task, slot.start, energyProfile, existingBlocks);
      
      // Calculate score
      const scoreBreakdown = this.calculateSlotScore(features, task, slot.start, energyProfile);
      
      if (scoreBreakdown.totalScore > bestScore) {
        bestScore = scoreBreakdown.totalScore;
        bestSlot = { ...slot, score: bestScore };
      }
    }
    
    return bestSlot;
  }
  
  /**
   * Extract ML features for scoring
   */
  private extractFeatures(
    task: Task,
    startTime: Date,
    energyProfile: EnergyProfile,
    existingBlocks: ScheduledBlock[]
  ): SchedulingFeatures {
    const hour = startTime.getHours();
    const dayOfWeek = startTime.getDay();
    
    // Get energy level at this time
    const energyLevel = this.getEnergyLevel(startTime, energyProfile);
    
    // Calculate days until due
    const daysUntilDue = task.dueDate
      ? (task.dueDate.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    
    // Check upcoming meetings
    const upcomingMeeting = existingBlocks.find(b => 
      b.type === 'meeting' && b.startTime.getTime() > startTime.getTime()
    );
    
    const timeUntilNextMeeting = upcomingMeeting
      ? (upcomingMeeting.startTime.getTime() - startTime.getTime()) / (1000 * 60)
      : 999;
    
    // Recent meetings
    const recentMeetings = existingBlocks.filter(b =>
      b.type === 'meeting' && 
      b.endTime.getTime() <= startTime.getTime() &&
      (startTime.getTime() - b.endTime.getTime()) < (2 * 60 * 60 * 1000) // Within 2 hours
    );
    
    return {
      hourOfDay: hour,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      daysUntilDue,
      taskDuration: task.estimatedDuration,
      taskPriority: this.priorityToNumber(task.priority),
      requiresFocus: task.requiresFocus,
      requiredEnergy: this.energyToNumber(task.requiresEnergy),
      energyLevel,
      focusQuality: energyLevel, // Simplified
      recentMeetingCount: recentMeetings.length,
      hoursWorkedToday: existingBlocks.filter(b => b.type === 'task').length * 0.5,
      hasUpcomingMeeting: !!upcomingMeeting,
      timeUntilNextMeeting,
      hasRecentBreak: false, // Simplified
      timeSinceLastBreak: 60,
      successRateAtTime: energyLevel, // Simplified
      avgCompletionRate: 0.8,
    };
  }
  
  /**
   * Calculate slot score using weighted features
   */
  private calculateSlotScore(
    features: SchedulingFeatures,
    task: Task,
    startTime: Date,
    energyProfile: EnergyProfile
  ): ScoreBreakdown {
    const weights = this.config.mlWeights;
    
    // Energy score: Match task energy requirement with available energy
    const energyScore = this.calculateEnergyMatchScore(
      features.energyLevel,
      features.requiredEnergy,
      task.requiresFocus
    );
    
    // Urgency score: Based on due date and priority
    const urgencyScore = this.calculateUrgencyScore(task, startTime);
    
    // Context score: How well this fits with surrounding tasks
    const contextScore = this.calculateContextScore(features, task);
    
    // Conflict score: Penalties for conflicts
    const conflictScore = this.calculateConflictScore(features);
    
    // Preference score: User preferences alignment
    const preferenceScore = this.calculatePreferenceScore(features, task);
    
    // Weighted total
    const totalScore = 
      (energyScore * weights.energy) +
      (urgencyScore * weights.urgency) +
      (contextScore * weights.context) +
      (conflictScore * weights.conflict) +
      (preferenceScore * weights.preference);
    
    return {
      energyScore,
      urgencyScore,
      contextScore,
      conflictScore,
      preferenceScore,
      totalScore,
      weights,
    };
  }
  
  /**
   * Calculate energy match score
   */
  private calculateEnergyMatchScore(
    availableEnergy: number,
    requiredEnergy: number,
    requiresFocus: boolean
  ): number {
    const energyMatch = 1 - Math.abs(availableEnergy - requiredEnergy);
    
    // Penalty if focus task during low energy
    if (requiresFocus && availableEnergy < 0.6) {
      return energyMatch * 0.5;
    }
    
    return energyMatch;
  }
  
  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(task: Task, currentDate: Date): number {
    if (!task.dueDate) {
      return this.priorityToNumber(task.priority) * 0.5;
    }
    
    const daysUntilDue = (task.dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    let urgency: number;
    if (daysUntilDue < 1) urgency = 1.0;
    else if (daysUntilDue < 3) urgency = 0.8;
    else if (daysUntilDue < 7) urgency = 0.6;
    else if (daysUntilDue < 14) urgency = 0.4;
    else urgency = 0.2;
    
    // Combine with priority
    const priorityScore = this.priorityToNumber(task.priority);
    
    return (urgency * 0.6) + (priorityScore * 0.4);
  }
  
  /**
   * Calculate context score
   */
  private calculateContextScore(features: SchedulingFeatures, task: Task): number {
    let score = 0.7; // Base score
    
    // Bonus for scheduling during peak energy if requires focus
    if (task.requiresFocus && features.energyLevel > 0.8) {
      score += 0.2;
    }
    
    // Penalty for too many meetings nearby
    if (features.recentMeetingCount > 2) {
      score -= 0.2;
    }
    
    // Bonus for upcoming break after deep work
    if (task.requiresFocus && features.timeUntilNextMeeting > task.estimatedDuration + 30) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate conflict score
   */
  private calculateConflictScore(features: SchedulingFeatures): number {
    let score = 1.0; // No conflicts
    
    // Penalty for overwork
    if (features.hoursWorkedToday > 6) {
      score -= 0.3;
    }
    
    // Penalty for weekend
    if (features.isWeekend) {
      score -= 0.2;
    }
    
    // Penalty for too long without break
    if (features.timeSinceLastBreak > 120) {
      score -= 0.2;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Calculate preference score
   */
  private calculatePreferenceScore(features: SchedulingFeatures, task: Task): number {
    let score = 0.7;
    
    // Morning preference for deep work
    if (task.requiresFocus && features.hourOfDay >= 8 && features.hourOfDay <= 11) {
      score += 0.2;
    }
    
    // Afternoon preference for meetings/collaboration
    if (!task.requiresFocus && features.hourOfDay >= 13 && features.hourOfDay <= 16) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private getTasksForDay(date: Date, tasks: Task[]): Task[] {
    return tasks.filter(task => {
      if (task.status !== 'pending') return false;
      
      // Include if due today or overdue
      if (task.dueDate) {
        const daysUntilDue = (task.dueDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilDue <= 7; // Include tasks due within 7 days
      }
      
      return true;
    });
  }
  
  private getEventsForDay(date: Date, events: CalendarEvent[]): CalendarEvent[] {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }
  
  private createTaskBlock(
    task: Task,
    slot: TimeSlot,
    energyProfile: EnergyProfile,
    date: Date
  ): ScheduledBlock {
    const endTime = new Date(slot.start);
    endTime.setMinutes(endTime.getMinutes() + task.estimatedDuration);
    
    const energyLevel = this.getEnergyLevel(slot.start, energyProfile);
    const priorityScore = this.priorityToNumber(task.priority);
    
    const rationale: string[] = [];
    
    if (energyLevel > 0.7 && task.requiresFocus) {
      rationale.push('Scheduled during high energy period for deep focus work');
    }
    
    if (task.dueDate) {
      const daysUntil = (task.dueDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntil < 2) {
        rationale.push(`Due soon (${Math.floor(daysUntil)} days)`);
      }
    }
    
    if (task.priority === 'urgent' || task.priority === 'high') {
      rationale.push(`High priority (${task.priority})`);
    }
    
    return {
      id: uuidv4(),
      startTime: slot.start,
      endTime,
      duration: task.estimatedDuration,
      type: 'task',
      taskId: task.id,
      title: task.title,
      description: task.description,
      confidenceScore: energyLevel * 0.7 + priorityScore * 0.3,
      priorityScore,
      energyMatch: energyLevel,
      rationale,
      status: 'proposed',
      isFlexible: task.canSplit,
      hasConflicts: false,
    };
  }
  
  private createEventBlocks(events: CalendarEvent[]): ScheduledBlock[] {
    return events.map(event => ({
      id: uuidv4(),
      startTime: event.startTime,
      endTime: event.endTime,
      duration: (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60),
      type: 'meeting' as const,
      eventId: event.id,
      title: event.title,
      description: event.description,
      confidenceScore: 1.0,
      priorityScore: 0.8,
      energyMatch: 0.7,
      rationale: ['Existing calendar event'],
      status: 'confirmed' as const,
      isFlexible: event.isMovable,
      hasConflicts: false,
    }));
  }
  
  private getEnergyLevel(time: Date, profile: EnergyProfile): number {
    const hour = time.getHours();
    const dayOfWeek = this.getDayOfWeek(time).toLowerCase() as keyof typeof profile.hourlyPattern;
    
    if (profile.hourlyPattern[dayOfWeek]) {
      return profile.hourlyPattern[dayOfWeek][hour] || 0.5;
    }
    
    // Default pattern if not available
    if (hour >= 9 && hour <= 11) return 0.9;
    if (hour >= 14 && hour <= 16) return 0.7;
    if (hour >= 19 || hour <= 7) return 0.3;
    return 0.6;
  }
  
  private calculateDayMetrics(
    blocks: ScheduledBlock[],
    energyProfile: EnergyProfile,
    date: Date
  ) {
    const totalScheduledTime = blocks.reduce((sum, b) => sum + b.duration, 0);
    const deepWorkTime = blocks.filter(b => b.type === 'task').reduce((sum, b) => sum + b.duration, 0);
    const meetingTime = blocks.filter(b => b.type === 'meeting').reduce((sum, b) => sum + b.duration, 0);
    const breakTime = blocks.filter(b => b.type === 'break').reduce((sum, b) => sum + b.duration, 0);
    
    const workDayMinutes = 8 * 60;
    const freeTime = workDayMinutes - totalScheduledTime;
    
    const overloadRisk = totalScheduledTime > (this.config.maxDailyHours * 60) ? 0.8 : 0.2;
    
    const energyAlignment = blocks.reduce((sum, block) => {
      const energy = this.getEnergyLevel(block.startTime, energyProfile);
      return sum + (block.energyMatch * energy);
    }, 0) / (blocks.length || 1);
    
    return {
      totalScheduledTime,
      deepWorkTime,
      meetingTime,
      breakTime,
      freeTime,
      overloadRisk,
      energyAlignment,
    };
  }
  
  private generateSummary(dailyPlans: DailyPlan[], tasks: Task[]): PlanSummary {
    const scheduledTasks = dailyPlans.reduce((sum, day) =>
      sum + day.blocks.filter(b => b.type === 'task').length, 0
    );
    
    const totalMeetings = dailyPlans.reduce((sum, day) =>
      sum + day.blocks.filter(b => b.type === 'meeting').length, 0
    );
    
    const totalDeepWorkHours = dailyPlans.reduce((sum, day) =>
      sum + (day.deepWorkTime / 60), 0
    );
    
    const avgConfidence = dailyPlans.reduce((sum, day) => {
      const dayConf = day.blocks.reduce((s, b) => s + b.confidenceScore, 0) / (day.blocks.length || 1);
      return sum + dayConf;
    }, 0) / dailyPlans.length;
    
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      scheduledTasks,
      unscheduledTasks: tasks.filter(t => t.status === 'pending').length - scheduledTasks,
      totalMeetings,
      totalDeepWorkHours,
      totalBreakTime: 0,
      averageConfidence: avgConfidence,
      overallFeasibility: 0.8,
      topPriorities: tasks.filter(t => t.priority === 'urgent').map(t => t.title).slice(0, 5),
      potentialIssues: [],
      recommendations: ['Consider blocking time for deep work', 'Add buffers between meetings'],
    };
  }
  
  private generateWarnings(dailyPlans: DailyPlan[]): string[] {
    const warnings: string[] = [];
    
    dailyPlans.forEach(day => {
      if (day.overloadRisk > 0.7) {
        warnings.push(`${day.dayOfWeek}: High overload risk - consider reducing commitments`);
      }
      
      if (day.energyAlignment < 0.5) {
        warnings.push(`${day.dayOfWeek}: Poor energy alignment - tasks may be scheduled at suboptimal times`);
      }
    });
    
    return warnings;
  }
  
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }
  
  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }
  
  private priorityToNumber(priority: string): number {
    const map = { urgent: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
    return map[priority as keyof typeof map] || 0.5;
  }
  
  private energyToNumber(energy: string): number {
    const map = { high: 0.9, medium: 0.6, low: 0.3 };
    return map[energy as keyof typeof map] || 0.6;
  }
  
  private calculatePriorityScore(task: Task): number {
    return this.priorityToNumber(task.priority);
  }
  
  private calculateTaskEnergyScore(task: Task): number {
    return this.energyToNumber(task.requiresEnergy);
  }
  
  private consumeSlot(slots: TimeSlot[], usedSlot: TimeSlot): void {
    const index = slots.findIndex(s => s === usedSlot);
    if (index !== -1) {
      slots.splice(index, 1);
    }
  }
  
  private addBuffer(slots: TimeSlot[], after: Date, minutes: number): void {
    // Remove buffer time from next slot
    const nextSlot = slots.find(s => s.start.getTime() === after.getTime());
    if (nextSlot) {
      nextSlot.start = new Date(nextSlot.start.getTime() + minutes * 60 * 1000);
    }
  }
  
  private removeBlockedSlots(slots: TimeSlot[], blocked: TimeSlot[]): TimeSlot[] {
    // Simplified - just filter out overlapping slots
    return slots.filter(slot => {
      return !blocked.some(block => 
        (slot.start >= block.start && slot.start < block.end) ||
        (slot.end > block.start && slot.end <= block.end)
      );
    });
  }
}

// ============================================================================
// EXPORT
// ============================================================================

interface TimeSlot {
  start: Date;
  end: Date;
}

export const plannerEngine = new PlannerEngine();
