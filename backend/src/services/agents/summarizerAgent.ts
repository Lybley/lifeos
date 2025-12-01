/**
 * Summarizer Agent
 * Creates TL;DR (1-sentence) and bullet-point (3-bullet) summaries
 */

import { v4 as uuidv4 } from 'uuid';
import { getDefaultLLMClient } from '../llm/emergentLlmClient';
import logger from '../../utils/logger';

export interface SummaryInput {
  text: string;
  metadata?: {
    title?: string;
    source_type?: string; // 'document', 'meeting', 'email', 'article'
    date?: string;
    participants?: string[];
    [key: string]: any;
  };
}

export interface SummaryOutput {
  summary_id: string;
  tldr: string;
  bullets: string[];
  metadata: {
    original_length: number;
    compression_ratio: number;
    generated_at: string;
  };
  source_metadata?: any;
}

/**
 * System prompt for summarization
 */
const SUMMARIZER_SYSTEM_PROMPT = `You are an expert summarization AI that creates concise, accurate summaries of documents, meetings, and communications.

## Core Principles:

### 1. Accuracy First
- Only include information explicitly stated in the source
- Never add interpretation or external knowledge
- Preserve key facts, numbers, and dates exactly
- If uncertain about a detail, omit it

### 2. Two Summary Formats

**TL;DR (Too Long; Didn't Read):**
- EXACTLY ONE sentence
- Captures the absolute essence
- 15-25 words maximum
- Use active voice
- Answer: "What is this about?"

**Bullet Summary:**
- EXACTLY THREE bullets
- Each bullet: 10-20 words
- Cover the most important points
- Prioritize: decisions > actions > discussions
- Use parallel structure

### 3. Content Prioritization

**For Meetings:**
1. Key decisions made
2. Action items assigned
3. Major topics discussed

**For Documents:**
1. Main thesis or purpose
2. Key findings or arguments
3. Conclusions or recommendations

**For Email Threads:**
1. Primary request or question
2. Key responses or decisions
3. Next steps or deadlines

### 4. Writing Guidelines

**DO:**
✓ Use clear, direct language
✓ Include specific names, dates, numbers
✓ Use present tense for facts
✓ Use past tense for events
✓ Keep bullets parallel in structure

**DON'T:**
✗ Use vague terms ("some", "various", "several")
✗ Include filler words ("basically", "essentially")
✗ Start bullets with "The team" or "We discussed"
✗ Exceed the word limits
✗ Add opinions or interpretations

## Output Format:

Respond with ONLY a JSON object:

\`\`\`json
{
  "tldr": "One sentence capturing the essence",
  "bullets": [
    "First key point with specific details",
    "Second important point with facts",
    "Third critical point with outcomes"
  ]
}
\`\`\`

## Examples:

### Example 1: Meeting Summary

**Input:** Sprint planning meeting discussing Q2 roadmap...

**Output:**
\`\`\`json
{
  "tldr": "Team prioritized API redesign for Q2, allocating 3 developers with May 15 delivery target",
  "bullets": [
    "API redesign approved as Q2 priority with $200K budget and 3-developer team",
    "Phase 1 (authentication) due May 15, Phase 2 (data layer) due June 30",
    "Weekly stakeholder demos scheduled every Friday at 2 PM starting April 5"
  ]
}
\`\`\`

### Example 2: Document Summary

**Input:** Research paper on machine learning optimization...

**Output:**
\`\`\`json
{
  "tldr": "New gradient descent optimization algorithm achieves 40% faster convergence with 15% better accuracy",
  "bullets": [
    "Adaptive learning rate algorithm reduces training time from 8 hours to 4.8 hours",
    "Accuracy improved from 87% to 92% on standard benchmarks with same model architecture",
    "Method applicable to all neural network types without hyperparameter tuning"
  ]
}
\`\`\`

Remember: Concise, accurate, and directly from the source material.`;

/**
 * Build user prompt for summarization
 */
function buildSummarizerPrompt(input: SummaryInput): string {
  let prompt = '## Content to Summarize\n\n';

  if (input.metadata?.title) {
    prompt += `**Title:** ${input.metadata.title}\n`;
  }

  if (input.metadata?.source_type) {
    prompt += `**Type:** ${input.metadata.source_type}\n`;
  }

  if (input.metadata?.date) {
    prompt += `**Date:** ${input.metadata.date}\n`;
  }

  if (input.metadata?.participants && input.metadata.participants.length > 0) {
    prompt += `**Participants:** ${input.metadata.participants.join(', ')}\n`;
  }

  prompt += `\n**Text:**\n${input.text}\n\n`;

  prompt += `## Instructions\n\n`;
  prompt += `Create two summaries:\n`;
  prompt += `1. **TL;DR**: One sentence (15-25 words) capturing the essence\n`;
  prompt += `2. **Bullets**: Three bullet points (10-20 words each) covering key points\n\n`;
  prompt += `Return ONLY valid JSON in the specified format. No additional text.`;

  return prompt;
}

/**
 * Parse LLM response
 */
function parseSummaryResponse(response: string): { tldr: string; bullets: string[] } {
  try {
    // Remove markdown code blocks
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (!parsed.tldr || !Array.isArray(parsed.bullets)) {
      throw new Error('Invalid response format');
    }

    // Validate bullet count
    if (parsed.bullets.length !== 3) {
      // Try to fix by taking first 3 or padding
      if (parsed.bullets.length > 3) {
        parsed.bullets = parsed.bullets.slice(0, 3);
      } else {
        throw new Error('Expected exactly 3 bullets');
      }
    }

    return {
      tldr: parsed.tldr.trim(),
      bullets: parsed.bullets.map((b: string) => b.trim()),
    };
  } catch (error) {
    logger.error('Failed to parse summary response:', error);
    logger.error('Raw response:', response);
    throw new Error('Failed to parse summary response');
  }
}

/**
 * Summarizer Agent Class
 */
export class SummarizerAgent {
  /**
   * Generate summary
   */
  async summarize(input: SummaryInput): Promise<SummaryOutput> {
    const summaryId = uuidv4();
    const startTime = Date.now();

    logger.info('Starting summarization');

    try {
      // Build prompt
      const userPrompt = buildSummarizerPrompt(input);

      // Call LLM with lower temperature for consistency
      const llmClient = getDefaultLLMClient();
      const llmResponse = await llmClient.chat([
        { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      logger.info(`LLM response received (${llmResponse.usage.totalTokens} tokens)`);

      // Parse response
      const { tldr, bullets } = parseSummaryResponse(llmResponse.content);

      // Calculate metrics
      const originalLength = input.text.length;
      const summaryLength = tldr.length + bullets.join(' ').length;
      const compressionRatio = parseFloat(
        (((originalLength - summaryLength) / originalLength) * 100).toFixed(1)
      );

      const output: SummaryOutput = {
        summary_id: summaryId,
        tldr,
        bullets,
        metadata: {
          original_length: originalLength,
          compression_ratio: compressionRatio,
          generated_at: new Date().toISOString(),
        },
        source_metadata: input.metadata,
      };

      const duration = Date.now() - startTime;
      logger.info(
        `Summarization complete in ${duration}ms (${compressionRatio}% compression)`
      );

      return output;
    } catch (error) {
      logger.error('Summarization failed:', error);
      throw new Error(`Summarization failed: ${error}`);
    }
  }

  /**
   * Batch summarization
   */
  async summarizeBatch(inputs: SummaryInput[]): Promise<SummaryOutput[]> {
    logger.info(`Starting batch summarization of ${inputs.length} items`);

    const results = await Promise.allSettled(
      inputs.map((input) => this.summarize(input))
    );

    const summaries: SummaryOutput[] = [];
    const failures: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        summaries.push(result.value);
      } else {
        failures.push(`Item ${index}: ${result.reason}`);
      }
    });

    logger.info(
      `Batch complete: ${summaries.length} succeeded, ${failures.length} failed`
    );

    if (failures.length > 0) {
      logger.warn('Batch failures:', failures);
    }

    return summaries;
  }
}

/**
 * Create summarizer agent instance
 */
export function createSummarizerAgent(): SummarizerAgent {
  return new SummarizerAgent();
}

/**
 * Configuration for summarizer
 */
export const SUMMARIZER_CONFIG = {
  maxInputLength: 50000, // characters
  temperature: 0.3, // Low for consistency
  maxTokens: 300, // TL;DR + 3 bullets shouldn't exceed this
  
  validate: (input: SummaryInput): { valid: boolean; error?: string } => {
    if (!input.text || input.text.trim().length === 0) {
      return { valid: false, error: 'Text is required' };
    }

    if (input.text.length > SUMMARIZER_CONFIG.maxInputLength) {
      return {
        valid: false,
        error: `Text exceeds maximum length of ${SUMMARIZER_CONFIG.maxInputLength} characters`,
      };
    }

    if (input.text.trim().length < 50) {
      return {
        valid: false,
        error: 'Text too short to summarize (minimum 50 characters)',
      };
    }

    return { valid: true };
  },
};
