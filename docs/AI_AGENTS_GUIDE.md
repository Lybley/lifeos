# AI Agents Guide - Summarizer & Email Drafting

## Overview

Two production-ready AI agents for content processing and email composition:

1. **Summarizer Agent**: Creates TL;DR (1-sentence) and bullet-point (3-bullet) summaries
2. **Email Drafting Agent**: Generates contextual email replies with tone control

---

## 📊 Summarizer Agent

### Purpose

Generate concise, accurate summaries in two formats:
- **TL;DR**: One sentence (15-25 words) capturing the essence
- **Bullets**: Three bullet points (10-20 words each) covering key information

### API Endpoint

**`POST /api/v1/agents/summarize`**

**Request:**
```json
{
  "text": "Long document or meeting notes...",
  "metadata": {
    "title": "Sprint Planning Meeting",
    "source_type": "meeting",
    "date": "2024-03-10",
    "participants": ["John", "Sarah"]
  }
}
```

**Response:**
```json
{
  "summary_id": "uuid",
  "tldr": "Team prioritized API redesign for Q2, allocating 3 developers with May 15 delivery target",
  "bullets": [
    "API redesign approved as Q2 priority with $200K budget and 3-developer team",
    "Phase 1 (authentication) due May 15, Phase 2 (data layer) due June 30",
    "Weekly stakeholder demos scheduled every Friday at 2 PM starting April 5"
  ],
  "metadata": {
    "original_length": 1847,
    "compression_ratio": 94.2,
    "generated_at": "2024-03-10T15:30:00Z"
  }
}
```

---

### Example 1: Meeting Summary

**Input:**
```
Sprint Planning Meeting - March 10, 2024

Attendees: John (Tech Lead), Sarah (PM), Mike (Designer), Lisa (Engineer)

Discussion:
John presented Q1 progress. We completed 85% of planned features, with API 
redesign being the major achievement. However, mobile app integration was 
delayed due to resource constraints.

Sarah proposed Q2 priorities:
1. Complete mobile app integration (high priority)
2. Implement real-time notifications
3. Add analytics dashboard

Decisions Made:
1. Hire one senior backend engineer by April 1
2. Prioritize mobile app integration for Q2
3. Allocate $50K budget for UX research
4. Weekly sprint demos every Friday at 2 PM
5. Target launch date: June 30, 2024
```

**Output:**
```json
{
  "tldr": "Team prioritized mobile app integration for Q2 with June 30 launch, hiring one engineer and allocating $50K for UX research",
  "bullets": [
    "Q1 achieved 85% completion with API redesign done but mobile integration delayed",
    "Q2 top priorities: mobile app integration, real-time notifications, and analytics dashboard",
    "Hiring senior backend engineer by April 1 with $50K UX budget and weekly Friday demos"
  ]
}
```

---

### Example 2: Technical Document

**Input:**
```
API Design Proposal: Real-Time Notification System

This document proposes a new real-time notification system to replace 
our current polling-based approach.

Current Limitations:
- Polling creates unnecessary server load (5000 req/min)
- Notifications delayed by up to 30 seconds
- Inefficient resource usage

Proposed Architecture:
1. WebSocket Gateway: Node.js service handling persistent connections
2. Redis Pub/Sub: Message broker for multi-server deployments
3. Notification Service: Handles business logic

Benefits:
- Instant delivery (< 100ms latency)
- 80% reduction in server requests
- Scalable to 100K concurrent connections

Implementation: 8 weeks, $120K total cost
Timeline: Start April 1, 2024
```

**Output:**
```json
{
  "tldr": "Proposed WebSocket-based notification system replaces polling, delivering 80% request reduction and instant delivery for $120K over 8 weeks",
  "bullets": [
    "Current polling system causes 5000 req/min load with 30-second delays and poor efficiency",
    "New WebSocket architecture with Redis pub/sub enables instant delivery and 100K concurrent connections",
    "Implementation requires $120K budget and 8 weeks starting April 1, 2024"
  ]
}
```

---

### Example 3: Email Thread

**Input:**
```
From: client@bigcorp.com
Subject: Budget Approval Status

Hi team,

I wanted to follow up on the budget proposal we submitted last week 
for the API integration project. 

The proposal included:
- $80K for development (3 engineers × 2 months)
- $30K for infrastructure (AWS, monitoring tools)
- $10K for testing and QA

Our finance team has reviewed it and I'm happy to share that it's 
been approved! We can proceed with the project.

However, they've asked that we provide monthly burn rate reports 
and stay within the approved budget. Can you confirm you can start 
by March 20th?

Let me know if you need anything else.

Thanks,
John
```

**Output:**
```json
{
  "tldr": "Budget proposal for $120K API integration project approved with requirement for monthly reports and March 20 start date",
  "bullets": [
    "Finance approved $120K budget split across $80K development, $30K infrastructure, and $10K testing",
    "Project can proceed with 3 engineers for 2 months as proposed",
    "Monthly burn rate reports required and confirmation needed for March 20 start date"
  ]
}
```

---

### Batch Summarization

**Endpoint:** `POST /api/v1/agents/summarize/batch`

**Request:**
```json
{
  "items": [
    {
      "text": "Document 1...",
      "metadata": {"title": "Doc 1"}
    },
    {
      "text": "Document 2...",
      "metadata": {"title": "Doc 2"}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "succeeded": 2,
  "summaries": [
    { "summary_id": "...", "tldr": "...", "bullets": [...] },
    { "summary_id": "...", "tldr": "...", "bullets": [...] }
  ]
}
```

---

## ✉️ Email Drafting Agent

### Purpose

Draft contextual email replies that:
- Match the user's voice and tone
- Address all points from the thread
- Propose clear next steps
- Adapt to specified tone (professional, casual, friendly, formal)

### API Endpoint

**`POST /api/v1/agents/draft`**

**Request:**
```json
{
  "thread": {
    "messages": [
      {
        "from": "client@company.com",
        "to": ["you@company.com"],
        "subject": "API Integration Timeline",
        "date": "2024-03-15T10:00:00Z",
        "body": "Can you provide an update on the API project timeline?"
      }
    ]
  },
  "tone": "professional",
  "max_length": "medium",
  "key_points": [
    "Authentication endpoints ready by March 30",
    "Full integration by May 15"
  ],
  "user_name": "Sarah Johnson",
  "user_email": "you@company.com"
}
```

**Response:**
```json
{
  "draft_id": "uuid",
  "subject": "Re: API Integration Timeline",
  "body": "Thank you for reaching out...\\n\\n[Full email body]",
  "tone_used": "professional",
  "metadata": {
    "word_count": 127,
    "estimated_reading_time": "1 minute",
    "generated_at": "2024-03-15T10:30:00Z"
  }
}
```

---

### Tone Examples

#### 1. Professional Tone

**Input Thread:**
```
From: client@bigcorp.com
Subject: API Integration Timeline

Hi,

We're planning our Q2 roadmap and need to understand the timeline 
for the API integration we discussed. Specifically:

1. When will the authentication endpoints be ready?
2. What is the estimated completion date for the full integration?
3. Will there be a staging environment for testing?

We need to coordinate with our mobile team, so any clarity would 
be helpful.

Best regards,
John Smith
CTO, BigCorp
```

**Draft Output:**
```
Subject: Re: API Integration Timeline

Thank you for reaching out regarding the API integration timeline.

I am pleased to provide the following updates:

1. Authentication Endpoints: Ready by March 30, 2024
2. Full Integration: Expected completion by May 15, 2024
3. Staging Environment: Available starting April 1, 2024

The staging environment will include full documentation and example 
implementations to facilitate your mobile team's integration work. 
I will provide API credentials and access instructions by April 1.

Please let me know if you would like to schedule a technical review 
call to discuss integration details, or if you have any additional 
questions.

Best regards
```

**Metadata:**
- Tone: professional
- Word count: 102
- Reading time: 30 seconds

---

#### 2. Casual Tone

**Input Thread:**
```
From: teammate@company.com
Subject: Code Review Request

Hey!

I just pushed the new feature branch (feature/user-dashboard). 
Can you take a look when you get a chance?

Main changes:
- New dashboard UI
- Performance improvements  
- Bug fixes from last sprint

Let me know if anything looks off. No rush, but would be great 
to get feedback before tomorrow's standup.

Thanks!
Mike
```

**Draft Output:**
```
Subject: Re: Code Review Request

Hey Mike!

Absolutely, I'll take a look at the dashboard branch this afternoon. 
I should have feedback ready before tomorrow's standup.

Quick question - are there any specific areas you want me to focus 
on, or should I do a general review? I'll pay extra attention to 
the performance improvements since that's been a focus lately.

I'll ping you on Slack once I'm done!

Thanks!
```

**Metadata:**
- Tone: casual
- Word count: 71
- Reading time: 30 seconds

---

#### 3. Formal Tone

**Input Thread:**
```
From: legal@enterprise.com
Subject: Contract Review Required

Good afternoon,

We require your review and signature on the attached Master Services 
Agreement for the consulting engagement discussed last week.

Please review sections 5 (Intellectual Property) and 8 (Liability) 
carefully and provide any feedback by March 20, 2024.

Regards,
Jennifer Moore
Legal Department
```

**Draft Output:**
```
Subject: Re: Contract Review Required

Dear Ms. Moore,

Thank you for forwarding the Master Services Agreement for review.

I have received the document and will conduct a thorough review of 
sections 5 (Intellectual Property) and 8 (Liability) as requested. 
I will provide my feedback and any necessary revisions by March 20, 2024.

Should I have any questions during my review, I will reach out to 
you directly. I anticipate completing the review by March 18, which 
will allow time for any discussion before the deadline.

Thank you for your assistance.

Sincerely
```

---

### Draft with Tone Alternatives

**Endpoint:** `POST /api/v1/agents/draft/with-alternatives`

Generates the primary draft plus alternatives in other tones.

**Request:**
```json
{
  "thread": { "messages": [...] },
  "tone": "professional"
}
```

**Response:**
```json
{
  "draft_id": "uuid",
  "subject": "Re: ...",
  "body": "[Professional version]",
  "tone_used": "professional",
  "metadata": {...},
  "alternatives": {
    "casual": "[Casual version of same reply]",
    "formal": "[Formal version of same reply]"
  }
}
```

---

## 🎯 Tone Guidelines

### Professional
- **Use when**: Business correspondence, client communication, formal updates
- **Characteristics**: Clear, direct, respectful, complete sentences
- **Avoid**: Contractions in formal contexts, slang, overly casual language
- **Example opening**: "Thank you for your email. I have reviewed..."

### Casual  
- **Use when**: Team communication, friendly colleagues, internal messages
- **Characteristics**: Conversational, natural contractions, relaxed structure
- **Maintain**: Respect and clarity
- **Example opening**: "Thanks for reaching out! I've looked over..."

### Friendly
- **Use when**: Known contacts, ongoing relationships, positive contexts
- **Characteristics**: Warm, personable, enthusiastic (when appropriate)
- **Balance**: Professional with personal warmth
- **Example opening**: "Great to hear from you! I'm excited about..."

### Formal
- **Use when**: Legal matters, executive communication, official documents
- **Characteristics**: Structured, precise, no contractions, formal greetings
- **Include**: Proper titles, formal closings
- **Example opening**: "Dear [Title] [Name], Thank you for your correspondence..."

---

## 📝 Usage Examples

### cURL Examples

**Summarize:**
```bash
curl -X POST http://localhost:8000/api/v1/agents/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your long document text here...",
    "metadata": {
      "title": "Q1 Report",
      "source_type": "document"
    }
  }'
```

**Draft Email:**
```bash
curl -X POST http://localhost:8000/api/v1/agents/draft \
  -H "Content-Type: application/json" \
  -d '{
    "thread": {
      "messages": [{
        "from": "client@company.com",
        "to": ["you@company.com"],
        "subject": "Question",
        "date": "2024-03-15T10:00:00Z",
        "body": "Can you provide an update?"
      }]
    },
    "tone": "professional",
    "key_points": ["Update point 1", "Update point 2"]
  }'
```

---

## ⚙️ Configuration

### Summarizer Config

```typescript
SUMMARIZER_CONFIG = {
  maxInputLength: 50000,  // Max characters
  temperature: 0.3,       // Low for consistency
  maxTokens: 300,         // TL;DR + 3 bullets
}
```

### Drafting Config

```typescript
DRAFTING_CONFIG = {
  temperature: 0.5,       // Moderate for natural writing
  maxTokens: 500,
  
  lengthLimits: {
    short: { min: 50, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 300 },
  }
}
```

---

## 🧪 Testing

### Run Examples

```bash
cd /app/backend
ts-node examples/agents-examples.ts
```

### Expected Behavior

**Summarizer:**
- TL;DR: Always 1 sentence, 15-25 words
- Bullets: Always exactly 3, each 10-20 words
- High compression (typically 90-95%)
- Accurate to source content

**Drafting:**
- Addresses all points from thread
- Maintains consistent tone
- Proposes clear next steps
- Appropriate length for context

---

## 🔧 Troubleshooting

### Summarizer Issues

**Problem:** Summary too vague
- **Solution**: Provide more context in metadata
- **Check**: Ensure source text has clear key points

**Problem:** Bullet count != 3
- **Solution**: Agent auto-corrects to 3 bullets
- **Check**: Validate response parsing logic

**Problem:** TL;DR too long
- **Solution**: System prompt enforces 15-25 words
- **Check**: LLM temperature (should be 0.3)

### Drafting Issues

**Problem:** Wrong tone in output
- **Solution**: Verify tone parameter matches desired output
- **Check**: System prompt includes tone examples

**Problem:** Missing context from thread
- **Solution**: Ensure all relevant messages included
- **Check**: Message order (chronological)

**Problem:** Too formal/casual
- **Solution**: Try "friendly" tone as middle ground
- **Check**: Thread context (adjust tone to match sender)

---

## 📚 Best Practices

### Summarization

1. **Provide Context**: Include metadata (title, type, date)
2. **Clean Input**: Remove formatting artifacts
3. **Right Length**: 100-5000 words optimal
4. **Batch When Possible**: More efficient for multiple items

### Email Drafting

1. **Complete Threads**: Include all relevant messages
2. **Key Points**: Specify important items to address
3. **Tone Matching**: Choose tone based on relationship
4. **Review Output**: Always review before sending
5. **User Context**: Provide user name/email for personalization

---

## 🚀 Advanced Usage

### Custom Tone Tuning

Modify system prompts in agent files for specific use cases:
- Add industry-specific language
- Adjust formality levels
- Include company style guides

### Integration Workflows

**Auto-summarize new documents:**
```typescript
async function onDocumentUpload(doc: Document) {
  const agent = createSummarizerAgent();
  const summary = await agent.summarize({
    text: doc.content,
    metadata: { title: doc.title }
  });
  
  // Store summary with document
  await db.documents.update(doc.id, { summary });
}
```

**Auto-draft replies:**
```typescript
async function suggestReply(thread: EmailThread) {
  const agent = createDraftingAgent();
  const draft = await agent.draftWithAlternatives({
    thread,
    tone: 'professional'
  });
  
  // Present to user with alternatives
  return draft;
}
```

---

## 📊 Performance Metrics

### Typical Latencies

| Operation | Time | Tokens |
|-----------|------|--------|
| Summarize (short) | 1-2s | 500-800 |
| Summarize (long) | 2-4s | 1000-2000 |
| Draft email | 2-3s | 800-1200 |
| Draft with alternatives | 5-8s | 2500-3500 |

### Optimization Tips

1. **Cache common summaries**: Same document = same summary
2. **Batch processing**: Use batch endpoints for multiple items
3. **Async operations**: Don't block user while generating
4. **Progressive delivery**: Show partial results if possible

---

## 📖 API Reference

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/agents/summarize` | POST | Generate summary |
| `/api/v1/agents/summarize/batch` | POST | Batch summaries |
| `/api/v1/agents/draft` | POST | Draft email reply |
| `/api/v1/agents/draft/with-alternatives` | POST | Draft with tone options |
| `/api/v1/agents/health` | GET | Health check |

Full API documentation in implementation files.

---

## License

MIT
