/**
 * RAG Prompt Templates
 * Designed to minimize hallucinations and enforce citation
 */

export interface SourceContext {
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface PromptContext {
  query: string;
  sources: SourceContext[];
  graphContext?: string;
}

/**
 * System prompt template for RAG
 * Emphasizes factual accuracy and citation requirements
 */
export const RAG_SYSTEM_PROMPT = `You are LifeOS, an AI assistant that helps users recall and understand information from their Personal Memory Graph.

## Core Principles:
1. **Only use information from the provided sources** - Never use your general knowledge
2. **Always cite your sources** using [source_id] notation after each fact
3. **Be precise and factual** - Quote directly when possible
4. **If uncertain, say "I don't know"** - Never guess or make assumptions
5. **Acknowledge limitations** - If sources don't contain enough information, state that clearly

## Citation Rules:
- Place [source_id] immediately after each fact or claim
- Use multiple citations if information comes from multiple sources: [source_1][source_2]
- Include citations even for paraphrased information
- If synthesizing across sources, cite all relevant sources

## Response Format:
- Start with a direct answer to the user's question
- Provide supporting details with citations
- End with a confidence statement if relevant
- List all sources used at the end

## Confidence Levels:
- **High**: Multiple sources confirm the information
- **Medium**: Single source or partial information
- **Low**: Limited or ambiguous information
- **None**: Cannot answer from provided sources

Remember: It's better to say "I don't know" than to provide uncited or speculative information.`;

/**
 * Build the context section with sources
 */
export function buildContextSection(sources: SourceContext[], graphContext?: string): string {
  let context = '## Available Sources:\n\n';

  sources.forEach((source, index) => {
    context += `### Source [${source.source_id}]\n`;
    context += `**Title:** ${source.title}\n`;
    context += `**Relevance Score:** ${(source.score * 100).toFixed(1)}%\n`;
    
    // Add metadata if present
    if (source.metadata.source_type) {
      context += `**Type:** ${source.metadata.source_type}\n`;
    }
    if (source.metadata.created_at) {
      context += `**Date:** ${source.metadata.created_at}\n`;
    }
    if (source.metadata.author) {
      context += `**Author:** ${source.metadata.author}\n`;
    }

    context += `\n**Content:**\n${source.content}\n\n`;
    context += '---\n\n';
  });

  // Add graph context if available
  if (graphContext) {
    context += '## Knowledge Graph Context:\n\n';
    context += graphContext + '\n\n';
    context += '---\n\n';
  }

  return context;
}

/**
 * Build the complete prompt for RAG
 */
export function buildRAGPrompt(promptContext: PromptContext): string {
  const contextSection = buildContextSection(
    promptContext.sources,
    promptContext.graphContext
  );

  const userPrompt = `${contextSection}
## User Question:
${promptContext.query}

## Instructions:
Answer the user's question using ONLY the information from the sources above. Include [source_id] citations after each fact. If you cannot answer from the provided sources, clearly state that.`;

  return userPrompt;
}

/**
 * Template for no results case
 */
export const NO_RESULTS_RESPONSE = {
  answer: "I don't have any information about that in your Personal Memory Graph. This could mean:\n\n1. The information hasn't been added to your knowledge base yet\n2. It might be phrased differently in your documents\n3. The relevant documents haven't been processed\n\nTry rephrasing your question or check if the relevant documents have been synced.",
  confidence: 'none' as const,
  citations: [],
};

/**
 * Parse citations from LLM response
 */
export function parseCitations(response: string): string[] {
  const citationRegex = /\[(\w+)\]/g;
  const citations: string[] = [];
  let match;

  while ((match = citationRegex.exec(response)) !== null) {
    const sourceId = match[1];
    if (!citations.includes(sourceId)) {
      citations.push(sourceId);
    }
  }

  return citations;
}

/**
 * Extract confidence level from response
 */
export function extractConfidence(response: string): 'high' | 'medium' | 'low' | 'none' {
  const lowerResponse = response.toLowerCase();

  if (lowerResponse.includes("i don't know") || 
      lowerResponse.includes("cannot answer") ||
      lowerResponse.includes("no information")) {
    return 'none';
  }

  // Count citations as proxy for confidence
  const citationCount = (response.match(/\[\w+\]/g) || []).length;

  if (citationCount >= 5) return 'high';
  if (citationCount >= 3) return 'medium';
  if (citationCount >= 1) return 'low';

  return 'low';
}
