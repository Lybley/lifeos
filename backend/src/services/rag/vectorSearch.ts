/**
 * Vector Search Service
 * Handles semantic search in Pinecone vector database
 */

import { pineconeClient } from '../../config/pinecone';
import logger from '../../utils/logger';
import OpenAI from 'openai';

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    document_id?: string;
    chunk_index?: number;
    source_type?: string;
    title?: string;
    created_at?: string;
    [key: string]: any;
  };
}

export interface VectorSearchOptions {
  topK: number;
  minScore?: number;
  filter?: Record<string, any>;
  namespace?: string;
}

/**
 * Generate embedding for query using OpenAI
 */
export async function generateQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
  try {
    const openai = new OpenAI({ apiKey });
    
    // Use same model as ingest service for consistency
    const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    
    const response = await openai.embeddings.create({
      model,
      input: query,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Failed to generate query embedding:', error);
    throw new Error(`Embedding generation failed: ${error}`);
  }
}

/**
 * Search vector database for relevant chunks
 */
export async function searchVectors(
  queryEmbedding: number[],
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized');
  }

  try {
    const indexName = process.env.PINECONE_INDEX_NAME || 'lifeos-embeddings';
    const index = pineconeClient.index(indexName);

    const queryRequest: any = {
      vector: queryEmbedding,
      topK: options.topK,
      includeMetadata: true,
    };

    // Add filter if provided (e.g., filter by user_id)
    if (options.filter) {
      queryRequest.filter = options.filter;
    }

    // Add namespace if provided
    if (options.namespace) {
      queryRequest.namespace = options.namespace;
    }

    const results = await index.query(queryRequest);

    // Filter by minimum score if specified
    const matches = results.matches || [];
    
    // DEBUG: Log what Pinecone returns
    logger.debug(`Pinecone returned ${matches.length} matches`);
    if (matches.length > 0) {
      const firstMatch = matches[0];
      logger.debug(`First match: id=${firstMatch.id}, score=${firstMatch.score}`);
      logger.debug(`First match metadata type: ${typeof firstMatch.metadata}`);
      logger.debug(`First match metadata: ${JSON.stringify(firstMatch.metadata).substring(0, 200)}`);
    }
    
    const filteredMatches = options.minScore
      ? matches.filter(match => match.score && match.score >= options.minScore!)
      : matches;

    logger.debug(`After score filtering: ${filteredMatches.length} matches`);

    const mappedResults = filteredMatches.map(match => {
      const metadata = match.metadata || {};
      
      return {
        id: match.id,
        score: match.score || 0,
        metadata: metadata as any,
      };
    });
    
    // DEBUG: Check what we're returning
    if (mappedResults.length > 0) {
      logger.debug(`Returning first result: id=${mappedResults[0].id}`);
      logger.debug(`Returning metadata keys: ${Object.keys(mappedResults[0].metadata || {}).join(', ')}`);
      logger.debug(`Has text in return: ${!!mappedResults[0].metadata?.text}`);
    }
    
    return mappedResults;
  } catch (error) {
    logger.error('Vector search failed:', error);
    throw new Error(`Vector search failed: ${error}`);
  }
}

/**
 * Search with automatic query embedding
 */
export async function searchByQuery(
  query: string,
  apiKey: string,
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const embedding = await generateQueryEmbedding(query, apiKey);
  return searchVectors(embedding, options);
}
