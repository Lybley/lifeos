/**
 * Specialized RAG Prompt Templates
 * Optimized for specific use cases: Q&A, Summarization, Task Extraction
 */

import { SourceContext } from './promptTemplates';

// ============================================================================
// TEMPLATE 1: FACTUAL Q&A (Short Answer)
// ============================================================================

export const FACTUAL_QA_SYSTEM_PROMPT = `You are LifeOS, a precise AI assistant that provides factual answers from the user's Personal Memory Graph.

## Core Instructions:

### Source-First Rule (CRITICAL):
**If your answer depends on facts, only use the facts present in the provided sources and quote them directly.**
- Never use general knowledge or assumptions
- Never infer information not explicitly stated
- If sources don't contain the answer, say "I don't have this information"

### Citation Requirements (MANDATORY):
- Place [source_id] immediately after EVERY fact
- Multiple sources for one fact: [source_1][source_2]
- Even paraphrased information needs citations
- No citation = hallucination

### Answer Format:
- **Be concise**: 1-3 sentences maximum
- **Be direct**: Start with the answer immediately
- **Be precise**: Use exact numbers, dates, and names from sources
- **Quote when possible**: Use "quotation marks" for direct quotes

### Quality Checklist:
✓ Every fact has [source_id]
✓ Only information from provided sources
✓ Short and to the point
✓ Direct answer to the question

## Examples:

**Question:** "What is John's email?"
**Good:** "John's email is john.doe@company.com [source_1]."
**Bad:** "John's email is john.doe@company.com." (missing citation)
**Bad:** "John works at Company Inc and his email is john.doe@company.com." (too verbose)

**Question:** "When is the next team meeting?"
**Good:** "The next team meeting is on March 15th at 2:00 PM [source_1]."
**Bad:** "The team meeting is soon." (vague, no citation)

Remember: Concise, factual, cited. If uncertain, say "I don't have this information."`;

export interface FactualQAConfig {
  maxTokens: number;
  temperature: number;
}

export const FACTUAL_QA_CONFIG: FactualQAConfig = {
  maxTokens: 150,  // Short answers only
  temperature: 0.1, // Very low for factual consistency
};

export function buildFactualQAPrompt(
  query: string,
  sources: SourceContext[]
): string {
  let prompt = '## Available Sources:\n\n';

  sources.forEach((source) => {
    prompt += `[${source.source_id}] ${source.content}\n\n`;
  });

  prompt += `---\n\n`;
  prompt += `## Question:\n${query}\n\n`;
  prompt += `## Instructions:\n`;
  prompt += `Provide a SHORT, FACTUAL answer (1-3 sentences) with [source_id] citations. `;
  prompt += `Only use information from the sources above. If not found, say "I don't have this information."`;

  return prompt;
}

// ============================================================================
// TEMPLATE 2: SUMMARIZATION (Two Lengths)
// ============================================================================

export const SUMMARIZATION_SYSTEM_PROMPT = `You are LifeOS, an AI assistant that creates accurate summaries from the user's Personal Memory Graph.

## Core Instructions:

### Source-First Rule (CRITICAL):
**Only summarize information that is explicitly present in the provided sources.**
- Never add information not in the sources
- Never use general knowledge to fill gaps
- Never make assumptions about missing information
- If sources are incomplete, acknowledge limitations

### Citation Requirements (MANDATORY):
- Cite [source_id] after each summarized point
- Multiple sources for one point: [source_1][source_2]
- Group related information with citations
- Every paragraph should have at least one citation

### Summary Structure:
**For SHORT summaries (3-5 sentences):**
- Opening: Main topic/purpose in one sentence
- Body: 2-3 key points with citations
- Closing: Brief outcome or next steps (if mentioned)

**For LONG summaries (2-3 paragraphs):**
- Introduction: Context and overview with citations
- Details: Organized by theme or chronology with citations
- Conclusion: Outcomes, decisions, or action items with citations

### Quality Guidelines:
✓ Preserve important details (dates, numbers, names)
✓ Use direct quotes for key statements
✓ Maintain chronological order when relevant
✓ Cite every fact
✓ Acknowledge gaps: "Not mentioned in sources"

## Examples:

**SHORT Summary:**
"The Q1 budget meeting was held on March 1st [source_1] with 15 attendees [source_1]. Key decisions included a 20% increase in marketing spend [source_2] and approval of three new hires [source_2]. The team committed to weekly progress reviews [source_3]."

**LONG Summary:**
"The Q1 budget planning meeting took place on March 1st, 2024, with department heads and senior leadership [source_1]. The primary focus was allocating resources for the upcoming quarter's strategic initiatives [source_1].

Three major decisions were finalized: First, the marketing budget was increased by 20% to support the new product launch [source_2]. Second, the engineering team received approval to hire three senior developers to accelerate the API redesign project [source_2]. Third, the customer success team proposed a new onboarding process, which was approved pending a detailed implementation plan [source_3].

Action items included: weekly budget reviews starting March 8th [source_3], a hiring timeline to be submitted by March 15th [source_2], and a customer success implementation plan due by March 20th [source_3]."

Remember: Accurate, comprehensive, organized, and fully cited.`;

export interface SummarizationConfig {
  length: 'short' | 'long';
  maxTokens: number;
  temperature: number;
}

export const SUMMARIZATION_CONFIGS: Record<'short' | 'long', SummarizationConfig> = {
  short: {
    length: 'short',
    maxTokens: 200,    // 3-5 sentences
    temperature: 0.2,  // Low for accuracy
  },
  long: {
    length: 'long',
    maxTokens: 600,    // 2-3 paragraphs
    temperature: 0.3,  // Slightly higher for natural flow
  },
};

export function buildSummarizationPrompt(
  query: string,
  sources: SourceContext[],
  length: 'short' | 'long'
): string {
  let prompt = '## Source Documents:\n\n';

  sources.forEach((source) => {
    prompt += `### [${source.source_id}] ${source.title}\n`;
    prompt += `${source.content}\n\n`;
  });

  prompt += `---\n\n`;
  prompt += `## Task:\n${query}\n\n`;
  prompt += `## Instructions:\n`;

  if (length === 'short') {
    prompt += `Create a SHORT summary (3-5 sentences) covering the main points. `;
    prompt += `Focus on key facts, decisions, and outcomes. `;
  } else {
    prompt += `Create a COMPREHENSIVE summary (2-3 paragraphs) with detailed coverage. `;
    prompt += `Organize by themes or chronology. Include context, details, and outcomes. `;
  }

  prompt += `Cite [source_id] after EVERY fact. `;
  prompt += `Only use information from the sources above. Do not add external knowledge.`;

  return prompt;
}

// ============================================================================
// TEMPLATE 3: TASK EXTRACTION
// ============================================================================

export const TASK_EXTRACTION_SYSTEM_PROMPT = `You are LifeOS, an AI assistant that extracts actionable tasks from the user's communications and meeting notes.

## Core Instructions:

### Source-First Rule (CRITICAL):
**Only extract tasks that are explicitly stated or clearly implied in the provided sources.**
- Never invent tasks not mentioned
- Never interpret vague statements as tasks without clear context
- If something might be a task but isn't clear, note it as "potential task"
- Distinguish between completed and pending tasks

### Citation Requirements (MANDATORY):
- Cite [source_id] after EVERY task
- If one task appears in multiple sources: [source_1][source_2]
- Include citation even for task metadata (owner, due date)

### Task Extraction Rules:

**What qualifies as a task:**
✓ "Please [action]" or "Can you [action]"
✓ "We need to [action]"
✓ "[Person] will [action]"
✓ "Action item: [action]"
✓ "Follow up on [topic]"
✓ "Next steps: [action]"

**What does NOT qualify:**
✗ General statements without action
✗ Questions without follow-up commitment
✗ Past completed actions (unless follow-up needed)
✗ Hypothetical discussions

### Task Format:

For each task, provide:
1. **Task**: Clear, actionable description
2. **Owner**: Person responsible (if mentioned)
3. **Due Date**: Deadline or timeframe (if mentioned)
4. **Priority**: High/Medium/Low (only if explicitly stated)
5. **Status**: Pending/In Progress/Completed (based on context)
6. **Source**: Citation [source_id]

### Output Structure:

```
## Extracted Tasks:

**Task 1:**
- Task: [Clear action item]
- Owner: [Name] (or "Not specified")
- Due: [Date] (or "Not specified")
- Priority: [Level] (or "Not specified")
- Status: Pending
- Source: [source_1]

**Task 2:**
[repeat format]

## Summary:
- Total tasks: X
- High priority: Y
- Pending: Z
```

### Quality Checklist:
✓ Every task is actionable (verb-based)
✓ Every task has [source_id]
✓ Owners extracted from source (not guessed)
✓ Dates extracted exactly as stated
✓ Only tasks from sources, no additions

## Examples:

**Email:** "Hi team, please review the Q1 report by Friday. Sarah, can you schedule a follow-up meeting? Also, we need to finalize the budget proposal."

**Extraction:**
```
**Task 1:**
- Task: Review the Q1 report
- Owner: Team (all)
- Due: Friday
- Priority: Not specified
- Status: Pending
- Source: [source_1]

**Task 2:**
- Task: Schedule follow-up meeting
- Owner: Sarah
- Due: Not specified
- Priority: Not specified
- Status: Pending
- Source: [source_1]

**Task 3:**
- Task: Finalize budget proposal
- Owner: Not specified
- Due: Not specified
- Priority: Not specified
- Status: Pending
- Source: [source_1]
```

Remember: Precise extraction, full citations, no invented tasks.`;

export interface TaskExtractionConfig {
  maxTokens: number;
  temperature: number;
}

export const TASK_EXTRACTION_CONFIG: TaskExtractionConfig = {
  maxTokens: 800,   // Can have many tasks
  temperature: 0.1, // Very low - extraction must be precise
};

export function buildTaskExtractionPrompt(
  query: string,
  sources: SourceContext[]
): string {
  let prompt = '## Source Content:\n\n';

  sources.forEach((source) => {
    prompt += `### [${source.source_id}] ${source.title}\n`;
    if (source.metadata.source_type) {
      prompt += `Type: ${source.metadata.source_type}\n`;
    }
    if (source.metadata.created_at) {
      prompt += `Date: ${source.metadata.created_at}\n`;
    }
    prompt += `\nContent:\n${source.content}\n\n`;
    prompt += `---\n\n`;
  });

  prompt += `## Task:\n${query}\n\n`;
  prompt += `## Instructions:\n`;
  prompt += `Extract ALL actionable tasks from the sources above. `;
  prompt += `For each task, identify: task description, owner (if mentioned), due date (if mentioned), and priority (if mentioned). `;
  prompt += `Format as structured task list. `;
  prompt += `Cite [source_id] for EVERY task. `;
  prompt += `Only extract tasks explicitly mentioned or clearly implied in the sources. Do not invent tasks.`;

  return prompt;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

export const PROMPT_EXAMPLES = {
  factualQA: {
    input: {
      query: "What is Sarah's email address?",
      sources: [
        {
          source_id: 'src_1',
          title: 'Team Contact List',
          content: 'Team Members:\\n- John Doe (john@company.com)\\n- Sarah Smith (sarah.smith@company.com)\\n- Mike Johnson (mike@company.com)',
          score: 0.92,
          metadata: { source_type: 'document' },
        },
      ],
    },
    finalPrompt: `## Available Sources:

[src_1] Team Members:
- John Doe (john@company.com)
- Sarah Smith (sarah.smith@company.com)
- Mike Johnson (mike@company.com)

---

## Question:
What is Sarah's email address?

## Instructions:
Provide a SHORT, FACTUAL answer (1-3 sentences) with [source_id] citations. Only use information from the sources above. If not found, say "I don't have this information."`,
    expectedResponse: 'Sarah Smith\'s email address is sarah.smith@company.com [src_1].',
  },

  summarizationShort: {
    input: {
      query: 'Summarize the key points from the sprint planning meeting',
      sources: [
        {
          source_id: 'src_1',
          title: 'Sprint Planning Meeting Notes - March 1, 2024',
          content: 'Sprint Planning Meeting\\nDate: March 1, 2024\\nAttendees: Engineering team (8 people)\\n\\nDiscussed:\\n- Sprint 23 goals: Complete API redesign phase 1\\n- Estimated 13 story points\\n- Team velocity: 40 points/sprint\\n- Timeline: 2 weeks\\n\\nDecisions:\\n- API endpoints to prioritize: Auth, Users, Projects\\n- Daily standups at 10 AM\\n- Code review deadline: within 24 hours',
          score: 0.95,
          metadata: { source_type: 'meeting_notes', created_at: '2024-03-01' },
        },
      ],
    },
    finalPrompt: `## Source Documents:

### [src_1] Sprint Planning Meeting Notes - March 1, 2024
Sprint Planning Meeting
Date: March 1, 2024
Attendees: Engineering team (8 people)

Discussed:
- Sprint 23 goals: Complete API redesign phase 1
- Estimated 13 story points
- Team velocity: 40 points/sprint
- Timeline: 2 weeks

Decisions:
- API endpoints to prioritize: Auth, Users, Projects
- Daily standups at 10 AM
- Code review deadline: within 24 hours

---

## Task:
Summarize the key points from the sprint planning meeting

## Instructions:
Create a SHORT summary (3-5 sentences) covering the main points. Focus on key facts, decisions, and outcomes. Cite [source_id] after EVERY fact. Only use information from the sources above. Do not add external knowledge.`,
    expectedResponse: 'The Sprint 23 planning meeting was held on March 1, 2024, with the engineering team [src_1]. The goal is to complete API redesign phase 1, estimated at 13 story points over 2 weeks [src_1]. Key decisions included prioritizing Auth, Users, and Projects endpoints [src_1], implementing daily standups at 10 AM [src_1], and requiring code reviews within 24 hours [src_1].',
  },

  taskExtraction: {
    input: {
      query: 'Extract all action items from this email thread',
      sources: [
        {
          source_id: 'src_1',
          title: 'Email: Project Update',
          content: 'From: manager@company.com\\nTo: team@company.com\\nSubject: Project Update & Next Steps\\nDate: March 5, 2024\\n\\nHi Team,\\n\\nGreat progress on the API project! For next week:\\n\\n1. Sarah, please finalize the API documentation by Wednesday\\n2. John needs to complete the security audit by Friday\\n3. Everyone should review the deployment checklist\\n4. Let\'s schedule a demo for stakeholders - Mike, can you coordinate?\\n\\nAlso, we need to update the project timeline in Jira.\\n\\nThanks!',
          score: 0.96,
          metadata: { source_type: 'email', created_at: '2024-03-05' },
        },
      ],
    },
    finalPrompt: `## Source Content:

### [src_1] Email: Project Update
Type: email
Date: 2024-03-05

Content:
From: manager@company.com
To: team@company.com
Subject: Project Update & Next Steps
Date: March 5, 2024

Hi Team,

Great progress on the API project! For next week:

1. Sarah, please finalize the API documentation by Wednesday
2. John needs to complete the security audit by Friday
3. Everyone should review the deployment checklist
4. Let's schedule a demo for stakeholders - Mike, can you coordinate?

Also, we need to update the project timeline in Jira.

Thanks!

---

## Task:
Extract all action items from this email thread

## Instructions:
Extract ALL actionable tasks from the sources above. For each task, identify: task description, owner (if mentioned), due date (if mentioned), and priority (if mentioned). Format as structured task list. Cite [source_id] for EVERY task. Only extract tasks explicitly mentioned or clearly implied in the sources. Do not invent tasks.`,
    expectedResponse: `## Extracted Tasks:

**Task 1:**
- Task: Finalize API documentation
- Owner: Sarah
- Due: Wednesday
- Priority: Not specified
- Status: Pending
- Source: [src_1]

**Task 2:**
- Task: Complete security audit
- Owner: John
- Due: Friday
- Priority: Not specified
- Status: Pending
- Source: [src_1]

**Task 3:**
- Task: Review deployment checklist
- Owner: Team (everyone)
- Due: Not specified
- Priority: Not specified
- Status: Pending
- Source: [src_1]

**Task 4:**
- Task: Schedule demo for stakeholders
- Owner: Mike
- Due: Not specified
- Priority: Not specified
- Status: Pending
- Source: [src_1]

**Task 5:**
- Task: Update project timeline in Jira
- Owner: Not specified
- Due: Not specified
- Priority: Not specified
- Status: Pending
- Source: [src_1]

## Summary:
- Total tasks: 5
- High priority: 0 (none specified)
- Pending: 5`,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get appropriate config based on prompt type
 */
export function getPromptConfig(
  type: 'factual-qa' | 'summarization-short' | 'summarization-long' | 'task-extraction'
): { maxTokens: number; temperature: number } {
  switch (type) {
    case 'factual-qa':
      return FACTUAL_QA_CONFIG;
    case 'summarization-short':
      return SUMMARIZATION_CONFIGS.short;
    case 'summarization-long':
      return SUMMARIZATION_CONFIGS.long;
    case 'task-extraction':
      return TASK_EXTRACTION_CONFIG;
    default:
      return { maxTokens: 500, temperature: 0.3 };
  }
}

/**
 * Get system prompt based on type
 */
export function getSystemPrompt(
  type: 'factual-qa' | 'summarization' | 'task-extraction'
): string {
  switch (type) {
    case 'factual-qa':
      return FACTUAL_QA_SYSTEM_PROMPT;
    case 'summarization':
      return SUMMARIZATION_SYSTEM_PROMPT;
    case 'task-extraction':
      return TASK_EXTRACTION_SYSTEM_PROMPT;
    default:
      return FACTUAL_QA_SYSTEM_PROMPT;
  }
}

/**
 * Build prompt based on type
 */
export function buildSpecializedPrompt(
  type: 'factual-qa' | 'summarization-short' | 'summarization-long' | 'task-extraction',
  query: string,
  sources: SourceContext[]
): string {
  switch (type) {
    case 'factual-qa':
      return buildFactualQAPrompt(query, sources);
    case 'summarization-short':
      return buildSummarizationPrompt(query, sources, 'short');
    case 'summarization-long':
      return buildSummarizationPrompt(query, sources, 'long');
    case 'task-extraction':
      return buildTaskExtractionPrompt(query, sources);
    default:
      return buildFactualQAPrompt(query, sources);
  }
}
