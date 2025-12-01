/**
 * Agent Examples - Summarizer and Drafting
 */

import axios from 'axios';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// ============================================================================
// SUMMARIZER EXAMPLES
// ============================================================================

async function exampleSummarizeMeeting() {
  console.log('\n=== Example 1: Summarize Meeting Notes ===\n');

  const input = {
    text: `Sprint Planning Meeting - March 10, 2024

Attendees: John (Tech Lead), Sarah (PM), Mike (Designer), Lisa (Engineer)

Agenda:
1. Review Q1 progress
2. Plan Q2 priorities
3. Resource allocation

Discussion:

John presented the Q1 progress. We completed 85% of planned features, with API redesign being the major achievement. However, the mobile app integration was delayed due to resource constraints.

Sarah proposed Q2 priorities:
1. Complete mobile app integration (high priority)
2. Implement real-time notifications
3. Add analytics dashboard
4. Performance optimization

The team discussed resource needs. Lisa mentioned needing one additional backend engineer. Mike noted design resources are sufficient but may need UX research support.

Decisions Made:
1. Hire one senior backend engineer by April 1
2. Prioritize mobile app integration for Q2
3. Allocate $50K budget for UX research
4. Weekly sprint demos every Friday at 2 PM
5. Target launch date: June 30, 2024

Action Items:
- John: Post job description by March 15
- Sarah: Create detailed Q2 roadmap by March 20
- Mike: Schedule UX research kickoff
- Lisa: Set up CI/CD pipeline for mobile builds

Next meeting: March 24, 2024`,
    metadata: {
      title: 'Sprint Planning Meeting',
      source_type: 'meeting',
      date: '2024-03-10',
      participants: ['John', 'Sarah', 'Mike', 'Lisa'],
    },
  };

  try {
    const response = await axios.post(`${API_BASE}/api/v1/agents/summarize`, input);
    
    console.log('TL;DR:', response.data.tldr);
    console.log('\nKey Points:');
    response.data.bullets.forEach((bullet: string, i: number) => {
      console.log(`${i + 1}. ${bullet}`);
    });
    console.log('\nMetadata:');
    console.log(`- Original: ${response.data.metadata.original_length} chars`);
    console.log(`- Compression: ${response.data.metadata.compression_ratio}%`);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function exampleSummarizeDocument() {
  console.log('\n=== Example 2: Summarize Technical Document ===\n');

  const input = {
    text: `API Design Proposal: Real-Time Notification System

Executive Summary:
This document proposes a new real-time notification system to replace our current polling-based approach. The system will use WebSocket connections and Redis pub/sub to deliver instant notifications to web and mobile clients.

Current Limitations:
- Polling creates unnecessary server load (5000 req/min)
- Notifications delayed by up to 30 seconds
- Inefficient resource usage
- Poor mobile battery performance

Proposed Architecture:
1. WebSocket Gateway: Node.js service handling persistent connections
2. Redis Pub/Sub: Message broker for multi-server deployments
3. Notification Service: Handles business logic and persistence
4. Client SDKs: JavaScript and Swift libraries

Benefits:
- Instant delivery (< 100ms latency)
- 80% reduction in server requests
- Better mobile battery life
- Scalable to 100K concurrent connections

Implementation Plan:
- Phase 1 (Weeks 1-2): WebSocket gateway setup
- Phase 2 (Weeks 3-4): Integration with existing services
- Phase 3 (Weeks 5-6): Client SDK development
- Phase 4 (Weeks 7-8): Testing and rollout

Cost: $120K total ($80K engineering, $30K infrastructure, $10K testing)
Timeline: 8 weeks
Risk: Medium (new technology stack)

Recommendation: Proceed with implementation starting April 1, 2024`,
    metadata: {
      title: 'API Design Proposal',
      source_type: 'document',
      date: '2024-03-15',
    },
  };

  try {
    const response = await axios.post(`${API_BASE}/api/v1/agents/summarize`, input);
    
    console.log('TL;DR:', response.data.tldr);
    console.log('\nKey Points:');
    response.data.bullets.forEach((bullet: string, i: number) => {
      console.log(`${i + 1}. ${bullet}`);
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// DRAFTING EXAMPLES
// ============================================================================

async function exampleDraftProfessional() {
  console.log('\n=== Example 3: Draft Professional Email Reply ===\n');

  const input = {
    thread: {
      messages: [
        {
          from: 'client@bigcorp.com',
          to: ['you@company.com'],
          subject: 'API Integration Timeline',
          date: '2024-03-15T10:00:00Z',
          body: `Hi,\n\nWe're planning our Q2 roadmap and need to understand the timeline for the API integration we discussed. Specifically:\n\n1. When will the authentication endpoints be ready?\n2. What is the estimated completion date for the full integration?\n3. Will there be a staging environment for testing?\n\nWe need to coordinate with our mobile team, so any clarity would be helpful.\n\nBest regards,\nJohn Smith\nCTO, BigCorp`,
        },
      ],
    },
    tone: 'professional',
    user_name: 'Sarah Johnson',
    user_email: 'you@company.com',
    key_points: [
      'Authentication endpoints ready by March 30',
      'Full integration by May 15',
      'Staging environment available April 1',
    ],
  };

  try {
    const response = await axios.post(`${API_BASE}/api/v1/agents/draft`, input);
    
    console.log('Subject:', response.data.subject);
    console.log('\nDraft:\n');
    console.log(response.data.body);
    console.log('\nMetadata:');
    console.log(`- Tone: ${response.data.tone_used}`);
    console.log(`- Words: ${response.data.metadata.word_count}`);
    console.log(`- Reading time: ${response.data.metadata.estimated_reading_time}`);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function exampleDraftCasual() {
  console.log('\n=== Example 4: Draft Casual Email Reply ===\n');

  const input = {
    thread: {
      messages: [
        {
          from: 'teammate@company.com',
          to: ['you@company.com'],
          subject: 'Code Review Request',
          date: '2024-03-15T14:30:00Z',
          body: `Hey!\n\nI just pushed the new feature branch (feature/user-dashboard). Can you take a look when you get a chance?\n\nMain changes:\n- New dashboard UI\n- Performance improvements\n- Bug fixes from last sprint\n\nLet me know if anything looks off. No rush, but would be great to get feedback before tomorrow's standup.\n\nThanks!\nMike`,
        },
      ],
    },
    tone: 'casual',
    user_name: 'Alex',
  };

  try {
    const response = await axios.post(`${API_BASE}/api/v1/agents/draft`, input);
    
    console.log('Subject:', response.data.subject);
    console.log('\nDraft:\n');
    console.log(response.data.body);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function exampleDraftWithAlternatives() {
  console.log('\n=== Example 5: Draft with Tone Alternatives ===\n');

  const input = {
    thread: {
      messages: [
        {
          from: 'hr@company.com',
          to: ['you@company.com'],
          subject: 'Interview Feedback Request',
          date: '2024-03-15T16:00:00Z',
          body: 'Hi, Can you provide feedback on yesterday\'s candidate interview for the Senior Engineer position? Please share your thoughts by end of day.',
        },
      ],
    },
    tone: 'professional',
  };

  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/agents/draft/with-alternatives`,
      input
    );
    
    console.log('=== Primary (Professional) ===');
    console.log(response.data.body);
    
    if (response.data.alternatives) {
      console.log('\n=== Casual Alternative ===');
      console.log(response.data.alternatives.casual || 'N/A');
      
      console.log('\n=== Formal Alternative ===');
      console.log(response.data.alternatives.formal || 'N/A');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  console.log('\n🤖 AI Agent Examples\n');
  console.log('=' .repeat(60));

  await exampleSummarizeMeeting();
  await exampleSummarizeDocument();
  await exampleDraftProfessional();
  await exampleDraftCasual();
  await exampleDraftWithAlternatives();

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All examples completed\n');
}

if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  exampleSummarizeMeeting,
  exampleSummarizeDocument,
  exampleDraftProfessional,
  exampleDraftCasual,
  exampleDraftWithAlternatives,
};
