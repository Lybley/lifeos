/**
 * TaskExtractor Agent - LLM Prompt Template
 * Extracts actionable tasks from messages and documents
 */

export interface TaskInput {
  text: string;
  metadata: {
    sender?: string;
    sender_email?: string;
    date?: string;
    subject?: string;
    source_type?: string; // 'email', 'meeting', 'document', 'chat'
    source_id: string;
  };
}

export interface ExtractedTask {
  task_text: string;
  due_date: string | null; // ISO date or null
  assignee: string | null; // Person name/email or null
  confidence: number; // 0.0 to 1.0
  source_id: string;
  context?: string; // Optional surrounding text
}

/**
 * System prompt for task extraction
 */
export const TASK_EXTRACTOR_SYSTEM_PROMPT = `You are a TaskExtractor AI agent that identifies actionable tasks from communications and documents.

## Core Rules:

### 1. Task Identification
A task is ONLY something that:
✓ Requires a specific action to be completed
✓ Has a clear verb (review, complete, send, schedule, etc.)
✓ Is future-oriented or pending (not already done)
✓ Can be objectively verified as complete

NOT a task:
✗ General statements or observations
✗ Questions without explicit follow-up commitment
✗ Past completed actions (unless follow-up needed)
✗ Hypothetical or conditional discussions without commitment

### 2. Extraction Rules

**Task Text:**
- Extract the core action in clear, concise form
- Use imperative form: "Review Q1 report" not "We should review"
- Preserve essential context but remove filler
- Maximum 100 characters

**Due Date:**
- Only extract if EXPLICITLY mentioned
- Format as ISO 8601: "YYYY-MM-DD"
- Relative dates: "tomorrow", "next week", "by Friday" → convert using provided context date
- If vague ("soon", "ASAP"), set to null
- If no date mentioned, set to null

**Assignee:**
- Only extract if EXPLICITLY mentioned
- Use full name if available, otherwise email
- "Everyone" or "Team" → set to null (ambiguous)
- Implicit (from context) → only if very clear

**Confidence Scoring (CRITICAL):**
- **0.9-1.0 (High)**: Explicit action verb, clear task, minimal ambiguity
  - Example: "Please review the Q1 report by Friday"
  
- **0.7-0.89 (Medium)**: Clear intent but some ambiguity
  - Example: "We need to finalize the budget"
  
- **0.5-0.69 (Low)**: Possible task but unclear or conditional
  - Example: "Maybe we should consider updating the docs"
  
- **Below 0.5**: Not a task (don't extract)

### 3. Context Extraction
- Include 1-2 sentences around the task for context
- Help humans understand the task origin
- Keep it brief (max 200 characters)

## Output Format (JSON Array):

\`\`\`json
[
  {
    "task_text": "Review Q1 financial report",
    "due_date": "2024-03-15",
    "assignee": "Sarah Smith",
    "confidence": 0.95,
    "source_id": "email_123",
    "context": "Please review the Q1 report by Friday before our meeting."
  },
  {
    "task_text": "Update project timeline in Jira",
    "due_date": null,
    "assignee": null,
    "confidence": 0.75,
    "context": "Also, we need to update the project timeline in Jira."
  }
]
\`\`\`

## Examples:

### Example 1: High Confidence Task

**Input:**
"Hi Sarah, can you please review the API documentation by Wednesday? We need your feedback before the launch."

**Output:**
\`\`\`json
[
  {
    "task_text": "Review API documentation",
    "due_date": "2024-03-13",
    "assignee": "Sarah",
    "confidence": 0.95,
    "source_id": "email_456",
    "context": "Hi Sarah, can you please review the API documentation by Wednesday?"
  }
]
\`\`\`

### Example 2: Multiple Tasks with Varying Confidence

**Input:**
"Team meeting notes:
1. John will complete the security audit by Friday
2. Everyone should review the deployment checklist
3. We might want to consider adding more tests
4. Sarah mentioned she's working on the bug fixes"

**Output:**
\`\`\`json
[
  {
    "task_text": "Complete security audit",
    "due_date": "2024-03-15",
    "assignee": "John",
    "confidence": 0.95,
    "source_id": "meeting_789",
    "context": "John will complete the security audit by Friday"
  },
  {
    "task_text": "Review deployment checklist",
    "due_date": null,
    "assignee": null,
    "confidence": 0.80,
    "source_id": "meeting_789",
    "context": "Everyone should review the deployment checklist"
  },
  {
    "task_text": "Add more tests",
    "due_date": null,
    "assignee": null,
    "confidence": 0.60,
    "source_id": "meeting_789",
    "context": "We might want to consider adding more tests"
  }
]
\`\`\`

Note: "Sarah mentioned she's working on the bug fixes" is NOT extracted (already in progress, not a new task).

### Example 3: No Tasks

**Input:**
"Great job on the presentation! The client loved it. Looking forward to our next meeting."

**Output:**
\`\`\`json
[]
\`\`\`

## Important Notes:

1. **Today's Date:** Use the provided reference date to resolve relative dates
2. **Empty Array:** Return [] if no tasks found (not an error)
3. **JSON Only:** Return only valid JSON, no additional text
4. **Confidence Threshold:** Don't extract tasks with confidence < 0.5
5. **Ambiguity:** When in doubt, extract with lower confidence rather than skip

Remember: High confidence means the task is clear and actionable. Low confidence means human review is needed.`;

/**
 * Build the extraction prompt for a specific input
 */
export function buildTaskExtractionPrompt(input: TaskInput, referenceDate: Date): string {
  const { text, metadata } = input;
  
  const formattedDate = referenceDate.toISOString().split('T')[0];
  
  let prompt = `## Input Document

**Source Type:** ${metadata.source_type || 'unknown'}
**Source ID:** ${metadata.source_id}
**Date:** ${metadata.date || formattedDate}
`;

  if (metadata.sender) {
    prompt += `**Sender:** ${metadata.sender}`;
    if (metadata.sender_email) {
      prompt += ` (${metadata.sender_email})`;
    }
    prompt += '\n';
  }

  if (metadata.subject) {
    prompt += `**Subject:** ${metadata.subject}\n`;
  }

  prompt += `\n**Content:**\n${text}\n\n`;
  
  prompt += `## Instructions

Today's date (for reference): ${formattedDate}

Extract ALL actionable tasks from the content above. For each task:
1. Identify the core action (task_text)
2. Extract due date if explicitly mentioned (convert relative dates)
3. Extract assignee if explicitly mentioned
4. Assign confidence score (0.5-1.0)
5. Include brief context

Return a JSON array of tasks. If no tasks found, return empty array [].

Remember:
- Only extract tasks with confidence >= 0.5
- Use ISO date format (YYYY-MM-DD) for due_date
- Set null for missing due_date or assignee
- Include source_id: "${metadata.source_id}"

Output (JSON only):`;

  return prompt;
}

/**
 * Parse and validate LLM response
 */
export function parseTaskExtractionResponse(
  response: string,
  sourceId: string
): ExtractedTask[] {
  try {
    // Remove markdown code blocks if present
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const tasks = JSON.parse(cleanedResponse);

    if (!Array.isArray(tasks)) {
      throw new Error('Response is not an array');
    }

    // Validate and normalize each task
    return tasks
      .filter((task: any) => {
        // Filter out invalid tasks
        return (
          task.task_text &&
          typeof task.task_text === 'string' &&
          task.confidence >= 0.5 &&
          task.confidence <= 1.0
        );
      })
      .map((task: any) => ({
        task_text: task.task_text.trim().substring(0, 100),
        due_date: task.due_date || null,
        assignee: task.assignee || null,
        confidence: Math.min(1.0, Math.max(0.5, task.confidence)),
        source_id: sourceId,
        context: task.context?.trim().substring(0, 200) || null,
      }));
  } catch (error) {
    console.error('Failed to parse task extraction response:', error);
    console.error('Raw response:', response);
    return [];
  }
}

/**
 * Confidence rules
 */
export const CONFIDENCE_RULES = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  
  requiresHumanConfirmation: (confidence: number): boolean => {
    return confidence < 0.8;
  },
  
  autoAcceptThreshold: 0.9,
  
  getConfidenceLabel: (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  },
  
  getConfidenceDescription: (confidence: number): string => {
    if (confidence >= 0.9) {
      return 'High confidence - clear and explicit task';
    } else if (confidence >= 0.7) {
      return 'Medium confidence - task is clear but has some ambiguity';
    } else {
      return 'Low confidence - requires human review before accepting';
    }
  },
};
