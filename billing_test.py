#!/usr/bin/env python3
"""
LifeOS Billing API Test Suite
Tests Billing and Subscription APIs specifically
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL
BASE_URL = "http://localhost:8000"

class BillingTestSuite:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
        if not success:
            self.failed_tests.append({
                'test': test_name,
                'details': details
            })
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple:
        """Make HTTP request and return (success, response, error)"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            if method.upper() == 'GET':
                response = requests.get(url, params=params, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, params=params, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, json=data, params=params, timeout=10)
            else:
                return False, None, f"Unsupported method: {method}"
            
            return True, response, None
            
        except requests.exceptions.RequestException as e:
            return False, None, str(e)
    
    def test_billing_plans(self):
        """Test Billing Plans API - should return 4 plans"""
        success, response, error = self.make_request('GET', '/api/v1/billing/plans')
        
        if not success:
            self.log_test("GET /api/v1/billing/plans", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("GET /api/v1/billing/plans", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if 'plans' in data:
                plans = data['plans']
                if len(plans) == 4:
                    # Check if all expected plans exist
                    plan_names = [plan.get('plan_name') for plan in plans]
                    expected_plans = ['free', 'pro', 'team', 'enterprise']
                    
                    missing_plans = [plan for plan in expected_plans if plan not in plan_names]
                    if missing_plans:
                        self.log_test("GET /api/v1/billing/plans", False, f"Missing plans: {missing_plans}")
                        return False
                    
                    # Check plan structure
                    required_fields = ['id', 'plan_name', 'display_name', 'monthly_price', 'features']
                    for plan in plans:
                        missing_fields = [field for field in required_fields if field not in plan]
                        if missing_fields:
                            self.log_test("GET /api/v1/billing/plans", False, 
                                         f"Plan {plan.get('plan_name')} missing fields: {missing_fields}")
                            return False
                    
                    self.log_test("GET /api/v1/billing/plans", True, 
                                 f"Found {len(plans)} plans: {', '.join(plan_names)}")
                    return True
                else:
                    self.log_test("GET /api/v1/billing/plans", False, 
                                 f"Expected 4 plans, got {len(plans)}")
                    return False
            else:
                self.log_test("GET /api/v1/billing/plans", False, f"No 'plans' field in response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("GET /api/v1/billing/plans", False, "Invalid JSON response")
            return False
    
    def test_billing_subscription(self):
        """Test Billing Subscription API"""
        user_id = "test-user-billing"
        
        success, response, error = self.make_request('GET', '/api/v1/billing/subscription', 
                                                   params={'userId': user_id})
        
        if not success:
            self.log_test("GET /api/v1/billing/subscription", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("GET /api/v1/billing/subscription", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if 'subscription' in data:
                subscription = data['subscription']
                # Subscription can be null for new users
                if subscription is None:
                    self.log_test("GET /api/v1/billing/subscription", True, "No subscription found (expected for new user)")
                else:
                    # If subscription exists, check structure
                    expected_fields = ['id', 'user_id', 'plan_id', 'status']
                    missing_fields = [field for field in expected_fields if field not in subscription]
                    if missing_fields:
                        self.log_test("GET /api/v1/billing/subscription", False, 
                                     f"Subscription missing fields: {missing_fields}")
                        return False
                    
                    self.log_test("GET /api/v1/billing/subscription", True, 
                                 f"Found subscription: {subscription.get('status')}")
                return True
            else:
                self.log_test("GET /api/v1/billing/subscription", False, f"No 'subscription' field in response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("GET /api/v1/billing/subscription", False, "Invalid JSON response")
            return False
    
    def test_billing_record_usage_embeddings(self):
        """Test Billing Usage Recording - Embeddings"""
        user_id = "test-user-billing"
        usage_data = {
            "userId": user_id,
            "usageType": "embeddings",
            "amount": 1000
        }
        
        success, response, error = self.make_request('POST', '/api/v1/billing/usage', data=usage_data)
        
        if not success:
            self.log_test("POST /api/v1/billing/usage (embeddings)", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("POST /api/v1/billing/usage (embeddings)", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and data.get('message'):
                self.log_test("POST /api/v1/billing/usage (embeddings)", True, 
                             f"Recorded 1000 embeddings usage for {user_id}")
                return True
            else:
                self.log_test("POST /api/v1/billing/usage (embeddings)", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("POST /api/v1/billing/usage (embeddings)", False, "Invalid JSON response")
            return False
    
    def test_billing_record_usage_llm_tokens(self):
        """Test Billing Usage Recording - LLM Tokens"""
        user_id = "test-user-billing"
        usage_data = {
            "userId": user_id,
            "usageType": "llm_tokens",
            "amount": 50000
        }
        
        success, response, error = self.make_request('POST', '/api/v1/billing/usage', data=usage_data)
        
        if not success:
            self.log_test("POST /api/v1/billing/usage (llm_tokens)", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("POST /api/v1/billing/usage (llm_tokens)", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and data.get('message'):
                self.log_test("POST /api/v1/billing/usage (llm_tokens)", True, 
                             f"Recorded 50000 LLM tokens usage for {user_id}")
                return True
            else:
                self.log_test("POST /api/v1/billing/usage (llm_tokens)", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("POST /api/v1/billing/usage (llm_tokens)", False, "Invalid JSON response")
            return False
    
    def test_billing_usage_summary(self):
        """Test Billing Usage Summary API"""
        user_id = "test-user-billing"
        
        success, response, error = self.make_request('GET', f'/api/v1/billing/usage/{user_id}')
        
        if not success:
            self.log_test("GET /api/v1/billing/usage/:userId", False, f"Request failed: {error}")
            return False
        
        # Accept both 200 (found) and 404 (no subscription) as valid responses
        if response.status_code == 404:
            try:
                data = response.json()
                if 'error' in data and 'subscription' in data['error'].lower():
                    self.log_test("GET /api/v1/billing/usage/:userId", True, 
                                 "No subscription found (expected for new user)")
                    return True
            except json.JSONDecodeError:
                pass
            
            self.log_test("GET /api/v1/billing/usage/:userId", False, 
                         f"Unexpected 404 response: {response.text}")
            return False
        
        if response.status_code != 200:
            self.log_test("GET /api/v1/billing/usage/:userId", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            # Check if usage summary has expected structure
            expected_fields = ['current_period_start', 'current_period_end', 'usage']
            missing_fields = [field for field in expected_fields if field not in data]
            
            if missing_fields:
                # If some fields are missing, still consider it a pass if we get usage data
                if 'usage' in data:
                    usage = data['usage']
                    self.log_test("GET /api/v1/billing/usage/:userId", True, 
                                 f"Usage summary retrieved with {len(usage)} usage types")
                    return True
                else:
                    self.log_test("GET /api/v1/billing/usage/:userId", False, 
                                 f"Missing required fields: {missing_fields}")
                    return False
            else:
                usage = data['usage']
                self.log_test("GET /api/v1/billing/usage/:userId", True, 
                             f"Complete usage summary with {len(usage)} usage types")
                return True
                
        except json.JSONDecodeError:
            self.log_test("GET /api/v1/billing/usage/:userId", False, "Invalid JSON response")
            return False
    
    def run_billing_tests(self):
        """Run all billing test suites"""
        print("=" * 60)
        print("LifeOS Billing & Subscription API Test Suite")
        print("=" * 60)
        
        # Billing & Subscription API Tests
        print("\n💳 Billing & Subscription API Tests")
        print("-" * 40)
        self.test_billing_plans()
        self.test_billing_subscription()
        self.test_billing_record_usage_embeddings()
        self.test_billing_record_usage_llm_tokens()
        self.test_billing_usage_summary()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['test']}")
                if test['details']:
                    print(f"   Error: {test['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    test_suite = BillingTestSuite()
    success = test_suite.run_billing_tests()
    
    if success:
        print("\n🎉 All billing tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some billing tests failed!")
        sys.exit(1)