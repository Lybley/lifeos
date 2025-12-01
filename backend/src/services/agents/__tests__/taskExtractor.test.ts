/**
 * TaskExtractor Agent - Unit Tests
 */

import {
  buildTaskExtractionPrompt,
  parseTaskExtractionResponse,
  CONFIDENCE_RULES,
  TaskInput,
  ExtractedTask,
} from '../taskExtractorPrompt';

describe('TaskExtractor - Prompt Generation', () => {
  test('should build correct prompt with all metadata', () => {
    const input: TaskInput = {
      text: 'Please review the API docs by Friday.',
      metadata: {
        source_id: 'email_123',
        source_type: 'email',
        sender: 'John Doe',
        sender_email: 'john@company.com',
        subject: 'API Review Request',
        date: '2024-03-10',
      },
    };

    const prompt = buildTaskExtractionPrompt(input, new Date('2024-03-10'));

    expect(prompt).toContain('email_123');
    expect(prompt).toContain('John Doe');
    expect(prompt).toContain('john@company.com');
    expect(prompt).toContain('API Review Request');
    expect(prompt).toContain('Please review the API docs by Friday');
  });

  test('should handle minimal metadata', () => {
    const input: TaskInput = {
      text: 'Complete the security audit',
      metadata: {
        source_id: 'doc_456',
      },
    };

    const prompt = buildTaskExtractionPrompt(input, new Date());

    expect(prompt).toContain('doc_456');
    expect(prompt).toContain('Complete the security audit');
  });
});

describe('TaskExtractor - Response Parsing', () => {
  test('should parse valid JSON response', () => {
    const response = `[\n  {\n    \"task_text\": \"Review API documentation\",\n    \"due_date\": \"2024-03-15\",\n    \"assignee\": \"Sarah\",\n    \"confidence\": 0.95,\n    \"source_id\": \"email_123\",\n    \"context\": \"Please review by Friday\"\n  }\n]`;

    const tasks = parseTaskExtractionResponse(response, 'email_123');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_text).toBe('Review API documentation');
    expect(tasks[0].due_date).toBe('2024-03-15');
    expect(tasks[0].assignee).toBe('Sarah');
    expect(tasks[0].confidence).toBe(0.95);
  });

  test('should parse JSON with markdown code blocks', () => {
    const response = '```json\n[{\"task_text\":\"Test task\",\"confidence\":0.9,\"source_id\":\"test\",\"due_date\":null,\"assignee\":null}]\n```';

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_text).toBe('Test task');
  });

  test('should filter out low confidence tasks', () => {
    const response = JSON.stringify([
      { task_text: 'High confidence task', confidence: 0.95, source_id: 'test' },
      { task_text: 'Low confidence task', confidence: 0.3, source_id: 'test' },
    ]);

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_text).toBe('High confidence task');
  });

  test('should handle empty array', () => {
    const response = '[]';
    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks).toHaveLength(0);
  });

  test('should handle invalid JSON gracefully', () => {
    const response = 'This is not JSON';
    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks).toHaveLength(0);
  });

  test('should normalize task fields', () => {
    const response = JSON.stringify([
      {
        task_text: '  Extra spaces and very long text that exceeds 100 characters limit so it should be truncated properly by the parser function  ',
        confidence: 1.5, // Over 1.0
        source_id: 'test',
        due_date: null,
        assignee: null,
      },
    ]);

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks[0].task_text.length).toBeLessThanOrEqual(100);
    expect(tasks[0].task_text).not.toMatch(/^\\s+/);
    expect(tasks[0].confidence).toBe(1.0); // Capped at 1.0
  });
});

describe('TaskExtractor - Confidence Rules', () => {
  test('should correctly identify confidence levels', () => {
    expect(CONFIDENCE_RULES.getConfidenceLabel(0.95)).toBe('high');
    expect(CONFIDENCE_RULES.getConfidenceLabel(0.75)).toBe('medium');
    expect(CONFIDENCE_RULES.getConfidenceLabel(0.55)).toBe('low');
  });

  test('should determine if human confirmation required', () => {
    expect(CONFIDENCE_RULES.requiresHumanConfirmation(0.95)).toBe(false);
    expect(CONFIDENCE_RULES.requiresHumanConfirmation(0.85)).toBe(false);
    expect(CONFIDENCE_RULES.requiresHumanConfirmation(0.75)).toBe(true);
    expect(CONFIDENCE_RULES.requiresHumanConfirmation(0.60)).toBe(true);
  });

  test('should have correct auto-accept threshold', () => {
    expect(CONFIDENCE_RULES.autoAcceptThreshold).toBe(0.9);
  });
});

describe('TaskExtractor - Integration Tests', () => {
  /**\n   * These tests mock the LLM response\n   * In real usage, the LLM would generate these responses\n   */\n\n  test('Example 1: Email with explicit tasks', () => {
    const input: TaskInput = {
      text: `Hi Team,\n\nFor next week:\n1. Sarah, please review the API documentation by Wednesday\n2. John needs to complete the security audit by Friday\n3. Everyone should review the deployment checklist\n\nThanks!`,\n      metadata: {\n        source_id: 'email_001',\n        source_type: 'email',\n        sender: 'manager@company.com',\n        date: '2024-03-10',\n      },\n    };

    // Mock LLM response\n    const mockLLMResponse = [\n      {\n        task_text: 'Review API documentation',\n        due_date: '2024-03-13',\n        assignee: 'Sarah',\n        confidence: 0.95,\n        source_id: 'email_001',\n        context: 'Sarah, please review the API documentation by Wednesday',\n      },\n      {\n        task_text: 'Complete security audit',\n        due_date: '2024-03-15',\n        assignee: 'John',\n        confidence: 0.95,\n        source_id: 'email_001',\n        context: 'John needs to complete the security audit by Friday',\n      },\n      {\n        task_text: 'Review deployment checklist',\n        due_date: null,\n        assignee: null,\n        confidence: 0.80,\n        source_id: 'email_001',\n        context: 'Everyone should review the deployment checklist',\n      },\n    ];\n\n    const tasks = parseTaskExtractionResponse(\n      JSON.stringify(mockLLMResponse),\n      'email_001'\n    );\n\n    expect(tasks).toHaveLength(3);
    expect(tasks[0].assignee).toBe('Sarah');
    expect(tasks[1].assignee).toBe('John');
    expect(tasks[2].assignee).toBeNull();
  });

  test('Example 2: Meeting notes with mixed confidence', () => {
    const input: TaskInput = {
      text: `Sprint Planning Notes:\n- Complete API redesign (John - this Friday)\n- We should probably update the docs\n- Consider adding more tests\n- Sarah is working on bug fixes`,
      metadata: {
        source_id: 'meeting_002',
        source_type: 'meeting',
        date: '2024-03-10',
      },
    };

    const mockLLMResponse = [\n      {\n        task_text: 'Complete API redesign',\n        due_date: '2024-03-15',\n        assignee: 'John',\n        confidence: 0.95,\n        source_id: 'meeting_002',\n      },\n      {\n        task_text: 'Update documentation',\n        due_date: null,\n        assignee: null,\n        confidence: 0.70,\n        source_id: 'meeting_002',\n      },\n      {\n        task_text: 'Add more tests',\n        due_date: null,\n        assignee: null,\n        confidence: 0.60,\n        source_id: 'meeting_002',\n      },\n    ];\n\n    const tasks = parseTaskExtractionResponse(\n      JSON.stringify(mockLLMResponse),\n      'meeting_002'\n    );

    expect(tasks).toHaveLength(3);
    
    const highConfidenceTasks = tasks.filter(\n      (t) => t.confidence >= CONFIDENCE_RULES.HIGH\n    );\n    expect(highConfidenceTasks).toHaveLength(1);

    const requiresConfirmation = tasks.filter((t) =>\n      CONFIDENCE_RULES.requiresHumanConfirmation(t.confidence)\n    );\n    expect(requiresConfirmation).toHaveLength(2);
  });

  test('Example 3: No tasks in message', () => {
    const input: TaskInput = {
      text: 'Great job on the presentation! The client loved it. Looking forward to next meeting.',
      metadata: {
        source_id: 'email_003',
        source_type: 'email',
      },
    };

    const mockLLMResponse: ExtractedTask[] = [];

    const tasks = parseTaskExtractionResponse(\n      JSON.stringify(mockLLMResponse),\n      'email_003'\n    );

    expect(tasks).toHaveLength(0);
  });

  test('Example 4: Complex email with dates and priorities', () => {
    const input: TaskInput = {
      text: `Project Update:\n\nUrgent: Fix production bug by end of day (Mike)\nHigh priority: Deploy staging environment tomorrow\nUpdate project timeline by next Monday\nSchedule Q2 planning meeting`,
      metadata: {
        source_id: 'email_004',
        source_type: 'email',
        date: '2024-03-10',
      },
    };

    const mockLLMResponse = [\n      {\n        task_text: 'Fix production bug',\n        due_date: '2024-03-10',\n        assignee: 'Mike',\n        confidence: 0.98,\n        source_id: 'email_004',\n        context: 'Urgent: Fix production bug by end of day (Mike)',\n      },\n      {\n        task_text: 'Deploy staging environment',\n        due_date: '2024-03-11',\n        assignee: null,\n        confidence: 0.90,\n        source_id: 'email_004',\n      },\n      {\n        task_text: 'Update project timeline',\n        due_date: '2024-03-18',\n        assignee: null,\n        confidence: 0.85,\n        source_id: 'email_004',\n      },\n      {\n        task_text: 'Schedule Q2 planning meeting',\n        due_date: null,\n        assignee: null,\n        confidence: 0.88,\n        source_id: 'email_004',\n      },\n    ];\n\n    const tasks = parseTaskExtractionResponse(\n      JSON.stringify(mockLLMResponse),\n      'email_004'\n    );

    expect(tasks).toHaveLength(4);
    
    const autoAccept = tasks.filter(\n      (t) => t.confidence >= CONFIDENCE_RULES.autoAcceptThreshold\n    );\n    expect(autoAccept.length).toBeGreaterThanOrEqual(1);
  });
});

describe('TaskExtractor - Edge Cases', () => {
  test('should handle very long task text', () => {
    const longText = 'A'.repeat(500);
    const response = JSON.stringify([
      {
        task_text: longText,
        confidence: 0.9,
        source_id: 'test',
      },
    ]);

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks[0].task_text.length).toBe(100);
  });

  test('should handle special characters in task text', () => {
    const response = JSON.stringify([
      {
        task_text: 'Review PR #123 & merge @john\\'s changes',
        confidence: 0.9,
        source_id: 'test',
      },
    ]);

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks[0].task_text).toContain('#123');
    expect(tasks[0].task_text).toContain('&');
    expect(tasks[0].task_text).toContain('@');
  });

  test('should handle null and undefined fields', () => {
    const response = JSON.stringify([
      {
        task_text: 'Test task',
        due_date: null,
        assignee: undefined,
        confidence: 0.8,
        source_id: 'test',
        context: null,
      },
    ]);

    const tasks = parseTaskExtractionResponse(response, 'test');

    expect(tasks[0].due_date).toBeNull();
    expect(tasks[0].assignee).toBeNull();
    expect(tasks[0].context).toBeNull();
  });
});
