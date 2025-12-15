/**
 * LLM Response Validator
 * 
 * Post-processing service that validates LLM responses against source documents
 * to detect and prevent hallucinations.
 */

import { Source, FALLBACK_RESPONSES } from '../config/llm-guardrails';
import logger from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  correctedResponse?: string;
  shouldReturnFallback: boolean;
}

export interface ValidationIssue {
  type: 'missing_citation' | 'unsupported_claim' | 'incorrect_source' | 'hallucination';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
}

export interface Claim {
  text: string;
  sourceIds: string[];
  confidence: number;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export async function validateLLMResponse(
  response: string,
  sources: Source[],
  userQuery: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  
  // Step 1: Check if response is a fallback
  if (isFallbackResponse(response)) {
    return {
      isValid: true,
      confidence: 1.0,
      issues: [],
      shouldReturnFallback: false
    };
  }
  
  // Step 2: Extract citations from response
  const citations = extractCitations(response);
  
  // Step 3: Validate citations exist in sources
  const invalidCitations = validateCitations(citations, sources);
  if (invalidCitations.length > 0) {
    issues.push(...invalidCitations);
  }
  
  // Step 4: Extract claims from response
  const claims = extractClaims(response);
  
  // Step 5: Verify each claim against sources
  const claimValidations = await verifyClaims(claims, sources, citations);
  issues.push(...claimValidations.issues);
  
  // Step 6: Check citation coverage
  const citationCoverage = checkCitationCoverage(response, claims.length);
  if (citationCoverage.issue) {
    issues.push(citationCoverage.issue);
  }
  
  // Step 7: Determine if response should be replaced with fallback
  // Only use fallback for critical issues (not high), as high severity can be false positives
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const shouldReturnFallback = criticalIssues.length > 0;
  
  // Step 8: Calculate confidence score
  const confidence = calculateConfidence(issues, claims.length, citations.length);
  
  const result: ValidationResult = {
    isValid: criticalIssues.length === 0,
    confidence,
    issues,
    shouldReturnFallback,
    correctedResponse: shouldReturnFallback ? FALLBACK_RESPONSES.noInformation : undefined
  };
  
  // Log validation results
  logger.info('LLM response validation completed', {
    isValid: result.isValid,
    confidence: result.confidence,
    issueCount: issues.length,
    shouldReturnFallback: result.shouldReturnFallback,
    query: userQuery.substring(0, 100)
  });
  
  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if response is an expected fallback
 */
function isFallbackResponse(response: string): boolean {
  const fallbackPhrases = [
    "I don't have that information",
    "I couldn't find",
    "I don't know",
    "no information available",
    "not found in your memory"
  ];
  
  const lowerResponse = response.toLowerCase();
  return fallbackPhrases.some(phrase => lowerResponse.includes(phrase.toLowerCase()));
}

/**
 * Extract source citations from response
 * Format: [Source: source_id] or [source_id]
 */
function extractCitations(response: string): string[] {
  const citations: string[] = [];
  
  // Match [Source: xyz] or [xyz]
  const citationRegex = /\[(?:Source:\s*)?([^\]]+)\]/g;
  let match;
  
  while ((match = citationRegex.exec(response)) !== null) {
    citations.push(match[1].trim());
  }
  
  return [...new Set(citations)]; // Remove duplicates
}

/**
 * Validate that all cited sources exist
 */
function validateCitations(
  citations: string[],
  sources: Source[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sourceIds = sources.map(s => s.id);
  
  for (const citation of citations) {
    if (!sourceIds.includes(citation)) {
      issues.push({
        type: 'incorrect_source',
        severity: 'critical',
        description: `Response cites source "${citation}" which was not provided in the context`,
        location: citation
      });
    }
  }
  
  return issues;
}

/**
 * Extract factual claims from response
 * This is a simplified version - in production, use NLP for better extraction
 */
function extractClaims(response: string): Claim[] {
  const claims: Claim[] = [];
  
  // Remove citations for claim extraction
  const cleanResponse = response.replace(/\[(?:Source:\s*)?[^\]]+\]/g, '');
  
  // Split by sentences
  const sentences = cleanResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  for (const sentence of sentences) {
    // Extract source IDs mentioned near this sentence in original response
    const sourceIds = extractNearbySourceIds(sentence, response);
    
    claims.push({
      text: sentence.trim(),
      sourceIds,
      confidence: 0 // Will be calculated during verification
    });
  }
  
  return claims;
}

/**
 * Extract source IDs near a specific sentence
 */
function extractNearbySourceIds(sentence: string, fullResponse: string): string[] {
  const sentenceIndex = fullResponse.indexOf(sentence);
  if (sentenceIndex === -1) return [];
  
  // Look 100 chars before and after
  const contextStart = Math.max(0, sentenceIndex - 100);
  const contextEnd = Math.min(fullResponse.length, sentenceIndex + sentence.length + 100);
  const context = fullResponse.substring(contextStart, contextEnd);
  
  return extractCitations(context);
}

/**
 * Verify claims against source content
 */
async function verifyClaims(
  claims: Claim[],
  sources: Source[],
  allCitations: string[]
): Promise<{ issues: ValidationIssue[] }> {
  const issues: ValidationIssue[] = [];
  
  for (const claim of claims) {
    // Skip very short claims (like greetings)
    if (claim.text.length < 20) continue;
    
    // Check if claim has citations
    if (claim.sourceIds.length === 0 && allCitations.length > 0) {
      // If response has citations but this claim doesn't, it might be a problem
      issues.push({
        type: 'missing_citation',
        severity: 'medium',
        description: `Claim lacks source citation: "${claim.text.substring(0, 50)}..."`,
        location: claim.text.substring(0, 50)
      });
      continue;
    }
    
    // Verify claim is supported by cited sources
    let isSupported = false;
    
    for (const sourceId of claim.sourceIds) {
      const source = sources.find(s => s.id === sourceId);
      if (!source) continue;
      
      // Check if claim content appears in source (semantic similarity in production)
      if (isClaimInSource(claim.text, source)) {
        isSupported = true;
        break;
      }
    }
    
    // If claim has citations but not supported by any source
    if (!isSupported && claim.sourceIds.length > 0) {
      issues.push({
        type: 'unsupported_claim',
        severity: 'high',
        description: `Claim not found in cited sources: "${claim.text.substring(0, 50)}..."`,
        location: claim.text.substring(0, 50)
      });
    }
  }
  
  return { issues };
}

/**
 * Check if claim is supported by source content
 * Simplified version - in production, use semantic similarity (embeddings)
 */
function isClaimInSource(claim: string, source: Source): boolean {
  const claimLower = claim.toLowerCase();
  const sourceLower = source.content.toLowerCase();
  
  // Extract key terms from claim (simple word extraction)
  const claimWords = claimLower
    .split(/\s+/)
    .filter(w => w.length > 4) // Only significant words
    .filter(w => !commonWords.includes(w));
  
  // Check if most key terms appear in source
  const matchedWords = claimWords.filter(word => sourceLower.includes(word));
  const matchRatio = matchedWords.length / Math.max(claimWords.length, 1);
  
  // Require at least 60% of key terms to match
  return matchRatio >= 0.6;
}

// Common words to ignore in claim verification
const commonWords = [
  'have', 'this', 'that', 'with', 'from', 'they', 'will', 'would',
  'there', 'their', 'about', 'which', 'when', 'where', 'what',
  'been', 'were', 'said', 'each', 'could', 'should', 'would'
];

/**
 * Check citation coverage - ensure response has adequate citations
 */
function checkCitationCoverage(
  response: string,
  claimCount: number
): { issue?: ValidationIssue } {
  const citations = extractCitations(response);
  
  // If response makes claims but has no citations
  if (claimCount > 2 && citations.length === 0) {
    return {
      issue: {
        type: 'missing_citation',
        severity: 'critical',
        description: 'Response makes multiple claims but provides no source citations',
        location: 'entire response'
      }
    };
  }
  
  return {};
}

/**
 * Calculate confidence score
 */
function calculateConfidence(
  issues: ValidationIssue[],
  claimCount: number,
  citationCount: number
): number {
  let confidence = 1.0;
  
  // Penalize for issues
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        confidence -= 0.4;
        break;
      case 'high':
        confidence -= 0.2;
        break;
      case 'medium':
        confidence -= 0.1;
        break;
      case 'low':
        confidence -= 0.05;
        break;
    }
  }
  
  // Penalize for lack of citations
  if (claimCount > 0 && citationCount === 0) {
    confidence -= 0.3;
  }
  
  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

// ============================================================================
// EXPORT VALIDATION FUNCTION
// ============================================================================

export default validateLLMResponse;
