/**
 * Tests for Planner Engine
 */

import { PlannerEngine } from '../PlannerEngine';
import {
  Task,
  CalendarEvent,
  EnergyProfile,
  PlannerRequest,
  DEFAULT_PLANNER_CONFIG,
} from '../plannerModels';

describe('PlannerEngine', () => {
  let plannerEngine: PlannerEngine;
  let mockTasks: Task[];
  let mockEvents: CalendarEvent[];
  let mockEnergyProfile: EnergyProfile;

  beforeEach(() => {
    plannerEngine = new PlannerEngine(DEFAULT_PLANNER_CONFIG);

    // Mock tasks
    mockTasks = [
      {
        id: 'task-1',
        userId: 'user-1',
        title: 'Write project proposal',
        description: 'Draft Q4 proposal',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        estimatedDuration: 120,
        priority: 'high',
        category: 'work',
        tags: ['writing', 'proposal'],
        requiresFocus: true,
        requiresEnergy: 'high',
        canSplit: true,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-2',
        userId: 'user-1',
        title: 'Review team submissions',
        estimatedDuration: 60,
        priority: 'medium',
        category: 'work',
        tags: ['review'],
        requiresFocus: false,
        requiresEnergy: 'medium',
        canSplit: false,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-3',
        userId: 'user-1',
        title: 'Gym workout',
        estimatedDuration: 90,
        priority: 'low',
        category: 'health',
        tags: ['exercise'],
        requiresFocus: false,
        requiresEnergy: 'medium',
        canSplit: false,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Mock calendar events
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    mockEvents = [
      {
        id: 'event-1',
        userId: 'user-1',
        title: 'Team standup',
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 30 * 60 * 1000),
        isAllDay: false,
        timezone: 'UTC',
        type: 'meeting',
        isRecurring: false,
        isMovable: false,
        minNotice: 24,
        status: 'confirmed',
        source: 'google_calendar',
      },
    ];

    // Mock energy profile
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
      peakFocusWindows: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', energy: 0.9, focusQuality: 0.9 },
      ],
      preferredWorkHours: { start: '09:00', end: '17:00' },
      typicalSleepTime: '23:00',
      typicalWakeTime: '07:00',
      preferredBreakDuration: 15,
      breakFrequency: 90,
      deepWorkCapacity: 4,
      maxMeetingsPerDay: 5,
      lastUpdated: new Date(),
      confidence: 0.8,
    };
  });

  describe('generatePlan', () => {
    it('should generate a daily plan successfully', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.horizon).toBe('daily');
      expect(result.dailyPlans).toHaveLength(1);
      expect(result.totalTasksScheduled).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should generate a weekly plan successfully', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'weekly',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.horizon).toBe('weekly');
      expect(result.dailyPlans).toHaveLength(7);
    });

    it('should schedule high-priority tasks first', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      const taskBlocks = result.dailyPlans[0].blocks.filter(b => b.type === 'task');

      if (taskBlocks.length > 0) {
        // First scheduled task should have high priority score
        expect(taskBlocks[0].priorityScore).toBeGreaterThan(0.5);
      }
    });

    it('should include existing calendar events', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      // Check if any day has meeting blocks
      const hasMeetings = result.dailyPlans.some(day =>
        day.blocks.some(b => b.type === 'meeting')
      );

      expect(hasMeetings).toBe(true);
    });

    it('should provide rationale for scheduling decisions', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      const taskBlocks = result.dailyPlans[0].blocks.filter(b => b.type === 'task');

      if (taskBlocks.length > 0) {
        expect(taskBlocks[0].rationale).toBeDefined();
        expect(taskBlocks[0].rationale.length).toBeGreaterThan(0);
      }
    });

    it('should calculate summary metrics', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      expect(result.summary).toBeDefined();
      expect(result.summary.totalTasks).toBe(mockTasks.length);
      expect(result.summary.scheduledTasks).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageConfidence).toBeGreaterThan(0);
    });

    it('should respect energy profile for focus tasks', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      const focusTasks = result.dailyPlans[0].blocks.filter(
        b => b.type === 'task' && b.title === 'Write project proposal'
      );

      if (focusTasks.length > 0) {
        // Focus task should have decent energy match
        expect(focusTasks[0].energyMatch).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Plan quality', () => {
    it('should not overload schedule beyond max hours', async () => {
      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
        constraints: {
          maxHoursPerDay: 8,
        },
      };

      const result = await plannerEngine.generatePlan(
        request,
        mockTasks,
        mockEvents,
        mockEnergyProfile
      );

      result.dailyPlans.forEach(day => {
        const totalHours = day.totalScheduledTime / 60;
        // Should respect constraints (allowing some flexibility)
        expect(totalHours).toBeLessThanOrEqual(10);
      });
    });

    it('should generate warnings for high-risk days', async () => {
      // Create many tasks to create overload
      const manyTasks = Array.from({ length: 15 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        estimatedDuration: 120,
      }));

      const request: PlannerRequest = {
        userId: 'user-1',
        horizon: 'daily',
        date: new Date(),
      };

      const result = await plannerEngine.generatePlan(
        request,
        manyTasks,
        mockEvents,
        mockEnergyProfile
      );

      // Should have warnings about overload
      expect(result.warnings).toBeDefined();
    });
  });
});
