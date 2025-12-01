/**
 * Email Drafting Agent
 * Drafts email replies in user's voice with tone control
 */

import { v4 as uuidv4 } from 'uuid';
import { getDefaultLLMClient } from '../llm/emergentLlmClient';
import logger from '../../utils/logger';

export type EmailTone = 'professional' | 'casual' | 'friendly' | 'formal';

export interface EmailThread {
  messages: EmailMessage[];
}

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  message_id?: string;
}

export interface DraftInput {
  thread: EmailThread;
  key_points?: string[]; // Optional: specific points to address
  tone?: EmailTone;
  user_name?: string;
  user_email?: string;
  max_length?: 'short' | 'medium' | 'long';
}

export interface DraftOutput {
  draft_id: string;
  subject: string;
  body: string;
  tone_used: EmailTone;
  metadata: {
    word_count: number;
    estimated_reading_time: string; // "30 seconds"
    generated_at: string;
  };
  alternatives?: {
    casual?: string;
    professional?: string;
    formal?: string;
  };
}

/**
 * System prompt for email drafting
 */
const DRAFTING_SYSTEM_PROMPT = `You are an expert email composition AI that helps users draft professional, thoughtful email replies.

## Core Principles:

### 1. Voice and Tone Matching

**Professional Tone:**
- Clear, direct, and respectful
- Use complete sentences and proper grammar
- Avoid contractions in formal contexts
- Maintain professional distance
- Example: "Thank you for your email. I have reviewed the proposal and would like to discuss..."

**Casual Tone:**
- Conversational and friendly
- Use contractions naturally (I'm, you're, we'll)
- More relaxed structure
- Still respectful and clear
- Example: "Thanks for reaching out! I've looked over the proposal and I'd love to chat about..."

**Friendly Tone:**
- Warm and personable
- Show enthusiasm appropriately
- Use friendly language ("Great to hear from you!")
- Maintain professionalism
- Example: "Great to hear from you! I'm excited about the proposal and would love to connect..."

**Formal Tone:**
- Very professional and structured
- No contractions
- Use formal greetings and closings
- Precise language
- Example: "Dear [Name], Thank you for your correspondence regarding the proposal. I have carefully reviewed..."

### 2. Email Structure

**Opening:**
- Acknowledge previous email/thread
- Show you read and understood
- Set positive tone

**Body:**
- Address key points in order
- Be specific and clear
- Use bullet points for multiple items
- Include necessary details

**Closing:**
- Clear next steps or call to action
- Appropriate sign-off
- Maintain tone throughout

### 3. Length Guidelines

**Short (50-100 words):**
- Quick acknowledgment or simple response
- 2-3 paragraphs maximum
- Direct and to the point

**Medium (100-200 words):**
- Standard response length
- 3-4 paragraphs
- Covers all necessary points

**Long (200-300 words):**
- Detailed response
- Multiple topics or complex issues
- Well-structured with clear sections

### 4. Content Guidelines

**DO:**
✓ Address all questions from the thread
✓ Be specific about dates, numbers, deliverables
✓ Propose clear next steps
✓ Maintain consistent tone
✓ Proofread for clarity

**DON'T:**
✗ Introduce information not in the thread
✗ Make commitments beyond the scope
✗ Use overly complex language
✗ Include unnecessary apologies
✗ Over-explain simple points

## Output Format:

Return ONLY a JSON object:

\`\`\`json
{
  "subject": "Re: [Original Subject] or updated subject",
  "body": "Email body with proper formatting and line breaks",
  "tone_used": "professional"
}
\`\`\`

## Examples:

### Example 1: Professional Response

**Input Thread:**
- From: client@company.com
- "Can you provide an update on the API project? We need to know the timeline."

**Output:**
\`\`\`json
{
  "subject": "Re: API Project Timeline",
  "body": "Thank you for reaching out.\n\nI am pleased to provide an update on the API project. We have completed Phase 1 (authentication) and are currently in Phase 2 (data layer). Based on our current progress, we expect to complete Phase 2 by June 15, with final testing by June 30.\n\nI will send weekly progress reports every Friday. Please let me know if you need any additional details or would like to schedule a call to discuss.\n\nBest regards",
  "tone_used": "professional"
}
\`\`\`

### Example 2: Casual Response

**Input Thread:**
- From: teammate@company.com
- "Hey! Can you review the docs before our meeting tomorrow?"

**Output:**
\`\`\`json
{
  "subject": "Re: Docs Review",
  "body": "Hey!\n\nAbsolutely, I'll take a look at the docs this afternoon. I should have feedback ready before tomorrow's meeting.\n\nIs there anything specific you want me to focus on, or just a general review?\n\nThanks!",
  "tone_used": "casual"
}
\`\`\`

Remember: Match the tone, address all points, and propose clear next steps.`;

/**
 * Build user prompt for email drafting
 */
function buildDraftingPrompt(input: DraftInput): string {
  let prompt = '## Email Thread to Respond To\n\n';

  // Add thread context
  input.thread.messages.forEach((msg, index) => {
    prompt += `### Message ${index + 1}\n`;
    prompt += `**From:** ${msg.from}\n`;
    prompt += `**To:** ${msg.to.join(', ')}\n`;
    prompt += `**Date:** ${msg.date}\n`;
    prompt += `**Subject:** ${msg.subject}\n\n`;
    prompt += `**Body:**\n${msg.body}\n\n`;
    prompt += '---\n\n';
  });

  // Add instructions
  prompt += '## Drafting Instructions\n\n';

  if (input.user_name) {
    prompt += `You are drafting on behalf of: ${input.user_name}`;
    if (input.user_email) {
      prompt += ` (${input.user_email})`;
    }
    prompt += '\n';
  }

  const tone = input.tone || 'professional';
  prompt += `**Tone:** ${tone}\n`;

  const length = input.max_length || 'medium';
  prompt += `**Length:** ${length}\n\n`;

  if (input.key_points && input.key_points.length > 0) {
    prompt += '**Key Points to Address:**\n';
    input.key_points.forEach((point) => {
      prompt += `- ${point}\n`;
    });
    prompt += '\n';
  }

  prompt += 'Draft a reply that:\n';
  prompt += '1. Acknowledges and addresses all points from the thread\n';
  prompt += `2. Maintains a ${tone} tone throughout\n`;
  prompt += '3. Proposes clear next steps or actions\n';
  prompt += `4. Follows ${length} length guidelines\n\n`;

  prompt += 'Return ONLY valid JSON with subject and body. No additional text.';

  return prompt;
}

/**
 * Parse LLM response
 */
function parseDraftResponse(response: string): {
  subject: string;
  body: string;
  tone_used: EmailTone;
} {
  try {
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (!parsed.subject || !parsed.body) {
      throw new Error('Invalid response format');
    }

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      tone_used: parsed.tone_used || 'professional',
    };
  } catch (error) {
    logger.error('Failed to parse draft response:', error);
    logger.error('Raw response:', response);
    throw new Error('Failed to parse draft response');
  }
}

/**
 * Email Drafting Agent Class
 */
export class DraftingAgent {
  /**
   * Draft email reply
   */
  async draftReply(input: DraftInput): Promise<DraftOutput> {
    const draftId = uuidv4();
    const startTime = Date.now();

    logger.info(`Starting email draft (tone: ${input.tone || 'professional'})`);

    try {
      // Build prompt
      const userPrompt = buildDraftingPrompt(input);

      // Call LLM with moderate temperature for natural writing
      const llmClient = getDefaultLLMClient();
      const llmResponse = await llmClient.chat([
        { role: 'system', content: DRAFTING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      logger.info(`LLM response received (${llmResponse.usage.totalTokens} tokens)`);

      // Parse response
      const { subject, body, tone_used } = parseDraftResponse(llmResponse.content);

      // Calculate metadata
      const wordCount = body.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
      const readingTimeStr =
        readingTime === 1 ? '30 seconds' : `${readingTime} minute${readingTime > 1 ? 's' : ''}`;

      const output: DraftOutput = {
        draft_id: draftId,
        subject,
        body,
        tone_used,
        metadata: {
          word_count: wordCount,
          estimated_reading_time: readingTimeStr,
          generated_at: new Date().toISOString(),
        },
      };

      const duration = Date.now() - startTime;
      logger.info(`Draft complete in ${duration}ms (${wordCount} words)`);

      return output;
    } catch (error) {
      logger.error('Email drafting failed:', error);
      throw new Error(`Email drafting failed: ${error}`);
    }
  }

  /**
   * Generate multiple tone variations
   */
  async draftWithAlternatives(input: DraftInput): Promise<DraftOutput> {
    logger.info('Generating draft with tone alternatives');

    const originalTone = input.tone || 'professional';
    const tones: EmailTone[] = ['casual', 'professional', 'formal'];

    const results = await Promise.allSettled(
      tones.map((tone) => this.draftReply({ ...input, tone }))
    );

    // Get primary draft
    const primaryIndex = tones.indexOf(originalTone);
    const primaryResult = results[primaryIndex];

    if (primaryResult.status === 'rejected') {
      throw new Error('Failed to generate primary draft');
    }

    const primary = primaryResult.value;

    // Get alternatives
    const alternatives: DraftOutput['alternatives'] = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && tones[index] !== originalTone) {
        alternatives[tones[index]] = result.value.body;
      }
    });

    primary.alternatives = alternatives;

    logger.info(`Draft with ${Object.keys(alternatives).length} alternatives complete`);

    return primary;
  }
}

/**
 * Create drafting agent instance
 */
export function createDraftingAgent(): DraftingAgent {
  return new DraftingAgent();
}

/**
 * Configuration for drafting agent
 */
export const DRAFTING_CONFIG = {
  temperature: 0.5, // Moderate for natural writing
  maxTokens: 500,
  
  lengthLimits: {
    short: { min: 50, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 300 },
  },
  
  validate: (input: DraftInput): { valid: boolean; error?: string } => {
    if (!input.thread || !input.thread.messages || input.thread.messages.length === 0) {
      return { valid: false, error: 'Thread with at least one message is required' };
    }

    const lastMessage = input.thread.messages[input.thread.messages.length - 1];
    if (!lastMessage.body || lastMessage.body.trim().length === 0) {
      return { valid: false, error: 'Last message in thread has no body' };
    }

    return { valid: true };
  },
};
