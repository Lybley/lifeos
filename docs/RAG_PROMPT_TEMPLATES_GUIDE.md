# RAG Prompt Templates Guide

## Overview

This guide covers the **specialized prompt templates** available in the LifeOS RAG system. Each template is optimized for specific use cases with carefully tuned parameters for maximum quality and accuracy.

---

## Template Categories

| Template | Use Case | Output Length | Temperature | Max Tokens |
|----------|----------|---------------|-------------|------------|
| **Factual Q&A** | Direct questions with short answers | 1-3 sentences | 0.1 (very low) | 150 |
| **Summarization (Short)** | Quick overview of content | 3-5 sentences | 0.2 (low) | 200 |
| **Summarization (Long)** | Detailed comprehensive summary | 2-3 paragraphs | 0.3 (moderate) | 600 |
| **Task Extraction** | Action items from emails/meetings | Structured list | 0.1 (very low) | 800 |

---

## Template 1: Factual Q&A (Short Answer)

### Purpose
Provide concise, factual answers to direct questions.

### Characteristics
- **Very short**: 1-3 sentences maximum
- **Highly precise**: Exact facts with citations
- **Low temperature (0.1)**: Maximum consistency
- **Direct**: No preamble or elaboration

### Best For
- "What is [person]'s email?"
- "When is the next [event]?"
- "Who attended [meeting]?"
- "What is the deadline for [project]?"

### Example

**Input Query:**
```
"What is Sarah's email address?"
```

**Source:**
```
[src_1] Team Members:
- John Doe (john@company.com)
- Sarah Smith (sarah.smith@company.com)
- Mike Johnson (mike@company.com)
```

**Generated Prompt:**
```
## Available Sources:

[src_1] Team Members:
- John Doe (john@company.com)
- Sarah Smith (sarah.smith@company.com)
- Mike Johnson (mike@company.com)

---

## Question:
What is Sarah's email address?

## Instructions:
Provide a SHORT, FACTUAL answer (1-3 sentences) with [source_id] citations. 
Only use information from the sources above. If not found, say "I don't have this information."
```

**Expected Response:**
```
Sarah Smith's email address is sarah.smith@company.com [src_1].
```

### Configuration
```typescript
{
  maxTokens: 150,
  temperature: 0.1
}
```

---

## Template 2: Summarization

### Purpose
Create accurate summaries at two different detail levels.

### Two Variants

#### A. Short Summary (3-5 sentences)

**Characteristics:**
- **Concise**: Main points only
- **Structured**: Intro → Key Points → Conclusion
- **Low temperature (0.2)**: Factual consistency
- **Selective**: Most important information

**Best For:**
- Quick meeting recaps
- Email thread summaries
- Status updates
- Brief overviews

**Example:**

**Input Query:**
```
"Summarize the key points from the sprint planning meeting"
```

**Source:**
```
[src_1] Sprint Planning Meeting Notes - March 1, 2024

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
```

**Generated Prompt:**
```
## Source Documents:

### [src_1] Sprint Planning Meeting Notes - March 1, 2024
[Full content as above]

---

## Task:
Summarize the key points from the sprint planning meeting

## Instructions:
Create a SHORT summary (3-5 sentences) covering the main points. 
Focus on key facts, decisions, and outcomes. 
Cite [source_id] after EVERY fact. 
Only use information from the sources above. Do not add external knowledge.
```

**Expected Response:**
```
The Sprint 23 planning meeting was held on March 1, 2024, with the engineering team [src_1]. 
The goal is to complete API redesign phase 1, estimated at 13 story points over 2 weeks [src_1]. 
Key decisions included prioritizing Auth, Users, and Projects endpoints [src_1], implementing 
daily standups at 10 AM [src_1], and requiring code reviews within 24 hours [src_1].
```

**Configuration:**
```typescript
{
  maxTokens: 200,
  temperature: 0.2
}
```

#### B. Long Summary (2-3 paragraphs)

**Characteristics:**
- **Comprehensive**: All important details
- **Well-organized**: Thematic or chronological structure
- **Moderate temperature (0.3)**: Natural flow while maintaining accuracy
- **Detailed**: Context, specifics, and outcomes

**Best For:**
- Detailed meeting notes
- Document summaries
- Project status reports
- Multi-source synthesis

**Expected Response (Long):**
```
The Sprint 23 planning meeting took place on March 1, 2024, with the engineering 
team consisting of 8 members [src_1]. The primary objective was to plan the next 
sprint focused on completing the first phase of the API redesign project [src_1]. 
The team estimated the work at 13 story points, which aligns with their velocity 
of 40 points per sprint, indicating a 2-week timeline [src_1].

Three key decisions were made during the meeting: First, the team prioritized three 
main API endpoints for this sprint - Authentication, Users, and Projects [src_1]. 
Second, to improve communication, daily standup meetings were scheduled at 10 AM [src_1]. 
Third, a code review policy was established requiring all reviews to be completed 
within 24 hours of submission [src_1].

These decisions provide clear direction for Sprint 23, with well-defined technical 
priorities, improved team communication through daily standups, and quality assurance 
through the rapid code review process [src_1].
```

**Configuration:**
```typescript
{
  maxTokens: 600,
  temperature: 0.3
}
```

---

## Template 3: Task Extraction

### Purpose
Extract actionable tasks from emails, meeting notes, and communications.

### Characteristics
- **Structured output**: Consistent task format
- **Comprehensive**: Captures ALL tasks
- **Very low temperature (0.1)**: Precision in extraction
- **Metadata-rich**: Owner, due date, priority, status

### Task Format
```
**Task N:**
- Task: [Clear, actionable description]
- Owner: [Person responsible or "Not specified"]
- Due: [Deadline or "Not specified"]
- Priority: [High/Medium/Low or "Not specified"]
- Status: [Pending/In Progress/Completed]
- Source: [source_id]
```

### What Qualifies as a Task

✅ **Valid Tasks:**
- "Please [action]"
- "Can you [action]"
- "We need to [action]"
- "[Person] will [action]"
- "Action item: [action]"
- "Follow up on [topic]"
- "Next steps: [action]"

❌ **Not Tasks:**
- General statements without action
- Questions without commitment
- Past completed actions (unless follow-up mentioned)
- Hypothetical discussions

### Example

**Input Query:**
```
"Extract all action items from this email thread"
```

**Source:**
```
[src_1] Email: Project Update

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
```

**Generated Prompt:**
```
## Source Content:

### [src_1] Email: Project Update
Type: email
Date: 2024-03-05

Content:
[Full email content as above]

---

## Task:
Extract all action items from this email thread

## Instructions:
Extract ALL actionable tasks from the sources above. 
For each task, identify: task description, owner (if mentioned), due date (if mentioned), 
and priority (if mentioned). 
Format as structured task list. 
Cite [source_id] for EVERY task. 
Only extract tasks explicitly mentioned or clearly implied in the sources. Do not invent tasks.
```

**Expected Response:**
```
## Extracted Tasks:

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
- Pending: 5
```

**Configuration:**
```typescript
{
  maxTokens: 800,
  temperature: 0.1
}
```

---

## Core Principles (All Templates)

### 1. Source-First Rule

**Critical instruction in every template:**

> "If your answer depends on facts, only use the facts present in the provided sources and quote them directly."

**Enforces:**
- No external knowledge
- No assumptions
- No inferences beyond explicit statements
- Acknowledgment of missing information

### 2. Citation Requirements

**Mandatory for all templates:**

```
[source_id] after EVERY fact
Multiple sources: [source_1][source_2]
Even paraphrased info needs citations
No citation = potential hallucination
```

**Examples:**
- ✅ "The meeting is on March 15th [src_1]."
- ❌ "The meeting is on March 15th."

### 3. Honesty About Limitations

**All templates include:**
- "If not found, say 'I don't have this information'"
- "Only use information from the sources"
- "Acknowledge gaps in sources"

---

## Usage in API

### Specify Template Type

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "query": "What is Sarah'\''s email?",
    "prompt_type": "factual-qa"
  }'
```

### Available Types

```typescript
type PromptType = 
  | 'factual-qa'           // Short factual answers
  | 'summarization-short'  // 3-5 sentence summary
  | 'summarization-long'   // 2-3 paragraph summary
  | 'task-extraction';     // Extract action items
```

### Auto-Detection (Future Feature)

The system can automatically detect the appropriate template based on query patterns:

```typescript
// Query patterns → Template
"What is..." → factual-qa
"When is..." → factual-qa
"Summarize..." → summarization-short
"Give me a detailed summary..." → summarization-long
"Extract tasks..." → task-extraction
"What are the action items..." → task-extraction
```

---

## Temperature & Token Guidance

### Why Different Temperatures?

| Temperature | Use Case | Reasoning |
|-------------|----------|-----------|
| **0.1** | Factual Q&A, Task Extraction | Maximum consistency, no creativity needed |
| **0.2** | Short Summarization | Factual but allowing minor paraphrasing |
| **0.3** | Long Summarization | Natural flow while maintaining accuracy |

### Why Different Max Tokens?

| Max Tokens | Template | Reasoning |
|------------|----------|-----------|
| **150** | Factual Q&A | 1-3 sentences, force brevity |
| **200** | Short Summary | 3-5 sentences, constrain length |
| **600** | Long Summary | 2-3 paragraphs, detailed coverage |
| **800** | Task Extraction | Multiple tasks with metadata |

---

## Best Practices

### 1. Choose the Right Template

**Factual Q&A when:**
- You need a specific fact
- Answer should be 1-3 sentences
- No analysis needed

**Short Summary when:**
- Quick overview needed
- Email thread recap
- Status update format

**Long Summary when:**
- Detailed understanding required
- Multiple sources to synthesize
- Comprehensive coverage needed

**Task Extraction when:**
- Processing emails or meeting notes
- Need structured action items
- Want to track ownership and deadlines

### 2. Optimize Query Phrasing

**For Factual Q&A:**
- ✅ "What is John's phone number?"
- ❌ "Tell me about John's contact information"

**For Summarization:**
- ✅ "Summarize the Q1 budget meeting"
- ❌ "What happened in the meeting?"

**For Task Extraction:**
- ✅ "Extract all action items from this email"
- ❌ "What do we need to do?"

### 3. Validate Results

**Check for:**
- ✅ Every fact has [source_id]
- ✅ No information not in sources
- ✅ Appropriate length for template
- ✅ Structured format (for task extraction)

---

## Testing Templates

### Test Script

```bash
# Test Factual Q&A
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "query": "What is the project deadline?",
    "prompt_type": "factual-qa",
    "top_k": 3
  }'

# Test Short Summarization
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "query": "Summarize the sprint planning notes",
    "prompt_type": "summarization-short",
    "top_k": 5
  }'

# Test Task Extraction
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "query": "Extract action items from the team email",
    "prompt_type": "task-extraction",
    "top_k": 3
  }'
```

---

## Common Issues & Solutions

### Issue: Response Too Long/Short

**Solution:** Adjust `maxTokens` in template config
```typescript
FACTUAL_QA_CONFIG.maxTokens = 200; // Increase if needed
```

### Issue: Not Enough Citations

**Solution:** Strengthen citation instructions in system prompt
```typescript
// Add to system prompt:
"CRITICAL: Every single fact must have [source_id] immediately after it."
```

### Issue: Hallucinations Detected

**Solution:** Lower temperature further
```typescript
temperature: 0.05 // Even more deterministic
```

### Issue: Tasks Missing from Extraction

**Solution:** Check if tasks are explicit in source
- Review what qualifies as a task
- Ensure source content is clear
- Consider expanding source context

---

## Future Enhancements

- [ ] **Auto-template detection** based on query
- [ ] **Hybrid templates** for complex queries
- [ ] **Custom templates** via API
- [ ] **Template fine-tuning** based on feedback
- [ ] **Multi-language templates**
- [ ] **Domain-specific templates** (legal, medical, etc.)

---

## References

- Main RAG API Guide: `/app/docs/RAG_API_GUIDE.md`
- Implementation: `/app/backend/src/services/rag/specializedPromptTemplates.ts`
- Examples: `/app/backend/examples/`
