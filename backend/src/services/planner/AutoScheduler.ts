/**
 * Auto-Scheduling Service
 * 
 * Handles automatic task scheduling with approval workflows
 */

import {
  Task,
  SchedulingCandidate,
  ApprovalRequest,
  AlternativeSlot,
  ScoreBreakdown,
  EnergyProfile,
  CalendarEvent,
  ScheduledBlock,
} from './plannerModels';
import { PlannerEngine } from './PlannerEngine';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

// ============================================================================
// AUTO-SCHEDULER CLASS
// ============================================================================

export class AutoScheduler {
  private plannerEngine: PlannerEngine;
  
  constructor() {
    this.plannerEngine = new PlannerEngine();
  }
  
  /**
   * Create scheduling candidates for a task
   */
  async createCandidates(
    task: Task,
    events: CalendarEvent[],
    energyProfile: EnergyProfile,
    numCandidates: number = 3
  ): Promise<SchedulingCandidate[]> {
    logger.info('Creating scheduling candidates', { taskId: task.id, numCandidates });
    
    const candidates: SchedulingCandidate[] = [];
    const now = new Date();
    const searchEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next 7 days
    
    // Find all possible slots
    const possibleSlots = this.findPossibleSlots(
      task,
      now,
      searchEnd,
      events,
      energyProfile
    );
    
    // Score each slot
    const scoredSlots = possibleSlots.map(slot => ({
      ...slot,
      scoreBreakdown: this.scoreSlot(slot.start, task, energyProfile, events),
    })).sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore);
    
    // Create candidates for top slots
    for (let i = 0; i < Math.min(numCandidates, scoredSlots.length); i++) {
      const slot = scoredSlots[i];
      
      // Find alternatives (other high-scoring slots)
      const alternatives = scoredSlots
        .slice(i + 1, i + 3)
        .map(alt => ({
          startTime: alt.start,
          endTime: alt.end,
          score: alt.scoreBreakdown.totalScore * 100,
          reason: this.generateSlotReason(alt.scoreBreakdown),
        }));
      
      candidates.push({
        candidateId: uuidv4(),
        taskId: task.id,
        proposedStart: slot.start,
        proposedEnd: slot.end,
        score: slot.scoreBreakdown.totalScore * 100,
        scoreBreakdown: slot.scoreBreakdown,
        alternatives,
        requiresApproval: true,
      });
    }
    
    return candidates;
  }
  
  /**
   * Create approval request for candidates
   */
  async createApprovalRequest(
    userId: string,
    candidates: SchedulingCandidate[]
  ): Promise<ApprovalRequest> {
    const requestId = uuidv4();
    const approvalLink = `/api/v1/planner/approve/${requestId}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    
    return {
      id: requestId,
      userId,
      candidates,
      approvalLink,
      expiresAt,
      status: 'pending',
    };
  }
  
  /**
   * Generate approval email content
   */
  generateApprovalEmail(request: ApprovalRequest, task: Task): string {
    const candidate = request.candidates[0];
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
    .candidate { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
    .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
    .score { font-size: 24px; font-weight: bold; color: #4CAF50; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📅 Schedule Approval Request</h2>
    </div>
    
    <div class="content">
      <h3>Task: ${task.title}</h3>
      <p>${task.description || ''}</p>
      
      <p><strong>Duration:</strong> ${task.estimatedDuration} minutes</p>
      <p><strong>Priority:</strong> ${task.priority}</p>
      ${task.dueDate ? `<p><strong>Due:</strong> ${task.dueDate.toLocaleDateString()}</p>` : ''}
      
      <h4>Recommended Time Slot</h4>
      <div class="candidate">
        <p><strong>📆 ${candidate.proposedStart.toLocaleDateString()}</strong></p>
        <p><strong>🕐 ${this.formatTime(candidate.proposedStart)} - ${this.formatTime(candidate.proposedEnd)}</strong></p>
        <p class="score">Score: ${candidate.score.toFixed(0)}/100</p>
        <p><strong>Why this time?</strong></p>
        <ul>
          <li>Energy level: ${(candidate.scoreBreakdown.energyScore * 100).toFixed(0)}%</li>
          <li>Urgency fit: ${(candidate.scoreBreakdown.urgencyScore * 100).toFixed(0)}%</li>
          <li>Context match: ${(candidate.scoreBreakdown.contextScore * 100).toFixed(0)}%</li>
        </ul>
      </div>
      
      ${candidate.alternatives.length > 0 ? `
      <h4>Alternative Times</h4>
      ${candidate.alternatives.map(alt => `
        <div style="padding: 10px; margin: 5px 0; background: white;">
          <p><strong>${this.formatTime(alt.startTime)} - ${this.formatTime(alt.endTime)}</strong></p>
          <p>Score: ${alt.score.toFixed(0)}/100 - ${alt.reason}</p>
        </div>
      `).join('')}
      ` : ''}
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${request.approvalLink}?action=approve" class="button">✓ Approve</a>
        <a href="${request.approvalLink}?action=reject" class="button" style="background: #F44336;">✗ Reject</a>
        <a href="${request.approvalLink}" class="button" style="background: #FF9800;">⏰ Choose Different Time</a>
      </div>
    </div>
    
    <p style="text-align: center; color: #666; font-size: 12px;">
      This request expires on ${request.expiresAt.toLocaleDateString()}
    </p>
  </div>
</body>
</html>
    `.trim();
  }
  
  /**
   * Handle rescheduling with conflict resolution
   */
  async reschedule(
    task: Task,
    reason: 'conflict' | 'overload' | 'low_energy' | 'urgent_task' | 'manual',
    currentBlock: ScheduledBlock,
    allBlocks: ScheduledBlock[],
    events: CalendarEvent[],
    energyProfile: EnergyProfile
  ): Promise<SchedulingCandidate[]> {
    logger.info('Rescheduling task', { taskId: task.id, reason });
    
    // Find new candidates, excluding current time
    const excludedSlot = {
      start: currentBlock.startTime,
      end: currentBlock.endTime,
    };
    
    const candidates = await this.createCandidates(task, events, energyProfile);
    
    // Filter out current slot
    return candidates.filter(c => 
      c.proposedStart.getTime() !== excludedSlot.start.getTime()
    );
  }
  
  /**
   * Resolve scheduling conflicts
   */
  async resolveConflicts(
    blocks: ScheduledBlock[],
    tasks: Task[],
    events: CalendarEvent[],
    energyProfile: EnergyProfile
  ): Promise<{
    resolvedBlocks: ScheduledBlock[];
    rescheduledTasks: Task[];
  }> {
    logger.info('Resolving scheduling conflicts', { blocksCount: blocks.length });
    
    // Detect overlapping blocks
    const conflicts = this.detectConflicts(blocks);
    
    if (conflicts.length === 0) {
      return { resolvedBlocks: blocks, rescheduledTasks: [] };
    }
    
    const resolvedBlocks = [...blocks];
    const rescheduledTasks: Task[] = [];
    
    // Resolve each conflict
    for (const conflict of conflicts) {
      const block1 = resolvedBlocks.find(b => b.id === conflict.affectedBlocks[0]);
      const block2 = resolvedBlocks.find(b => b.id === conflict.affectedBlocks[1]);
      
      if (!block1 || !block2) continue;
      
      // Priority: meetings > high-priority tasks > low-priority tasks
      const priorityScore1 = block1.type === 'meeting' ? 2 : block1.priorityScore;
      const priorityScore2 = block2.type === 'meeting' ? 2 : block2.priorityScore;
      
      if (priorityScore1 > priorityScore2) {
        // Keep block1, reschedule block2
        if (block2.taskId) {
          const task = tasks.find(t => t.id === block2.taskId);
          if (task) {
            rescheduledTasks.push(task);
            // Remove block2
            const index = resolvedBlocks.findIndex(b => b.id === block2.id);
            if (index !== -1) resolvedBlocks.splice(index, 1);
          }
        }
      } else {
        // Keep block2, reschedule block1
        if (block1.taskId) {
          const task = tasks.find(t => t.id === block1.taskId);
          if (task) {
            rescheduledTasks.push(task);
            const index = resolvedBlocks.findIndex(b => b.id === block1.id);
            if (index !== -1) resolvedBlocks.splice(index, 1);
          }
        }
      }
    }
    
    return { resolvedBlocks, rescheduledTasks };
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private findPossibleSlots(
    task: Task,
    startDate: Date,
    endDate: Date,
    events: CalendarEvent[],
    energyProfile: EnergyProfile
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Check each hour of the day
      for (let hour = 8; hour < 20; hour++) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + task.estimatedDuration);
        
        // Check if slot is free
        if (this.isSlotFree(slotStart, slotEnd, events)) {
          slots.push({ start: slotStart, end: slotEnd });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots;
  }
  
  private isSlotFree(
    start: Date,
    end: Date,
    events: CalendarEvent[]
  ): boolean {
    return !events.some(event => 
      (start >= event.startTime && start < event.endTime) ||
      (end > event.startTime && end <= event.endTime) ||
      (start <= event.startTime && end >= event.endTime)
    );
  }
  
  private scoreSlot(
    startTime: Date,
    task: Task,
    energyProfile: EnergyProfile,
    events: CalendarEvent[]
  ): ScoreBreakdown {
    // Simplified scoring - in real implementation, use PlannerEngine
    const hour = startTime.getHours();
    const dayOfWeek = startTime.getDay();
    
    const energyScore = this.getEnergyAtTime(startTime, energyProfile);
    const urgencyScore = task.dueDate 
      ? 1 - (task.dueDate.getTime() - startTime.getTime()) / (7 * 24 * 60 * 60 * 1000)
      : 0.5;
    const contextScore = 0.7;
    const conflictScore = 1.0;
    const preferenceScore = task.requiresFocus && hour >= 9 && hour <= 11 ? 0.9 : 0.6;
    
    const weights = { energy: 0.3, urgency: 0.25, context: 0.2, conflict: 0.15, preference: 0.1 };
    
    const totalScore = 
      energyScore * weights.energy +
      urgencyScore * weights.urgency +
      contextScore * weights.context +
      conflictScore * weights.conflict +
      preferenceScore * weights.preference;
    
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
  
  private getEnergyAtTime(time: Date, profile: EnergyProfile): number {
    const hour = time.getHours();
    if (hour >= 9 && hour <= 11) return 0.9;
    if (hour >= 14 && hour <= 16) return 0.7;
    if (hour >= 19 || hour <= 7) return 0.3;
    return 0.6;
  }
  
  private generateSlotReason(breakdown: ScoreBreakdown): string {
    if (breakdown.energyScore > 0.8) return 'High energy period';
    if (breakdown.urgencyScore > 0.8) return 'Close to deadline';
    if (breakdown.preferenceScore > 0.8) return 'Optimal time for this task type';
    return 'Good overall fit';
  }
  
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  private detectConflicts(blocks: ScheduledBlock[]): any[] {
    const conflicts: any[] = [];
    
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const block1 = blocks[i];
        const block2 = blocks[j];
        
        // Check for time overlap
        if (
          (block1.startTime >= block2.startTime && block1.startTime < block2.endTime) ||
          (block1.endTime > block2.startTime && block1.endTime <= block2.endTime) ||
          (block1.startTime <= block2.startTime && block1.endTime >= block2.endTime)
        ) {
          conflicts.push({
            type: 'time_overlap',
            severity: 'high',
            description: `${block1.title} overlaps with ${block2.title}`,
            affectedBlocks: [block1.id, block2.id],
          });
        }
      }
    }
    
    return conflicts;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const autoScheduler = new AutoScheduler();
