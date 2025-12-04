# LLM Guardrails Implementation Guide

Complete guide for implementing and testing LLM guardrails to prevent hallucinations in LifeOS.

---

## 📋 Overview

The LLM Guardrails system ensures that all AI-generated responses are:
- **Accurate**: Only use information from provided sources
- **Cited**: Every claim references its source
- **Verified**: Post-processing validates responses
- **Safe**: Fallback to "I don't know" when uncertain

---

## 🏗️ Architecture

```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Vector Search   │ ← Retrieve relevant sources
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Build Prompt    │ ← System prompt + sources + query
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ LLM Generation  │ ← Low temperature, strict instructions
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Validation      │ ← Check citations, verify claims
└──────┬──────────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
Pass    Fail
   │       │
   │       ▼
   │   ┌──────────────┐
   │   │ Return       │
   │   │ Fallback     │
   │   └──────────────┘
   │
   ▼
┌─────────────┐
│ Return      │
│ Response    │
└─────────────┘
```

---

## 🎯 Key Components

### 1. System Prompt Template

**Location**: `/app/backend/src/config/llm-guardrails.ts`

**Key Features**:
- ✅ Explicit instruction to ONLY use provided sources
- ✅ Mandatory source citation format: `[Source: source_id]`
- ✅ Clear fallback behavior for unknown information
- ✅ No speculation or inference allowed
- ✅ No generic knowledge from training data

**Critical Rules**:
1. **Source-Only**: Can only answer using provided sources
2. **Cite Everything**: Every claim must have `[Source: id]`
3. **Fallback First**: Unknown = "I don't know"
4. **No Guessing**: Never infer or speculate
5. **No Generic Facts**: No training data knowledge
6. **Conflict Handling**: Explicitly state conflicts
7. **Date Awareness**: Use current date for relative queries

### 2. LLM Configuration

**Environment-Specific Settings**:

| Environment | Temperature | Max Tokens | Purpose |
|-------------|-------------|------------|---------|
| **Production** | 0.1 | 300 | Maximum accuracy, minimal creativity |
| **Development** | 0.2 | 500 | Slightly flexible for testing |
| **Testing** | 0.0 | 300 | Fully deterministic outputs |

**Why Low Temperature?**
- Temperature 0.1-0.2 minimizes hallucinations
- Focuses on high-probability, factual outputs
- Reduces creative "filling in gaps" behavior

### 3. Response Validator

**Location**: `/app/backend/src/services/llm-response-validator.ts`

**Validation Steps**:

1. **Check Fallback**: Is this an expected "I don't know" response?
2. **Extract Citations**: Find all `[Source: id]` references
3. **Validate Citations**: Ensure all cited sources exist
4. **Extract Claims**: Break response into factual statements
5. **Verify Claims**: Check each claim against source content
6. **Check Coverage**: Ensure adequate citation coverage
7. **Calculate Confidence**: Score based on issues found
8. **Return Result**: Pass/Fail with corrective action

**Validation Issues Detected**:
- `missing_citation` - Claims without source references
- `unsupported_claim` - Claims not found in sources
- `incorrect_source` - Citations to non-existent sources
- `hallucination` - Fabricated information

**Severity Levels**:
- **Critical**: Response must be replaced with fallback
- **High**: Major accuracy concerns
- **Medium**: Minor issues, response may be acceptable
- **Low**: Informational warnings

### 4. Test Suite

**Location**: `/app/backend/tests/llm-hallucination-tests.ts`

**10 Test Cases**:
1. ✅ Correct response with proper citations
2. ❌ Hallucination - fabricated information
3. ❌ Missing source citations
4. ✅ Proper fallback for unknown info
5. ❌ Citation with invalid source ID
6. ❌ Partial hallucination (mixed accurate/fake)
7. ❌ Speculation beyond sources
8. ❌ Using generic knowledge instead of sources
9. ✅ Handling conflicting information
10. ❌ Extrapolation beyond available data

---

## 🚀 Usage Guide

### Basic Integration

```typescript
import RAGServiceWithGuardrails from './services/rag-with-guardrails.example';

const ragService = new RAGServiceWithGuardrails();

// Query with guardrails
const result = await ragService.query(
  'When is my meeting with Sarah?',
  retrievedSources,
  {
    validateResponse: true,
    confidenceThreshold: 0.7
  }
);

// Check result
if (result.metadata.confidence < 0.7) {
  // Handle low confidence
  console.warn('Low confidence response');
}
```

### API Route Integration

```typescript
import { RAGServiceWithGuardrails } from '../services/rag-with-guardrails.example';

app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  
  // 1. Retrieve relevant sources (vector search)
  const sources = await vectorSearch(query);
  
  // 2. Query with guardrails
  const ragService = new RAGServiceWithGuardrails();
  const result = await ragService.query(query, sources);
  
  // 3. Return response with metadata
  res.json({
    response: result.response,
    sources: result.sources,
    confidence: result.metadata.confidence,
    validated: result.metadata.validated
  });
});
```

---

## 🧪 Testing

### Run Test Suite

```bash
cd /app/backend

# Install dependencies if needed
npm install

# Run hallucination tests
npx ts-node tests/llm-hallucination-tests.ts
```

### Expected Output

```
🧪 Running LLM Hallucination Detection Tests...
================================================================================

📋 test_001: Correct Response with Proper Citations
Query: "When is my meeting with Sarah?"
Description: Valid response with all claims properly cited
✅ PASSED
   Confidence: 95.0%
   Issues Found: 0

📋 test_002: Hallucination - Fabricated Meeting Time
Query: "When is my meeting with Sarah?"
Description: Response claims wrong time and topic
❌ FAILED (Expected - hallucination detected)
   Confidence: 40.0%
   Issues Found: 2
   - [high] unsupported_claim: Claim not found in cited sources

...

📊 Test Summary: 10/10 passed (100.0%)
🎉 All tests passed! Guardrails are working correctly.
```

### Manual Testing Checklist

Test each scenario manually:

- [ ] Ask question with answer in sources → Response with citations
- [ ] Ask question NOT in sources → "I don't know" fallback
- [ ] Modify mock LLM to fabricate info → Validator catches it
- [ ] Remove citations from response → Validator flags missing citations
- [ ] Use invalid source ID → Validator catches incorrect source
- [ ] Ask for speculation → Validator prevents or fallback returned
- [ ] Ask for generic knowledge → Validator prevents or fallback returned
- [ ] Complex multi-source query → Proper synthesis with all citations
- [ ] Ambiguous query → Clear handling or request for clarification
- [ ] Edge case: Empty sources → Graceful fallback

---

## 📊 Monitoring & Metrics

### Key Metrics to Track

```typescript
// In production, log these metrics
{
  query: string,
  responseTime: number,
  validated: boolean,
  confidence: number,
  issueCount: number,
  issueTypes: string[],
  fallbackReturned: boolean,
  sourceCount: number,
  citationCount: number
}
```

### Alerting Thresholds

- **Critical**: Confidence < 0.5 for > 10% of queries
- **Warning**: Average confidence < 0.7
- **Info**: Fallback rate > 20%

### Dashboard Metrics

1. **Hallucination Rate**: % of responses with critical issues
2. **Fallback Rate**: % of queries returning "I don't know"
3. **Average Confidence**: Mean confidence score
4. **Citation Coverage**: % of claims with citations
5. **Validation Failure Rate**: % of responses failing validation

---

## 🔧 Configuration

### Adjusting Confidence Threshold

```typescript
// Stricter validation (fewer false positives)
const result = await ragService.query(query, sources, {
  confidenceThreshold: 0.8  // Default: 0.7
});

// More lenient (allow borderline responses)
const result = await ragService.query(query, sources, {
  confidenceThreshold: 0.6
});
```

### Adjusting LLM Temperature

```typescript
// In llm-guardrails.ts
export const LLM_CONFIGS = {
  production: {
    temperature: 0.05,  // Even more conservative
    // ...
  }
};
```

### Custom Fallback Messages

```typescript
// In llm-guardrails.ts
export const FALLBACK_RESPONSES = {
  noInformation: "I couldn't find that in your data. Try rephrasing?",
  // Add custom fallbacks...
};
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: Too Many Fallbacks

**Symptom**: High rate of "I don't know" responses

**Possible Causes**:
- Confidence threshold too high
- Vector search not retrieving relevant sources
- System prompt too restrictive

**Solutions**:
- Lower confidence threshold (0.6 instead of 0.7)
- Improve vector search quality
- Verify source formatting is correct

### Issue 2: Hallucinations Still Occurring

**Symptom**: Validator passing false information

**Possible Causes**:
- Claim verification too lenient (60% match ratio)
- Temperature too high
- System prompt not being followed

**Solutions**:
- Increase match ratio to 70-80%
- Lower temperature to 0.05
- Add more examples to system prompt
- Use stricter confidence threshold

### Issue 3: Valid Responses Failing Validation

**Symptom**: Accurate responses flagged as invalid

**Possible Causes**:
- Citation format mismatch
- Source content not matching claim structure
- Too strict validation

**Solutions**:
- Verify citation extraction regex
- Improve semantic similarity check
- Use embeddings for claim verification

---

## 🎓 Best Practices

### 1. Always Validate in Production
```typescript
// ✅ Good
const result = await ragService.query(query, sources, {
  validateResponse: true
});

// ❌ Bad
const result = await ragService.query(query, sources, {
  validateResponse: false  // No safety net!
});
```

### 2. Log All Validation Issues
```typescript
if (result.metadata.issues.length > 0) {
  logger.warn('Validation issues detected', {
    query,
    issues: result.metadata.issues,
    confidence: result.metadata.confidence
  });
}
```

### 3. Show Confidence to Users (Optional)
```typescript
// In UI, show confidence indicator
if (result.metadata.confidence < 0.8) {
  return {
    response: result.response,
    disclaimer: "I'm not completely certain about this answer."
  };
}
```

### 4. Run Tests Before Deployment
```bash
# In CI/CD pipeline
npm run test:hallucinations
```

### 5. Monitor Metrics Over Time
- Track hallucination rate weekly
- Alert on degradation
- A/B test prompt improvements

---

## 🔄 Continuous Improvement

### Monthly Review Checklist

- [ ] Review fallback rate - is it increasing?
- [ ] Check average confidence - is it decreasing?
- [ ] Analyze failed validations - any patterns?
- [ ] Review user feedback - any accuracy complaints?
- [ ] Update test cases with new edge cases found
- [ ] Adjust thresholds if needed
- [ ] Consider prompt improvements

### Prompt Iteration Process

1. Identify issue (e.g., hallucinations about dates)
2. Add test case for that specific issue
3. Update system prompt with explicit rule
4. Run test suite - ensure new test passes
5. Deploy to staging
6. Monitor metrics for 48 hours
7. Deploy to production if improved

---

## 📚 Additional Resources

- **OpenAI Best Practices**: https://platform.openai.com/docs/guides/gpt-best-practices
- **Prompt Engineering Guide**: https://www.promptingguide.ai/
- **RAG Best Practices**: Research papers on retrieval-augmented generation
- **LifeOS Monitoring Docs**: `/app/monitoring/MONITORING_ARCHITECTURE.md`

---

## 🆘 Support

If you encounter issues with the guardrails:

1. Check logs for validation errors
2. Run test suite to verify guardrails are working
3. Review `/app/backend/tests/llm-hallucination-tests.ts` for examples
4. Consult this guide for configuration options
5. Contact the development team

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: Production Ready ✅
