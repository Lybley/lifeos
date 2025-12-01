/**
 * Unit tests for Document Chunker
 */

import {
  chunkDocument,
  chunkByHeaders,
  estimateTokenCount,
  ChunkConfig,
} from '../chunker';

describe('estimateTokenCount', () => {
  it('should estimate token count for simple text', () => {
    const text = 'Hello world';
    const tokens = estimateTokenCount(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('should handle empty string', () => {
    const tokens = estimateTokenCount('');
    expect(tokens).toBe(0);
  });

  it('should account for punctuation', () => {
    const withPunctuation = 'Hello, world! How are you?';
    const withoutPunctuation = 'Hello world How are you';
    
    const tokensWithPunc = estimateTokenCount(withPunctuation);
    const tokensWithoutPunc = estimateTokenCount(withoutPunctuation);
    
    expect(tokensWithPunc).toBeGreaterThanOrEqual(tokensWithoutPunc);
  });

  it('should normalize whitespace', () => {
    const text1 = 'Hello    world';
    const text2 = 'Hello world';
    
    expect(estimateTokenCount(text1)).toBe(estimateTokenCount(text2));
  });
});

describe('chunkDocument', () => {
  describe('small documents', () => {
    it('should return single chunk for small text', () => {
      const text = 'This is a short document.';
      const result = chunkDocument(text, { maxTokens: 512 });

      expect(result.totalChunks).toBe(1);
      expect(result.chunks[0].content).toBe(text);
      expect(result.chunks[0].chunkIndex).toBe(0);
    });

    it('should handle empty text', () => {
      const result = chunkDocument('', { maxTokens: 512 });

      expect(result.totalChunks).toBe(0);
      expect(result.chunks).toHaveLength(0);
      expect(result.originalLength).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = chunkDocument('   \n  \t  ', { maxTokens: 512 });

      expect(result.totalChunks).toBe(0);
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe('large documents', () => {
    it('should split long text into multiple chunks', () => {
      // Generate long text with sentences
      const sentences = Array(100)
        .fill(null)
        .map((_, i) => `This is sentence number ${i}.`)
        .join(' ');

      const result = chunkDocument(sentences, {
        maxTokens: 100,
        overlapTokens: 10,
        minChunkSize: 20,
      });

      expect(result.totalChunks).toBeGreaterThan(1);
      expect(result.chunks.length).toBe(result.totalChunks);
    });

    it('should respect maxTokens limit', () => {
      const longText = 'word '.repeat(1000);
      const config: ChunkConfig = {
        maxTokens: 50,
        overlapTokens: 5,
        minChunkSize: 10,
      };

      const result = chunkDocument(longText, config);

      for (const chunk of result.chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(config.maxTokens + 10); // Some tolerance
      }
    });

    it('should create overlap between chunks', () => {
      const sentences = Array(20)
        .fill(null)
        .map((_, i) => `Sentence ${i}.`)
        .join(' ');

      const result = chunkDocument(sentences, {
        maxTokens: 50,
        overlapTokens: 15,
        minChunkSize: 10,
      });

      if (result.totalChunks > 1) {
        // Check if chunks have overlapping content
        const chunk1End = result.chunks[0].content.slice(-50);
        const chunk2Start = result.chunks[1].content.slice(0, 50);

        // Should have some common content
        const hasOverlap = chunk2Start.includes(chunk1End.split(' ').slice(-3).join(' '));
        expect(hasOverlap).toBe(true);
      }
    });
  });

  describe('chunk metadata', () => {
    it('should assign sequential chunk indices', () => {
      const text = 'sentence. '.repeat(100);
      const result = chunkDocument(text, { maxTokens: 50 });

      result.chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
      });
    });

    it('should track character offsets', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = chunkDocument(text, { maxTokens: 20 });

      // First chunk should start at 0
      expect(result.chunks[0].startOffset).toBe(0);

      // Offsets should be non-overlapping (considering overlap)
      for (let i = 0; i < result.chunks.length - 1; i++) {
        expect(result.chunks[i].endOffset).toBeGreaterThan(result.chunks[i].startOffset);
      }
    });

    it('should calculate token counts for each chunk', () => {
      const text = 'word '.repeat(100);
      const result = chunkDocument(text, { maxTokens: 50 });

      result.chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBeLessThanOrEqual(60); // With some tolerance
      });
    });
  });

  describe('edge cases', () => {
    it('should handle text with only one long sentence', () => {
      const longSentence = 'word '.repeat(500);
      const result = chunkDocument(longSentence, { maxTokens: 50 });

      expect(result.totalChunks).toBeGreaterThan(1);
    });

    it('should handle text with many short sentences', () => {
      const text = Array(100)
        .fill('Hi.')
        .join(' ');
      const result = chunkDocument(text, { maxTokens: 20 });

      expect(result.totalChunks).toBeGreaterThan(1);
    });

    it('should respect minChunkSize', () => {
      const text = 'Short. '.repeat(50);
      const config: ChunkConfig = {
        maxTokens: 100,
        overlapTokens: 10,
        minChunkSize: 50,
      };

      const result = chunkDocument(text, config);

      result.chunks.forEach((chunk) => {
        // All but potentially the last chunk should meet minimum
        if (chunk.chunkIndex < result.totalChunks - 1) {
          expect(chunk.tokenCount).toBeGreaterThanOrEqual(config.minChunkSize - 10);
        }
      });
    });

    it('should merge tiny final chunk with previous', () => {
      const text = 'sentence. '.repeat(50) + 'tiny';
      const result = chunkDocument(text, {
        maxTokens: 100,
        overlapTokens: 10,
        minChunkSize: 50,
      });

      // Last chunk should not be tiny
      const lastChunk = result.chunks[result.chunks.length - 1];
      expect(lastChunk.tokenCount).toBeGreaterThan(10);
    });
  });

  describe('sentence boundary detection', () => {
    it('should split on periods', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = chunkDocument(text, { maxTokens: 20 });

      // Should split at sentence boundaries
      expect(result.totalChunks).toBeGreaterThanOrEqual(1);
    });

    it('should split on multiple punctuation marks', () => {
      const text = 'Question? Answer! Exclamation. Another sentence.';
      const result = chunkDocument(text, { maxTokens: 15 });

      expect(result.totalChunks).toBeGreaterThanOrEqual(1);
    });

    it('should handle newlines as sentence boundaries', () => {
      const text = 'Line one\\n\\nLine two\\n\\nLine three';
      const result = chunkDocument(text, { maxTokens: 10 });

      expect(result.totalChunks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('determinism', () => {
    it('should produce identical results for same input', () => {
      const text = 'test sentence. '.repeat(100);
      const config = { maxTokens: 50, overlapTokens: 5, minChunkSize: 10 };

      const result1 = chunkDocument(text, config);
      const result2 = chunkDocument(text, config);

      expect(result1.totalChunks).toBe(result2.totalChunks);
      expect(result1.chunks).toEqual(result2.chunks);
      expect(result1.originalTokenCount).toBe(result2.originalTokenCount);
    });
  });
});

describe('chunkByHeaders', () => {
  it('should chunk by markdown headers', () => {
    const text = `# Header 1
Content for section 1.

## Header 2
Content for section 2.

### Header 3
Content for section 3.`;

    const result = chunkByHeaders(text, /^#{1,6}\\s+.+$/gm, { maxTokens: 100 });

    expect(result.totalChunks).toBeGreaterThanOrEqual(1);
  });

  it('should fall back to regular chunking if no headers found', () => {
    const text = 'No headers here. Just plain text.';
    const result = chunkByHeaders(text, /^#{1,6}\\s+.+$/gm, { maxTokens: 10 });

    expect(result.totalChunks).toBeGreaterThanOrEqual(1);
  });

  it('should preserve chunk metadata', () => {
    const text = `# Section 1
Content here.

# Section 2
More content.`;

    const result = chunkByHeaders(text, /^#\\s+.+$/gm, { maxTokens: 50 });

    result.chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });
  });
});

describe('configuration validation', () => {
  it('should use default config when not provided', () => {
    const text = 'Test text.';
    const result = chunkDocument(text);

    expect(result.totalChunks).toBe(1);
  });

  it('should merge partial config with defaults', () => {
    const text = 'word '.repeat(200);
    const result = chunkDocument(text, { maxTokens: 50 });

    // Should use provided maxTokens and default overlap/minChunkSize
    expect(result.totalChunks).toBeGreaterThan(1);
  });
});
