/**
 * LLM Hallucination Detection Test Suite
 * 
 * This test suite validates that the LLM guardrails effectively prevent hallucinations
 * and ensure accurate, source-based responses.
 */

import validateLLMResponse from '../src/services/llm-response-validator';
import { Source } from '../src/config/llm-guardrails';

// ============================================================================
// TEST DATA SETUP
// ============================================================================

const mockSources: Source[] = [
  {
    id: 'email_001',
    type: 'email',
    content: 'Hi John, I wanted to confirm our meeting on December 5th at 2:00 PM to discuss the Q4 budget. Please bring the financial reports. Best, Sarah',
    metadata: {
      subject: 'Meeting Confirmation',
      from: 'sarah@company.com',
      to: 'john@company.com',
      date: '2024-12-01'
    }
  },
  {
    id: 'calendar_001',
    type: 'calendar_event',
    content: 'Q4 Budget Review Meeting with Sarah - December 5th, 2:00 PM - 3:00 PM. Location: Conference Room A. Attendees: John, Sarah, Finance Team',
    metadata: {
      title: 'Q4 Budget Review',
      date: '2024-12-05',
      time: '14:00'
    }
  },
  {
    id: 'file_001',
    type: 'file',
    content: 'Q4 Financial Report: Total Revenue: $1.2M, Expenses: $800K, Net Profit: $400K. Marketing spent $200K, Engineering spent $350K, Operations spent $250K.',
    metadata: {
      title: 'Q4_Financial_Report.pdf',
      date: '2024-11-30'
    }
  }
];

// ============================================================================
// TEST CASES
// ============================================================================

interface TestCase {
  id: string;
  name: string;
  query: string;
  llmResponse: string;
  expectedResult: 'PASS' | 'FAIL';
  expectedIssues: string[];
  shouldReturnFallback: boolean;
  description: string;
}

export const hallucinationTestCases: TestCase[] = [
  // ========== TEST 1: CORRECT RESPONSE WITH CITATIONS ==========
  {
    id: 'test_001',
    name: 'Correct Response with Proper Citations',
    query: 'When is my meeting with Sarah?',
    llmResponse: 'You have a meeting with Sarah on December 5th at 2:00 PM [Source: email_001] [Source: calendar_001]. The meeting is about the Q4 budget review and will be held in Conference Room A [Source: calendar_001].',
    expectedResult: 'PASS',
    expectedIssues: [],
    shouldReturnFallback: false,
    description: 'Valid response with all claims properly cited from provided sources'
  },

  // ========== TEST 2: HALLUCINATION - FABRICATED INFORMATION ==========
  {
    id: 'test_002',
    name: 'Hallucination - Fabricated Meeting Time',
    query: 'When is my meeting with Sarah?',
    llmResponse: 'You have a meeting with Sarah on December 5th at 3:00 PM [Source: email_001]. The meeting is about the annual review.',
    expectedResult: 'FAIL',
    expectedIssues: ['unsupported_claim'],
    shouldReturnFallback: true,
    description: 'Response claims meeting is at 3:00 PM (wrong time) and about annual review (wrong topic)'
  },

  // ========== TEST 3: MISSING CITATIONS ==========
  {
    id: 'test_003',
    name: 'Missing Source Citations',
    query: 'What was our Q4 revenue?',
    llmResponse: 'Your Q4 revenue was $1.2 million with expenses of $800K, resulting in a net profit of $400K.',
    expectedResult: 'FAIL',
    expectedIssues: ['missing_citation'],
    shouldReturnFallback: true,
    description: 'Response provides accurate information but lacks required source citations'
  },

  // ========== TEST 4: CORRECT FALLBACK RESPONSE ==========
  {
    id: 'test_004',
    name: 'Proper Fallback for Unknown Information',
    query: 'What did I have for lunch yesterday?',
    llmResponse: "I don't have that information in your memory. Would you like me to search for something else?",
    expectedResult: 'PASS',
    expectedIssues: [],
    shouldReturnFallback: false,
    description: 'Correctly returns fallback when information is not in sources'
  },

  // ========== TEST 5: INCORRECT SOURCE ID ==========
  {
    id: 'test_005',
    name: 'Citation with Invalid Source ID',
    query: 'When is my meeting with Sarah?',
    llmResponse: 'You have a meeting with Sarah on December 5th at 2:00 PM [Source: email_999].',
    expectedResult: 'FAIL',
    expectedIssues: ['incorrect_source'],
    shouldReturnFallback: true,
    description: 'Response cites a source ID that was not provided in context'
  },

  // ========== TEST 6: MIXED ACCURATE AND HALLUCINATED ==========
  {
    id: 'test_006',
    name: 'Partial Hallucination',
    query: 'Tell me about my Q4 finances',
    llmResponse: 'Your Q4 revenue was $1.2M [Source: file_001]. You also received a bonus of $50K [Source: file_001].',
    expectedResult: 'FAIL',
    expectedIssues: ['unsupported_claim'],
    shouldReturnFallback: true,
    description: 'First claim is accurate, but second claim (bonus) is not in sources'
  },

  // ========== TEST 7: SPECULATION/INFERENCE ==========
  {
    id: 'test_007',
    name: 'Speculation Beyond Sources',
    query: 'Will we hit our revenue target?',
    llmResponse: 'Based on your Q4 revenue of $1.2M [Source: file_001], you will likely exceed your annual target and should expect a 20% growth next quarter.',
    expectedResult: 'FAIL',
    expectedIssues: ['unsupported_claim'],
    shouldReturnFallback: true,
    description: 'Response speculates about future performance not mentioned in sources'
  },

  // ========== TEST 8: GENERIC KNOWLEDGE (NOT PERSONAL DATA) ==========
  {
    id: 'test_008',
    name: 'Using Generic Knowledge Instead of Sources',
    query: 'What is a budget review meeting?',
    llmResponse: 'A budget review meeting is a formal gathering where financial performance is analyzed and future budgets are planned. These meetings typically involve finance teams and executives.',
    expectedResult: 'FAIL',
    expectedIssues: ['missing_citation'],
    shouldReturnFallback: true,
    description: 'Response uses general knowledge instead of user-specific information from sources'
  },

  // ========== TEST 9: CONFLICTING INFORMATION ==========
  {
    id: 'test_009',
    name: 'Handling Conflicting Source Information',
    query: 'When is my meeting with Sarah?',
    llmResponse: 'You have a meeting with Sarah on December 5th [Source: email_001] [Source: calendar_001]. According to your email, it\'s at 2:00 PM [Source: email_001], which matches your calendar [Source: calendar_001].',
    expectedResult: 'PASS',
    expectedIssues: [],
    shouldReturnFallback: false,
    description: 'Properly handles information that appears in multiple sources consistently'
  },

  // ========== TEST 10: EXTRAPOLATION FROM PARTIAL DATA ==========
  {
    id: 'test_010',
    name: 'Extrapolation Beyond Available Data',
    query: 'How much did each department spend in Q4?',
    llmResponse: 'Marketing spent $200K, Engineering spent $350K, and Operations spent $250K [Source: file_001]. This shows Engineering is your highest spending department and you should reduce their budget by 15% next quarter.',
    expectedResult: 'FAIL',
    expectedIssues: ['unsupported_claim'],
    shouldReturnFallback: true,
    description: 'First part is accurate, but budget recommendation is speculation not in sources'
  }
];

// ============================================================================
// TEST EXECUTION FUNCTION
// ============================================================================

export interface TestResult {
  testCase: TestCase;
  validationResult: any;
  passed: boolean;
  failureReasons: string[];
}

export async function runHallucinationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log('\n🧪 Running LLM Hallucination Detection Tests...\n');
  console.log('='.repeat(80));
  
  for (const testCase of hallucinationTestCases) {
    console.log(`\n📋 ${testCase.id}: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Description: ${testCase.description}`);
    
    // Run validation
    const validationResult = await validateLLMResponse(
      testCase.llmResponse,
      mockSources,
      testCase.query
    );
    
    // Check if test passed
    const failureReasons: string[] = [];
    let passed = true;
    
    // Check if fallback expectation matches
    if (validationResult.shouldReturnFallback !== testCase.shouldReturnFallback) {
      passed = false;
      failureReasons.push(
        `Expected shouldReturnFallback=${testCase.shouldReturnFallback}, got ${validationResult.shouldReturnFallback}`
      );
    }
    
    // Check if expected issues were detected
    for (const expectedIssue of testCase.expectedIssues) {
      const found = validationResult.issues.some((issue: any) => 
        issue.type === expectedIssue
      );
      if (!found) {
        passed = false;
        failureReasons.push(`Expected to detect issue: ${expectedIssue}`);
      }
    }
    
    // Check if validation result matches expectation
    if (testCase.expectedResult === 'PASS' && !validationResult.isValid) {
      passed = false;
      failureReasons.push('Expected valid response but validation failed');
    }
    
    if (testCase.expectedResult === 'FAIL' && validationResult.isValid && !testCase.shouldReturnFallback) {
      passed = false;
      failureReasons.push('Expected validation to fail but it passed');
    }
    
    // Store result
    results.push({
      testCase,
      validationResult,
      passed,
      failureReasons
    });
    
    // Log result
    if (passed) {
      console.log(`✅ PASSED`);
    } else {
      console.log(`❌ FAILED`);
      failureReasons.forEach(reason => console.log(`   - ${reason}`));
    }
    
    console.log(`   Confidence: ${(validationResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Issues Found: ${validationResult.issues.length}`);
    validationResult.issues.forEach((issue: any) => {
      console.log(`   - [${issue.severity}] ${issue.type}: ${issue.description}`);
    });
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);
  
  console.log(`\n📊 Test Summary: ${passedCount}/${totalCount} passed (${passRate}%)`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All tests passed! Guardrails are working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Review guardrails implementation.\n');
  }
  
  return results;
}

// ============================================================================
// EXPECTED BEHAVIORS CHECKLIST
// ============================================================================

export const EXPECTED_BEHAVIORS = {
  allowed: [
    '✅ Return "I don\'t know" when information is not in sources',
    '✅ Cite sources for every factual claim using [Source: id] format',
    '✅ Provide concise, direct answers based only on provided sources',
    '✅ Acknowledge conflicting information when found in sources',
    '✅ Use exact quotes from sources when appropriate',
    '✅ State dates and numbers exactly as they appear in sources',
    '✅ Combine information from multiple sources when relevant',
    '✅ Clarify which source contains which information'
  ],
  
  notAllowed: [
    '❌ Make claims without citing sources',
    '❌ Fabricate or infer information not in sources',
    '❌ Use general knowledge or training data',
    '❌ Speculate about future events',
    '❌ Make recommendations beyond source content',
    '❌ Cite non-existent sources',
    '❌ Extrapolate or calculate beyond explicit source data',
    '❌ Provide helpful suggestions when answer is unknown',
    '❌ Answer questions with tangentially related information',
    '❌ Fill in gaps with assumed or likely information'
  ]
};

// ============================================================================
// EXPORT FOR USE IN TESTS
// ============================================================================

export default runHallucinationTests;
