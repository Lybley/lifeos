# LLM Guardrails - Quick Reference Card

---

## 🎯 System Prompt (Summary)

```
CRITICAL RULES:
1. ONLY use provided sources
2. CITE all sources: [Source: source_id]
3. Fallback: "I don't have that information"
4. NO speculation or inference
5. NO generic knowledge
6. State conflicts explicitly
```

---

## ⚙️ LLM Configuration

| Setting | Production | Development | Testing |
|---------|-----------|-------------|---------|
| **Temperature** | 0.1 | 0.2 | 0.0 |
| **Max Tokens** | 300 | 500 | 300 |
| **Model** | gpt-4-turbo | gpt-4-turbo | gpt-4-turbo |

---

## 🔍 Validation Checks

1. ✅ Is fallback response?
2. ✅ Extract citations `[Source: id]`
3. ✅ Validate source IDs exist
4. ✅ Extract factual claims
5. ✅ Verify claims in sources
6. ✅ Check citation coverage
7. ✅ Calculate confidence

---

## 🚨 Issue Types

| Type | Severity | Action |
|------|----------|--------|
| `missing_citation` | Medium | Flag, may pass |
| `unsupported_claim` | High | Return fallback |
| `incorrect_source` | Critical | Return fallback |
| `hallucination` | Critical | Return fallback |

---

## 💻 Quick Usage

```typescript
import RAGServiceWithGuardrails from './services/rag-with-guardrails.example';

const ragService = new RAGServiceWithGuardrails();

const result = await ragService.query(
  'Your question here',
  retrievedSources,
  {
    validateResponse: true,
    confidenceThreshold: 0.7
  }
);

// Check confidence
if (result.metadata.confidence < 0.7) {
  console.warn('Low confidence');
}
```

---

## 🧪 Test Commands

```bash
# Run test suite
cd /app/backend
npx ts-node tests/llm-hallucination-tests.ts

# Expected: 10/10 tests pass
```

---

## 📊 Key Metrics

- **Hallucination Rate**: < 5%
- **Fallback Rate**: 10-20%
- **Avg Confidence**: > 0.75
- **Citation Coverage**: > 90%

---

## ⚠️ Common Issues

| Symptom | Fix |
|---------|-----|
| Too many fallbacks | Lower threshold to 0.6 |
| Hallucinations passing | Increase match ratio, lower temp |
| Valid responses failing | Check citation format |

---

## ✅ Allowed Behaviors

- ✅ "I don't know" when no source
- ✅ Cite every claim
- ✅ Combine multiple sources
- ✅ State conflicts

## ❌ Not Allowed

- ❌ Claims without citations
- ❌ Fabricate information
- ❌ Use generic knowledge
- ❌ Speculate
- ❌ Make recommendations

---

## 🔧 Quick Config Changes

**Stricter Validation**:
```typescript
confidenceThreshold: 0.8  // Default: 0.7
```

**More Conservative LLM**:
```typescript
temperature: 0.05  // Default: 0.1
```

**Stricter Claim Verification**:
```typescript
// In llm-response-validator.ts
const matchRatio = 0.7;  // Default: 0.6
```

---

## 📁 File Locations

```
/app/backend/src/config/llm-guardrails.ts         # System prompt & config
/app/backend/src/services/llm-response-validator.ts  # Validation logic
/app/backend/tests/llm-hallucination-tests.ts     # Test suite
/app/backend/src/services/rag-with-guardrails.example.ts  # Usage example
/app/docs/LLM_GUARDRAILS_GUIDE.md                 # Full documentation
```

---

## 🚀 Integration Checklist

- [ ] Import guardrails config
- [ ] Build prompt with sources
- [ ] Use environment-specific LLM config
- [ ] Query LLM
- [ ] Validate response
- [ ] Check confidence threshold
- [ ] Return response or fallback
- [ ] Log metrics

---

**For full documentation, see**: `/app/docs/LLM_GUARDRAILS_GUIDE.md`
