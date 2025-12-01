/**
 * Unit tests for Embeddings Service
 */

import {
  MockEmbeddingClient,
  createEmbeddingClient,
  EmbeddingConfig,
} from '../embeddings';

describe('MockEmbeddingClient', () => {
  let client: MockEmbeddingClient;

  beforeEach(() => {
    client = new MockEmbeddingClient({ dimensions: 128 });
  });

  describe('embed', () => {
    it('should generate vector with correct dimensions', async () => {
      const text = 'Test document content';
      const result = await client.embed(text);

      expect(result.vector).toHaveLength(128);
      expect(result.dimensions).toBe(128);
      expect(result.model).toBe('mock-model');
    });

    it('should generate deterministic vectors for same input', async () => {
      const text = 'Same input text';
      const result1 = await client.embed(text);
      const result2 = await client.embed(text);

      expect(result1.vector).toEqual(result2.vector);
    });

    it('should generate different vectors for different inputs', async () => {
      const text1 = 'First text';
      const text2 = 'Second text';
      
      const result1 = await client.embed(text1);
      const result2 = await client.embed(text2);

      expect(result1.vector).not.toEqual(result2.vector);
    });

    it('should generate normalized vectors', async () => {
      const text = 'Test normalization';
      const result = await client.embed(text);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        result.vector.reduce((sum, val) => sum + val * val, 0)
      );

      // Should be close to 1 (normalized)
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should estimate token count', async () => {
      const text = 'This is a test document with multiple words';
      const result = await client.embed(text);

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.tokens).toBeLessThan(text.length);
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First document',
        'Second document',
        'Third document',
      ];

      const result = await client.embedBatch(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.model).toBe('mock-model');
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should handle empty batch', async () => {
      const result = await client.embedBatch([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });

    it('should maintain consistency across batch and single embedding', async () => {
      const text = 'Test consistency';
      
      const singleResult = await client.embed(text);
      const batchResult = await client.embedBatch([text]);

      expect(batchResult.embeddings[0].vector).toEqual(singleResult.vector);
    });
  });

  describe('getDimensions', () => {
    it('should return configured dimensions', () => {
      expect(client.getDimensions()).toBe(128);
    });

    it('should support different dimension sizes', () => {
      const client512 = new MockEmbeddingClient({ dimensions: 512 });
      const client1536 = new MockEmbeddingClient({ dimensions: 1536 });

      expect(client512.getDimensions()).toBe(512);
      expect(client1536.getDimensions()).toBe(1536);
    });
  });
});

describe('createEmbeddingClient', () => {
  it('should create mock client', () => {
    const config: EmbeddingConfig = {
      provider: 'mock',
      model: 'mock-model',
      dimensions: 256,
    };

    const client = createEmbeddingClient(config);

    expect(client).toBeInstanceOf(MockEmbeddingClient);
    expect(client.getDimensions()).toBe(256);
  });

  it('should throw error for unknown provider', () => {
    const config: any = {
      provider: 'unknown',
      model: 'test',
    };

    expect(() => createEmbeddingClient(config)).toThrow('Unknown embedding provider');
  });
});

describe('Vector quality tests', () => {
  let client: MockEmbeddingClient;

  beforeEach(() => {
    client = new MockEmbeddingClient({ dimensions: 256 });
  });

  it('should generate diverse vectors', async () => {
    const texts = [
      'Machine learning',
      'Artificial intelligence',
      'Natural language processing',
    ];

    const embeddings = await client.embedBatch(texts);

    // Calculate pairwise similarities (dot product)
    const similarity01 = embeddings.embeddings[0].vector.reduce(
      (sum, val, i) => sum + val * embeddings.embeddings[1].vector[i],
      0
    );

    const similarity02 = embeddings.embeddings[0].vector.reduce(
      (sum, val, i) => sum + val * embeddings.embeddings[2].vector[i],
      0
    );

    // Vectors should not be identical
    expect(Math.abs(similarity01)).toBeLessThan(0.99);
    expect(Math.abs(similarity02)).toBeLessThan(0.99);
  });

  it('should handle special characters', async () => {
    const texts = [
      'Normal text',
      'Text with émojis 🎉',
      'Special chars: @#$%^&*()',
    ];

    const result = await client.embedBatch(texts);

    expect(result.embeddings).toHaveLength(3);
    result.embeddings.forEach((embedding) => {
      expect(embedding.vector).toHaveLength(256);
    });
  });

  it('should handle very long text', async () => {
    const longText = 'word '.repeat(10000);
    const result = await client.embed(longText);

    expect(result.vector).toHaveLength(256);
    expect(result.tokens).toBeGreaterThan(1000);
  });
});
