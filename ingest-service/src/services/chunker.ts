/**
 * Document Chunker Service
 * 
 * Splits long documents into smaller chunks with configurable overlap
 * for better embeddings and retrieval performance.
 */

export interface ChunkConfig {
  maxTokens: number;        // Maximum tokens per chunk
  overlapTokens: number;    // Overlap between chunks
  minChunkSize: number;     // Minimum chunk size to avoid tiny fragments
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

export interface ChunkedDocument {
  chunks: DocumentChunk[];
  totalChunks: number;
  originalLength: number;
  originalTokenCount: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  maxTokens: 512,
  overlapTokens: 50,
  minChunkSize: 100,
};

/**
 * Estimate token count using a simple heuristic
 * 1 token ≈ 4 characters for English text
 * More accurate than character count, less expensive than tiktoken
 */
export function estimateTokenCount(text: string): number {
  // Remove extra whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  // Rough estimation: 1 token ≈ 4 characters
  // Adjust for common patterns
  const baseTokens = Math.ceil(normalized.length / 4);
  
  // Add tokens for punctuation and special characters
  const punctuationCount = (normalized.match(/[.,!?;:]/g) || []).length;
  
  return baseTokens + Math.ceil(punctuationCount * 0.5);
}

/**
 * Split text into sentences for better chunk boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Regex to split on sentence boundaries while preserving the delimiter
  const sentenceRegex = /([.!?]+[\s\n]+|[\n]{2,})/;
  
  const parts = text.split(sentenceRegex);
  const sentences: string[] = [];
  
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i];
    const delimiter = parts[i + 1] || '';
    
    if (sentence.trim()) {
      sentences.push(sentence + delimiter);
    }
  }
  
  return sentences;
}

/**
 * Chunk a document into overlapping segments
 * 
 * Algorithm:
 * 1. Split document into sentences
 * 2. Build chunks by adding sentences until token limit
 * 3. Add overlap from previous chunk for context continuity
 * 4. Ensure minimum chunk size to avoid fragments
 * 
 * @param text - The document text to chunk
 * @param config - Chunking configuration
 * @returns ChunkedDocument with metadata
 */
export function chunkDocument(
  text: string,
  config: Partial<ChunkConfig> = {}
): ChunkedDocument {
  const cfg: ChunkConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Normalize text
  const normalizedText = text.trim();
  
  if (!normalizedText) {
    return {
      chunks: [],
      totalChunks: 0,
      originalLength: 0,
      originalTokenCount: 0,
    };
  }
  
  const originalTokenCount = estimateTokenCount(normalizedText);
  
  // If document is small enough, return as single chunk
  if (originalTokenCount <= cfg.maxTokens) {
    return {
      chunks: [{
        chunkIndex: 0,
        content: normalizedText,
        tokenCount: originalTokenCount,
        startOffset: 0,
        endOffset: normalizedText.length,
      }],
      totalChunks: 1,
      originalLength: normalizedText.length,
      originalTokenCount,
    };
  }
  
  // Split into sentences
  const sentences = splitIntoSentences(normalizedText);
  
  const chunks: DocumentChunk[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let overlapSentences: string[] = [];
  let charOffset = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);
    
    // Check if adding this sentence would exceed limit
    if (currentTokens + sentenceTokens > cfg.maxTokens && currentChunk.length > 0) {
      // Save current chunk
      const chunkContent = currentChunk.join('');
      const chunkTokenCount = estimateTokenCount(chunkContent);
      
      chunks.push({
        chunkIndex: chunks.length,
        content: chunkContent,
        tokenCount: chunkTokenCount,
        startOffset: charOffset,
        endOffset: charOffset + chunkContent.length,
      });
      
      // Calculate overlap
      // Take last N sentences that fit within overlap token limit
      const overlapCandidates: string[] = [];
      let overlapTokenCount = 0;
      
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const candidateSentence = currentChunk[j];
        const candidateTokens = estimateTokenCount(candidateSentence);
        
        if (overlapTokenCount + candidateTokens <= cfg.overlapTokens) {
          overlapCandidates.unshift(candidateSentence);
          overlapTokenCount += candidateTokens;
        } else {
          break;
        }
      }
      
      // Move character offset forward (minus overlap)
      charOffset += chunkContent.length - overlapCandidates.join('').length;
      
      // Start new chunk with overlap
      currentChunk = [...overlapCandidates];
      currentTokens = overlapTokenCount;
      overlapSentences = [...overlapCandidates];
    }
    
    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }
  
  // Add final chunk if it meets minimum size
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('');
    const chunkTokenCount = estimateTokenCount(chunkContent);
    
    // Only add if it meets minimum size or is the only chunk
    if (chunkTokenCount >= cfg.minChunkSize || chunks.length === 0) {
      chunks.push({
        chunkIndex: chunks.length,
        content: chunkContent,
        tokenCount: chunkTokenCount,
        startOffset: charOffset,
        endOffset: charOffset + chunkContent.length,
      });
    } else {
      // Merge small final chunk with previous chunk if possible
      if (chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content += chunkContent;
        lastChunk.tokenCount = estimateTokenCount(lastChunk.content);
        lastChunk.endOffset = charOffset + chunkContent.length;
      }
    }
  }
  
  return {
    chunks,
    totalChunks: chunks.length,
    originalLength: normalizedText.length,
    originalTokenCount,
  };
}

/**
 * Chunk text with custom separators (for structured documents)
 */
export function chunkByHeaders(
  text: string,
  headerPattern: RegExp = /^#{1,6}\s+.+$/gm,
  config: Partial<ChunkConfig> = {}
): ChunkedDocument {
  const sections: string[] = [];
  const matches = Array.from(text.matchAll(headerPattern));
  
  if (matches.length === 0) {
    // No headers found, use regular chunking
    return chunkDocument(text, config);
  }
  
  let lastIndex = 0;
  
  for (const match of matches) {
    if (match.index !== undefined && match.index > lastIndex) {
      const section = text.substring(lastIndex, match.index);
      if (section.trim()) {
        sections.push(section);
      }
    }
    lastIndex = match.index! + match[0].length;
  }
  
  // Add final section
  if (lastIndex < text.length) {
    const finalSection = text.substring(lastIndex);
    if (finalSection.trim()) {
      sections.push(finalSection);
    }
  }
  
  // Chunk each section independently
  const allChunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  let charOffset = 0;
  
  for (const section of sections) {
    const sectionResult = chunkDocument(section, config);
    
    for (const chunk of sectionResult.chunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: chunkIndex++,
        startOffset: charOffset + chunk.startOffset,
        endOffset: charOffset + chunk.endOffset,
      });
    }
    
    charOffset += section.length;
  }
  
  return {
    chunks: allChunks,
    totalChunks: allChunks.length,
    originalLength: text.length,
    originalTokenCount: estimateTokenCount(text),
  };
}
