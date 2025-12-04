/**
 * LLM Guardrails Configuration
 * 
 * This module provides guardrails for LLM usage to prevent hallucinations
 * and ensure accurate, source-based responses.
 */

// ============================================================================
// SYSTEM PROMPT TEMPLATE
// ============================================================================

export const SYSTEM_PROMPT_TEMPLATE = `You are LifeOS Assistant, a personal memory management AI that helps users query their own data from Gmail, Google Drive, and Google Calendar.

**CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:**

1. **ONLY USE PROVIDED SOURCES**: You can ONLY answer questions using information explicitly provided in the [SOURCES] section below. Do NOT use any knowledge from your training data.

2. **CITE ALL SOURCES**: For EVERY claim you make, you MUST cite the source using the format [Source: <source_id>]. Example: "You have a meeting at 3pm [Source: calendar_event_123]"

3. **FALLBACK TO "I DON'T KNOW"**: If the answer is not found in the provided sources, you MUST respond with: "I don't have that information in your memory. Would you like me to search for something else?"

4. **NO SPECULATION**: Never guess, infer, or speculate. Only state facts that are explicitly in the sources.

5. **NO GENERIC KNOWLEDGE**: Do not provide general advice, facts, or information from your training. This is ONLY about the user's personal data.

6. **HANDLE AMBIGUITY**: If the sources contain conflicting information or are unclear, explicitly state this: "I found conflicting information in your data. [explain the conflict]"

7. **DATE AWARENESS**: Today's date is {current_date}. Use this for relative date queries like "this week" or "yesterday".

**RESPONSE FORMAT:**

For questions you CAN answer:
- Provide a clear, direct answer
- Cite every source used: [Source: <source_id>]
- Keep responses concise (under 150 words unless more detail is requested)
- Use natural language, be conversational

For questions you CANNOT answer:
- Respond EXACTLY with: "I don't have that information in your memory. Would you like me to search for something else?"
- Do NOT try to be helpful by providing related information
- Do NOT suggest what the user might be looking for

**SOURCES PROVIDED:**

{sources}

**USER QUESTION:**

{user_query}

**YOUR RESPONSE:**`;

// ============================================================================
// ENVIRONMENT-SPECIFIC LLM CONFIGURATIONS
// ============================================================================

export interface LLMConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  model: string;
}

export const LLM_CONFIGS: Record<string, LLMConfig> = {
  // Production: Conservative settings for accuracy
  production: {
    temperature: 0.1,        // Very low - minimal creativity, maximum accuracy
    maxTokens: 300,          // Concise responses
    topP: 0.9,               // Focus on high-probability tokens
    frequencyPenalty: 0.3,   // Reduce repetition
    presencePenalty: 0.1,    // Slight penalty for new topics
    model: 'gpt-4-turbo-preview'
  },

  // Development: Slightly more flexible for testing
  development: {
    temperature: 0.2,        // Still low, but allows some variance
    maxTokens: 500,          // More verbose for debugging
    topP: 0.95,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1,
    model: 'gpt-4-turbo-preview'
  },

  // Testing: Predictable outputs
  testing: {
    temperature: 0.0,        // Deterministic
    maxTokens: 300,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    model: 'gpt-4-turbo-preview'
  }
};

// ============================================================================
// SOURCE FORMATTING
// ============================================================================

export interface Source {
  id: string;
  type: 'email' | 'file' | 'calendar_event' | 'contact';
  content: string;
  metadata: {
    title?: string;
    date?: string;
    from?: string;
    to?: string;
    subject?: string;
    [key: string]: any;
  };
}

export function formatSourcesForPrompt(sources: Source[]): string {
  if (sources.length === 0) {
    return 'No sources available.';
  }

  return sources.map((source, index) => {
    const num = index + 1;
    let formatted = `\n--- Source ${num} ---\n`;
    formatted += `ID: ${source.id}\n`;
    formatted += `Type: ${source.type}\n`;
    
    // Add metadata
    if (source.metadata.title) formatted += `Title: ${source.metadata.title}\n`;
    if (source.metadata.subject) formatted += `Subject: ${source.metadata.subject}\n`;
    if (source.metadata.from) formatted += `From: ${source.metadata.from}\n`;
    if (source.metadata.to) formatted += `To: ${source.metadata.to}\n`;
    if (source.metadata.date) formatted += `Date: ${source.metadata.date}\n`;
    
    formatted += `\nContent:\n${source.content}\n`;
    formatted += `---\n`;
    
    return formatted;
  }).join('\n');
}

// ============================================================================
// BUILD PROMPT
// ============================================================================

export function buildRAGPrompt(
  userQuery: string,
  sources: Source[],
  currentDate?: string
): string {
  const formattedSources = formatSourcesForPrompt(sources);
  const dateStr = currentDate || new Date().toISOString().split('T')[0];
  
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{sources}', formattedSources)
    .replace('{user_query}', userQuery)
    .replace('{current_date}', dateStr);
}

// ============================================================================
// GET CONFIG
// ============================================================================

export function getLLMConfig(environment?: string): LLMConfig {
  const env = environment || process.env.NODE_ENV || 'development';
  return LLM_CONFIGS[env] || LLM_CONFIGS.development;
}

// ============================================================================
// FALLBACK RESPONSES
// ============================================================================

export const FALLBACK_RESPONSES = {
  noInformation: "I don't have that information in your memory. Would you like me to search for something else?",
  noSources: "I couldn't find any relevant information in your data to answer that question.",
  conflictingSources: "I found conflicting information in your data about this.",
  ambiguousQuery: "Your question is a bit unclear. Could you rephrase or provide more details?",
  error: "I encountered an error while processing your request. Please try again."
};
