/**
 * Embeddings Service - Pluggable architecture
 * 
 * Supports multiple embedding providers:
 * - OpenAI (text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large)
 * - Local models (via Ollama or similar)
 */

import OpenAI from 'openai';
import logger from '../utils/logger';

export interface EmbeddingVector {
  vector: number[];
  model: string;
  dimensions: number;
  tokens?: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingVector[];
  totalTokens: number;
  model: string;
}

export type EmbeddingProvider = 'openai' | 'local' | 'mock';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string; // For local models
  dimensions?: number;
  batchSize?: number;
}

/**
 * Abstract base class for embedding clients
 */
export abstract class EmbeddingClient {
  protected config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  /**
   * Generate embedding for a single text
   */
  abstract embed(text: string): Promise<EmbeddingVector>;

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  abstract embedBatch(texts: string[]): Promise<BatchEmbeddingResult>;

  /**
   * Get the dimension size of embeddings
   */
  abstract getDimensions(): number;

  /**
   * Get the model name
   */
  getModel(): string {
    return this.config.model;
  }
}

/**
 * OpenAI Embedding Client
 */
export class OpenAIEmbeddingClient extends EmbeddingClient {
  private client: OpenAI;
  private dimensions: number;

  constructor(config: EmbeddingConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    // Set dimensions based on model
    this.dimensions = this.getModelDimensions(config.model);
  }

  private getModelDimensions(model: string): number {
    const dimensionsMap: Record<string, number> = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
    };

    return this.config.dimensions || dimensionsMap[model] || 1536;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: text,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0];

      return {
        vector: embedding.embedding,
        model: this.config.model,
        dimensions: this.dimensions,
        tokens: response.usage.total_tokens,
      };
    } catch (error) {
      logger.error('OpenAI embedding failed:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const batchSize = this.config.batchSize || 100;
    const embeddings: EmbeddingVector[] = [];
    let totalTokens = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await this.client.embeddings.create({
          model: this.config.model,
          input: batch,
          dimensions: this.dimensions,
        });

        for (const item of response.data) {
          embeddings.push({
            vector: item.embedding,
            model: this.config.model,
            dimensions: this.dimensions,
          });
        }

        totalTokens += response.usage.total_tokens;

        logger.info(`Processed batch ${i / batchSize + 1}, total embeddings: ${embeddings.length}`);
      } catch (error) {
        logger.error(`Batch embedding failed for batch starting at index ${i}:`, error);
        throw new Error(`Failed to generate batch embeddings: ${error}`);
      }
    }

    return {
      embeddings,
      totalTokens,
      model: this.config.model,
    };
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Local Embedding Client (for Ollama, Llama.cpp, etc.)
 */
export class LocalEmbeddingClient extends EmbeddingClient {
  private baseUrl: string;
  private dimensions: number;

  constructor(config: EmbeddingConfig) {
    super(config);

    if (!config.baseUrl) {
      throw new Error('Base URL is required for local embeddings');
    }

    this.baseUrl = config.baseUrl;
    this.dimensions = config.dimensions || 384; // Common for local models
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        vector: data.embedding,
        model: this.config.model,
        dimensions: data.embedding.length,
      };
    } catch (error) {
      logger.error('Local embedding failed:', error);
      throw new Error(`Failed to generate local embedding: ${error}`);
    }
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    // Local models typically process one at a time
    const embeddings: EmbeddingVector[] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }

    return {
      embeddings,
      totalTokens: 0, // Not tracked for local models
      model: this.config.model,
    };
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Mock Embedding Client (for testing)
 */
export class MockEmbeddingClient extends EmbeddingClient {
  private dimensions: number;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    super({
      provider: 'mock',
      model: 'mock-model',
      dimensions: 1536,
      ...config,
    });
    this.dimensions = config.dimensions || 1536;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    // Generate deterministic mock vector based on text
    const vector = this.generateMockVector(text);

    return {
      vector,
      model: this.config.model,
      dimensions: this.dimensions,
      tokens: Math.ceil(text.length / 4),
    };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings = await Promise.all(texts.map((text) => this.embed(text)));

    return {
      embeddings,
      totalTokens: embeddings.reduce((sum, e) => sum + (e.tokens || 0), 0),
      model: this.config.model,
    };
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private generateMockVector(text: string): number[] {
    // Generate deterministic vector based on text hash
    const hash = this.simpleHash(text);
    const vector: number[] = [];

    for (let i = 0; i < this.dimensions; i++) {
      // Use hash to seed pseudo-random values
      const seed = hash + i;
      vector.push(Math.sin(seed) * 0.5);
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map((val) => val / magnitude);
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Factory function to create embedding client
 */
export function createEmbeddingClient(config: EmbeddingConfig): EmbeddingClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAIEmbeddingClient(config);

    case 'local':
      return new LocalEmbeddingClient(config);

    case 'mock':
      return new MockEmbeddingClient(config);

    default:
      throw new Error(`Unknown embedding provider: ${config.provider}`);
  }
}

/**
 * Get default embedding client from environment
 */
export function getDefaultEmbeddingClient(): EmbeddingClient {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.EMBEDDING_BASE_URL;
  const dimensions = process.env.EMBEDDING_DIMENSIONS
    ? parseInt(process.env.EMBEDDING_DIMENSIONS)
    : undefined;

  return createEmbeddingClient({
    provider,
    model,
    apiKey,
    baseUrl,
    dimensions,
    batchSize: 100,
  });
}
