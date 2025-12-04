/**
 * RAG Service - Main orchestration
 * Coordinates vector search, graph context, LLM, and caching
 */

import logger from '../../utils/logger';
import { searchByQuery, VectorSearchResult } from './vectorSearch';
import { getGraphContext, getDocumentMetadata } from './graphContext';
import { getDefaultLLMClient, BaseLLMClient, LLMMessage } from '../llm/emergentLlmClient';
import {
  buildRAGPrompt,
  RAG_SYSTEM_PROMPT,
  SourceContext,
  parseCitations,
  extractConfidence,
  NO_RESULTS_RESPONSE,
} from './promptTemplates';
import {
  getCachedResponse,
  cacheResponse,
  generateCacheKey,
  CachedRAGResponse,
} from './cache';
import { validateLLMResponse } from '../llm-response-validator';
import { SYSTEM_PROMPT_TEMPLATE, Source as GuardrailSource, FALLBACK_RESPONSES } from '../../config/llm-guardrails';

export interface RAGQueryRequest {
  user_id: string;
  query: string;
  top_k?: number;
  min_score?: number;
  use_cache?: boolean;
  llm_provider?: 'openai' | 'anthropic' | 'gemini';
  llm_model?: string;
}

export interface RAGQueryResponse {
  answer: string;
  citations: Array<{
    source_id: string;
    score: number;
    title?: string;
    document_id?: string;
  }>;
  used_chunks: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  latency: number;
  cached: boolean;
  metadata?: {
    vector_search_time: number;
    graph_context_time: number;
    llm_time: number;
    total_tokens: number;
  };
}

/**
 * Main RAG query function
 */
export async function queryRAG(
  request: RAGQueryRequest
): Promise<RAGQueryResponse> {
  const startTime = Date.now();
  const timings: Record<string, number> = {};

  try {
    const topK = request.top_k || 5;
    const minScore = request.min_score || 0.7;
    const useCache = request.use_cache !== false; // Default true

    // Check cache first
    if (useCache) {
      const cacheKey = generateCacheKey(request.user_id, request.query, topK);
      const cached = await getCachedResponse(cacheKey);
      
      if (cached) {
        return {
          ...cached,
          latency: Date.now() - startTime,
        };
      }
    }

    // Step 1: Vector search for relevant chunks
    const vectorSearchStart = Date.now();
    const apiKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY || '';
    
    const vectorResults = await searchByQuery(
      request.query,
      apiKey,
      {
        topK,
        minScore,
        filter: { user_id: request.user_id }, // Filter by user
      }
    );
    timings.vector_search_time = Date.now() - vectorSearchStart;

    // If no results found, return early
    if (vectorResults.length === 0) {
      logger.info(`No relevant documents found for query: ${request.query}`);
      
      const response: RAGQueryResponse = {
        ...NO_RESULTS_RESPONSE,
        used_chunks: 0,
        latency: Date.now() - startTime,
        cached: false,
      };

      return response;
    }

    logger.info(`Found ${vectorResults.length} relevant chunks`);

    // Step 2: Fetch graph context for the chunks
    const graphContextStart = Date.now();
    const chunkIds = vectorResults.map(r => r.id);
    const graphContext = await getGraphContext(chunkIds, request.user_id);
    const documentMetadata = await getDocumentMetadata(chunkIds);
    timings.graph_context_time = Date.now() - graphContextStart;

    // Step 3: Build source contexts
    const sources: SourceContext[] = vectorResults.map((result, index) => {
      const docMeta = documentMetadata.get(result.id) || {};
      
      return {
        source_id: `src_${index + 1}`,
        title: docMeta.title || result.metadata.title || `Chunk ${index + 1}`,
        content: result.metadata.text || '',
        score: result.score,
        metadata: {
          ...result.metadata,
          ...docMeta,
          original_chunk_id: result.id,
        },
      };
    });

    // Step 4: Build prompt
    const userPrompt = buildRAGPrompt({
      query: request.query,
      sources,
      graphContext: graphContext.contextSummary,
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: RAG_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    // Step 5: Call LLM
    const llmStart = Date.now();
    const llmClient = getDefaultLLMClient();
    const llmResponse = await llmClient.chat(messages);
    timings.llm_time = Date.now() - llmStart;

    logger.info(`LLM response generated: ${llmResponse.usage.totalTokens} tokens`);

    // Step 6: Parse response and extract citations
    const citedSourceIds = parseCitations(llmResponse.content);
    const confidence = extractConfidence(llmResponse.content);

    // Build citation list with scores
    const citations = citedSourceIds
      .map(sourceId => {
        const sourceIndex = parseInt(sourceId.replace('src_', '')) - 1;
        const source = sources[sourceIndex];
        
        if (!source) return null;
        
        return {
          source_id: sourceId,
          score: source.score,
          title: source.title,
          document_id: source.metadata.document_id,
        };
      })
      .filter(c => c !== null) as RAGQueryResponse['citations'];

    const response: RAGQueryResponse = {
      answer: llmResponse.content,
      citations,
      used_chunks: vectorResults.length,
      confidence,
      latency: Date.now() - startTime,
      cached: false,
      metadata: {
        vector_search_time: timings.vector_search_time,
        graph_context_time: timings.graph_context_time,
        llm_time: timings.llm_time,
        total_tokens: llmResponse.usage.totalTokens,
      },
    };

    // Cache the response
    if (useCache) {
      const cacheKey = generateCacheKey(request.user_id, request.query, topK);
      await cacheResponse(cacheKey, {
        answer: response.answer,
        citations: response.citations,
        used_chunks: response.used_chunks,
        confidence: response.confidence,
      });
    }

    return response;
  } catch (error) {
    logger.error('RAG query failed:', error);
    throw new Error(`RAG query failed: ${error}`);
  }
}
