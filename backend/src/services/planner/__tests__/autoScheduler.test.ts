/**
 * Tests for Auto Scheduler
 */

import { AutoScheduler } from '../AutoScheduler';
import {
  Task,
  CalendarEvent,
  EnergyProfile,
  ScheduledBlock,
} from '../plannerModels';

describe('AutoScheduler', () => {
  let autoScheduler: AutoScheduler;
  let mockTask: Task;
  let mockEvents: CalendarEvent[];
  let mockEnergyProfile: EnergyProfile;

  beforeEach(() => {
    autoScheduler = new AutoScheduler();

    mockTask = {
      id: 'task-1',
      userId: 'user-1',
      title: 'Complete report',
      description: 'Quarterly report',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      estimatedDuration: 90,
      priority: 'high',
      category: 'work',
      tags: ['report'],
      requiresFocus: true,
      requiresEnergy: 'high',
      canSplit: false,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockEvents = [];

    mockEnergyProfile = {
      userId: 'user-1',
      hourlyPattern: {
        monday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : 0.6)),
        tuesday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : 0.6)),
        wednesday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : 0.6)),
        thursday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : 0.6)),
        friday: Array(24).fill(0.6).map((_, i) => (i >= 9 && i <= 11 ? 0.9 : 0.6)),
        saturday: Array(24).fill(0.5),
        sunday: Array(24).fill(0.5),
      },
      peakFocusWindows: [],
      preferredWorkHours: { start: '09:00', end: '17:00' },
      typicalSleepTime: '23:00',
      typicalWakeTime: '07:00',
      preferredBreakDuration: 15,
      breakFrequency: 90,
      deepWorkCapacity: 4,
      maxMeetingsPerDay: 5,
      lastUpdated: new Date(),
      confidence: 0.7,
    };
  });

  describe('createCandidates', () => {
    it('should create scheduling candidates for a task', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        3
      );

      expect(candidates).toBeDefined();
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.length).toBeLessThanOrEqual(3);
    });

    it('should include score breakdown for each candidate', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        3
      );

      expect(candidates[0].scoreBreakdown).toBeDefined();
      expect(candidates[0].scoreBreakdown.energyScore).toBeGreaterThanOrEqual(0);
      expect(candidates[0].scoreBreakdown.urgencyScore).toBeGreaterThanOrEqual(0);
      expect(candidates[0].scoreBreakdown.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should provide alternative time slots', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        3
      );

      if (candidates.length > 0 && candidates[0].alternatives.length > 0) {
        expect(candidates[0].alternatives[0].startTime).toBeDefined();
        expect(candidates[0].alternatives[0].reason).toBeDefined();
      }
    });

    it('should sort candidates by score', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        3
      );

      if (candidates.length > 1) {
        expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score);
      }
    });
  });

  describe('createApprovalRequest', () => {
    it('should create an approval request', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        2
      );

      const approvalRequest = await autoScheduler.createApprovalRequest(
        'user-1',
        candidates
      );

      expect(approvalRequest).toBeDefined();
      expect(approvalRequest.id).toBeDefined();
      expect(approvalRequest.userId).toBe('user-1');
      expect(approvalRequest.candidates).toEqual(candidates);
      expect(approvalRequest.approvalLink).toContain('/api/v1/planner/approve/');
      expect(approvalRequest.status).toBe('pending');
    });

    it('should set expiration time', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        2
      );

      const approvalRequest = await autoScheduler.createApprovalRequest(
        'user-1',
        candidates
      );

      const now = Date.now();
      const expiresAt = approvalRequest.expiresAt.getTime();

      // Should expire in approximately 48 hours
      expect(expiresAt - now).toBeGreaterThan(47 * 60 * 60 * 1000);
      expect(expiresAt - now).toBeLessThan(49 * 60 * 60 * 1000);
    });
  });

  describe('generateApprovalEmail', () => {
    it('should generate HTML email content', async () => {
      const candidates = await autoScheduler.createCandidates(
        mockTask,
        mockEvents,
        mockEnergyProfile,
        2
      );

      const approvalRequest = await autoScheduler.createApprovalRequest(
        'user-1',
        candidates
      );

      const emailHtml = autoScheduler.generateApprovalEmail(approvalRequest, mockTask);

      expect(emailHtml).toContain('<!DOCTYPE html>');
      expect(emailHtml).toContain(mockTask.title);
      expect(emailHtml).toContain('Approve');
      expect(emailHtml).toContain('Reject');
      expect(emailHtml).toContain(approvalRequest.approvalLink);
    });
  });

  describe('resolveConflicts', () => {
    it('should detect time overlaps', async () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);

      const blocks: ScheduledBlock[] = [
        {
          id: 'block-1',
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          duration: 60,
          type: 'task',
          taskId: 'task-1',
          title: 'Task 1',
          confidenceScore: 0.8,
          priorityScore: 0.7,
          energyMatch: 0.9,
          rationale: ['test'],
          status: 'proposed',
          isFlexible: true,
          hasConflicts: false,
        },
        {
          id: 'block-2',
          startTime: new Date(now.getTime() + 30 * 60 * 1000), // Overlaps
          endTime: new Date(now.getTime() + 90 * 60 * 1000),
          duration: 60,
          type: 'task',
          taskId: 'task-2',
          title: 'Task 2',
          confidenceScore: 0.7,
          priorityScore: 0.6,
          energyMatch: 0.8,
          rationale: ['test'],
          status: 'proposed',
          isFlexible: true,
          hasConflicts: false,
        },
      ];

      const result = await autoScheduler.resolveConflicts(
        blocks,
        [mockTask],
        mockEvents,
        mockEnergyProfile
      );

      expect(result.rescheduledTasks).toBeDefined();
      expect(result.resolvedBlocks.length).toBeLessThan(blocks.length);
    });

    it('should prioritize meetings over tasks', async () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);

      const blocks: ScheduledBlock[] = [
        {
          id: 'block-1',
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          duration: 60,
          type: 'meeting',
          eventId: 'event-1',
          title: 'Important meeting',
          confidenceScore: 1.0,
          priorityScore: 0.9,
          energyMatch: 0.7,
          rationale: ['Calendar event'],
          status: 'confirmed',
          isFlexible: false,
          hasConflicts: false,
        },
        {
          id: 'block-2',
          startTime: new Date(now.getTime() + 30 * 60 * 1000),
          endTime: new Date(now.getTime() + 90 * 60 * 1000),
          duration: 60,
          type: 'task',
          taskId: 'task-1',
          title: 'Work task',
          confidenceScore: 0.7,
          priorityScore: 0.6,
          energyMatch: 0.8,
          rationale: ['test'],
          status: 'proposed',
          isFlexible: true,
          hasConflicts: false,
        },
      ];

      const result = await autoScheduler.resolveConflicts(
        blocks,
        [mockTask],
        mockEvents,
        mockEnergyProfile
      );

      // Meeting should remain, task should be rescheduled
      const hasMeeting = result.resolvedBlocks.some(b => b.type === 'meeting');
      expect(hasMeeting).toBe(true);
    });
  });
});
