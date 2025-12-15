#!/usr/bin/env python3
"""
LifeOS RAG Pipeline Detailed Test - Exact Review Request Validation
Tests the exact scenarios specified in the review request
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from review request
BASE_URL = "http://localhost:8000"
TEST_USER_ID = "test-user-123"

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (success, response, error)"""
    try:
        url = f"{BASE_URL}{endpoint}"
        
        if method.upper() == 'GET':
            response = requests.get(url, params=params, timeout=15)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, params=params, timeout=15)
        else:
            return False, None, f"Unsupported method: {method}"
        
        return True, response, None
        
    except requests.exceptions.RequestException as e:
        return False, None, str(e)

def test_exact_basic_rag_query():
    """Test Case 1: Basic RAG Query (MUST PASS) - Exact from review request"""
    print("🎯 Testing EXACT Basic RAG Query from Review Request")
    print("-" * 60)
    
    # Exact payload from review request
    query_data = {
        "user_id": "test-user-123",
        "query": "What are LifeOS features?",
        "top_k": 5,
        "min_score": 0.4,
        "use_cache": False
    }
    
    print(f"POST {BASE_URL}/api/v1/rag/query")
    print(f"Body: {json.dumps(query_data, indent=2)}")
    print()
    
    success, response, error = make_request('POST', '/api/v1/rag/query', data=query_data)
    
    if not success:
        print(f"❌ Request failed: {error}")
        return False
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Expected Status 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    try:
        data = response.json()
        print(f"✅ Status 200 - SUCCESS")
        print()
        
        # Check expected fields from review request
        print("📋 Validating Expected Fields:")
        
        # 1. answer field with actual content (not generic fallback)
        answer = data.get('answer', '')
        if not answer:
            print("❌ Missing 'answer' field")
            return False
        
        if len(answer.strip()) < 10:
            print(f"❌ Answer too short: '{answer}'")
            return False
        
        # Check for generic fallback responses
        generic_phrases = [
            "I don't have enough information",
            "I cannot find relevant information", 
            "Based on the available data, I cannot"
        ]
        
        is_generic = any(phrase.lower() in answer.lower() for phrase in generic_phrases)
        if is_generic:
            print(f"❌ Generic fallback detected: '{answer[:100]}...'")
            return False
        
        print(f"✅ answer field: {len(answer)} characters of actual content")
        
        # 2. citations.length > 0
        citations = data.get('citations', [])
        if len(citations) == 0:
            print("❌ citations.length = 0, expected > 0")
            return False
        
        print(f"✅ citations.length: {len(citations)} > 0")
        
        # 3. used_chunks > 0
        used_chunks = data.get('used_chunks', 0)
        if used_chunks == 0:
            print("❌ used_chunks = 0, expected > 0")
            return False
        
        print(f"✅ used_chunks: {used_chunks} > 0")
        
        # 4. Citations should have source_id, score, title
        print("✅ Citation validation:")
        for i, citation in enumerate(citations):
            required_fields = ['source_id', 'score', 'title']
            missing_fields = [field for field in required_fields if field not in citation]
            
            if missing_fields:
                print(f"❌ Citation {i} missing fields: {missing_fields}")
                return False
            
            print(f"   Citation {i}: source_id='{citation['source_id']}', score={citation['score']}, title='{citation['title'][:50]}...'")
        
        print()
        print("🎉 ALL VALIDATION CRITERIA MET!")
        print(f"   ✓ Status 200")
        print(f"   ✓ answer field with actual content ({len(answer)} chars)")
        print(f"   ✓ citations.length > 0 ({len(citations)} citations)")
        print(f"   ✓ used_chunks > 0 ({used_chunks} chunks)")
        print(f"   ✓ Citations have source_id, score, title")
        
        return True
        
    except json.JSONDecodeError:
        print("❌ Invalid JSON response")
        return False

def test_pricing_query_detailed():
    """Test Case 2: Pricing Query - Check for specific pricing info"""
    print("\n💰 Testing Pricing Query")
    print("-" * 40)
    
    query_data = {
        "user_id": "test-user-123",
        "query": "What are the LifeOS pricing plans?",
        "top_k": 5,
        "min_score": 0.4,
        "use_cache": False
    }
    
    success, response, error = make_request('POST', '/api/v1/rag/query', data=query_data)
    
    if not success or response.status_code != 200:
        print(f"❌ Request failed: {error if not success else f'Status {response.status_code}'}")
        return False
    
    try:
        data = response.json()
        answer = data.get('answer', '')
        citations = data.get('citations', [])
        
        print(f"✅ Status 200")
        print(f"Answer length: {len(answer)} characters")
        print(f"Citations: {len(citations)}")
        
        # Check for specific pricing mentioned in review request
        expected_pricing = ['Free', 'Pro', '$9.99', 'month', 'Team', '$24.99']
        found_pricing = []
        
        for price_item in expected_pricing:
            if price_item.lower() in answer.lower():
                found_pricing.append(price_item)
        
        if found_pricing:
            print(f"✅ Found pricing info: {', '.join(found_pricing)}")
        else:
            print(f"⚠️  Specific pricing not found, but answer provided")
        
        print(f"Answer preview: {answer[:200]}...")
        return True
        
    except json.JSONDecodeError:
        print("❌ Invalid JSON response")
        return False

def test_response_times():
    """Test response times should be reasonable (<10s)"""
    print("\n⏱️  Testing Response Times")
    print("-" * 30)
    
    queries = [
        "What are LifeOS features?",
        "Tell me about the planner engine",
        "What are the pricing plans?"
    ]
    
    all_passed = True
    
    for query in queries:
        query_data = {
            "user_id": "test-user-123",
            "query": query,
            "top_k": 5,
            "min_score": 0.4,
            "use_cache": False
        }
        
        start_time = time.time()
        success, response, error = make_request('POST', '/api/v1/rag/query', data=query_data)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        if not success:
            print(f"❌ Query '{query[:30]}...' failed: {error}")
            all_passed = False
            continue
        
        if response_time > 10.0:
            print(f"❌ Query '{query[:30]}...' took {response_time:.2f}s (>10s limit)")
            all_passed = False
        else:
            print(f"✅ Query '{query[:30]}...' took {response_time:.2f}s (<10s)")
    
    return all_passed

def test_no_500_errors():
    """Test No 500 errors or crashes"""
    print("\n🛡️  Testing Error Handling (No 500 errors)")
    print("-" * 45)
    
    test_cases = [
        # Valid queries
        {"user_id": "test-user-123", "query": "What are LifeOS features?", "top_k": 5, "min_score": 0.4, "use_cache": False},
        {"user_id": "test-user-123", "query": "Random unrelated query about space travel", "top_k": 3, "min_score": 0.5, "use_cache": True},
        
        # Edge cases
        {"user_id": "test-user-123", "query": "", "top_k": 5, "min_score": 0.4, "use_cache": False},  # Empty query
        {"user_id": "", "query": "test", "top_k": 5, "min_score": 0.4, "use_cache": False},  # Empty user_id
        {"user_id": "test-user-123", "query": "a" * 1000, "top_k": 5, "min_score": 0.4, "use_cache": False},  # Very long query
    ]
    
    all_passed = True
    
    for i, query_data in enumerate(test_cases):
        success, response, error = make_request('POST', '/api/v1/rag/query', data=query_data)
        
        if not success:
            print(f"❌ Test case {i+1} request failed: {error}")
            all_passed = False
            continue
        
        if response.status_code == 500:
            print(f"❌ Test case {i+1} returned 500 error: {response.text}")
            all_passed = False
        else:
            status_desc = "✅" if response.status_code in [200, 400] else "⚠️"
            print(f"{status_desc} Test case {i+1}: Status {response.status_code}")
    
    return all_passed

def main():
    """Run all detailed tests"""
    print("=" * 80)
    print("LifeOS RAG Pipeline - DETAILED VALIDATION")
    print("Testing exact scenarios from review request")
    print("=" * 80)
    
    results = []
    
    # Test 1: Exact Basic RAG Query (MUST PASS)
    results.append(("Basic RAG Query (MUST PASS)", test_exact_basic_rag_query()))
    
    # Test 2: Pricing Query with specific validation
    results.append(("Pricing Query Validation", test_pricing_query_detailed()))
    
    # Test 3: Response Times (<10s)
    results.append(("Response Times (<10s)", test_response_times()))
    
    # Test 4: No 500 errors
    results.append(("No 500 Errors/Crashes", test_no_500_errors()))
    
    # Summary
    print("\n" + "=" * 80)
    print("DETAILED TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if success:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    # Check critical test
    basic_rag_passed = results[0][1] if results else False
    
    if not basic_rag_passed:
        print("\n🚨 CRITICAL FAILURE: Basic RAG Query (MUST PASS) failed!")
        return False
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - RAG Pipeline fully functional!")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)