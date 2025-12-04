/**
 * RAG Service with Guardrails - Integration Example
 * 
 * This file demonstrates how to integrate the LLM guardrails
 * into your existing RAG (Retrieval-Augmented Generation) pipeline.
 */

import OpenAI from 'openai';
import { 
  buildRAGPrompt, 
  getLLMConfig, 
  Source,
  FALLBACK_RESPONSES
} from '../config/llm-guardrails';
import validateLLMResponse from './llm-response-validator';
import logger from '../utils/logger';

// ============================================================================
// RAG SERVICE WITH GUARDRAILS
// ============================================================================

export class RAGServiceWithGuardrails {
  private openai: OpenAI;
  private environment: string;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.environment = process.env.NODE_ENV || 'development';
  }
  
  /**
   * Query RAG system with guardrails enabled
   */
  async query(
    userQuery: string,
    retrievedSources: Source[],
    options?: {
      validateResponse?: boolean;
      confidenceThreshold?: number;
    }
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      // Step 1: Build prompt with system instructions and sources
      const prompt = buildRAGPrompt(userQuery, retrievedSources);
      
      // Step 2: Get environment-specific LLM configuration
      const llmConfig = getLLMConfig(this.environment);
      
      logger.info('Querying LLM with guardrails', {
        query: userQuery.substring(0, 100),
        sourceCount: retrievedSources.length,
        environment: this.environment,
        temperature: llmConfig.temperature
      });
      
      // Step 3: Query LLM
      const completion = await this.openai.chat.completions.create({
        model: llmConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are LifeOS Assistant. Follow the instructions exactly.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens,
        top_p: llmConfig.topP,
        frequency_penalty: llmConfig.frequencyPenalty,
        presence_penalty: llmConfig.presencePenalty
      });
      
      const llmResponse = completion.choices[0]?.message?.content || '';
      
      // Step 4: Validate response (if enabled)
      const shouldValidate = options?.validateResponse ?? true;
      let finalResponse = llmResponse;
      let validationResult = null;
      
      if (shouldValidate && retrievedSources.length > 0) {
        validationResult = await validateLLMResponse(
          llmResponse,
          retrievedSources,
          userQuery
        );
        
        // Check confidence threshold
        const confidenceThreshold = options?.confidenceThreshold ?? 0.7;
        
        if (validationResult.shouldReturnFallback || validationResult.confidence < confidenceThreshold) {
          logger.warn('LLM response failed validation, returning fallback', {
            confidence: validationResult.confidence,
            issueCount: validationResult.issues.length,
            shouldReturnFallback: validationResult.shouldReturnFallback
          });
          
          finalResponse = validationResult.correctedResponse || FALLBACK_RESPONSES.noInformation;
        }
        
        // Log validation issues
        if (validationResult.issues.length > 0) {
          logger.warn('LLM response validation issues detected', {
            issues: validationResult.issues,
            query: userQuery.substring(0, 100)
          });
        }
      }
      
      // Step 5: Return response
      const responseTime = Date.now() - startTime;
      
      return {
        response: finalResponse,
        sources: retrievedSources,
        metadata: {
          responseTime,
          validated: shouldValidate,
          confidence: validationResult?.confidence,
          issues: validationResult?.issues || [],
          tokensUsed: completion.usage?.total_tokens,
          model: llmConfig.model
        }
      };
      
    } catch (error) {
      logger.error('Error in RAG query with guardrails', { error, query: userQuery });
      
      return {
        response: FALLBACK_RESPONSES.error,
        sources: [],
        metadata: {
          responseTime: Date.now() - startTime,
          validated: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
  
  /**
   * Batch query multiple questions with guardrails
   */
  async batchQuery(
    queries: Array<{ query: string; sources: Source[] }>
  ): Promise<RAGResponse[]> {
    const results = await Promise.all(
      queries.map(q => this.query(q.query, q.sources))
    );
    
    return results;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface RAGResponse {
  response: string;
  sources: Source[];
  metadata: {
    responseTime: number;
    validated: boolean;
    confidence?: number;
    issues?: any[];
    tokensUsed?: number;
    model?: string;
    error?: string;
  };
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * Example: How to use RAG service with guardrails in your API routes
 */
export async function exampleUsage() {
  const ragService = new RAGServiceWithGuardrails();
  
  // Mock retrieved sources (in production, these come from vector search)
  const sources: Source[] = [
    {
      id: 'email_123',
      type: 'email',
      content: 'Team meeting scheduled for Friday at 3 PM in Conference Room B.',
      metadata: {
        subject: 'Weekly Team Meeting',
        from: 'manager@company.com',
        date: '2024-12-01'
      }
    }
  ];
  
  // Query with guardrails
  const result = await ragService.query(
    'When is the team meeting?',
    sources,
    {
      validateResponse: true,
      confidenceThreshold: 0.7
    }
  );
  
  console.log('Response:', result.response);
  console.log('Confidence:', result.metadata.confidence);
  console.log('Issues:', result.metadata.issues);
  
  // Handle based on confidence
  if (result.metadata.confidence && result.metadata.confidence < 0.7) {
    console.log('⚠️  Low confidence response - consider showing disclaimer to user');
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RAGServiceWithGuardrails;
