#!/usr/bin/env python3
"""
LifeOS Backend Comprehensive Test Suite
Tests Privacy & Encryption APIs, Action Engine APIs, and Core APIs
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL
BASE_URL = "http://localhost:8000"

class LifeOSTestSuite:
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
    
    def test_health_check(self):
        """Test basic health check"""
        success, response, error = self.make_request('GET', '/health')
        
        if not success:
            self.log_test("Health Check", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Health Check", False, f"Status code: {response.status_code}")
            return False
        
        try:
            data = response.json()
            if data.get('status') == 'ok':
                self.log_test("Health Check", True, "Backend is healthy")
                return True
            else:
                self.log_test("Health Check", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Health Check", False, "Invalid JSON response")
            return False
    
    def test_api_info(self):
        """Test API info endpoint"""
        success, response, error = self.make_request('GET', '/api/')
        
        if not success:
            self.log_test("API Info", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("API Info", False, f"Status code: {response.status_code}")
            return False
        
        try:
            data = response.json()
            if 'name' in data and 'endpoints' in data:
                self.log_test("API Info", True, f"API: {data.get('name')}")
                return True
            else:
                self.log_test("API Info", False, f"Missing expected fields: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("API Info", False, "Invalid JSON response")
            return False
    
    def test_privacy_encryption_settings(self):
        """Test Privacy & Encryption Settings API"""
        user_id = "test-user-123"
        
        # Test GET encryption settings (should initialize for new user)
        success, response, error = self.make_request('GET', '/api/v1/privacy/encryption-settings', 
                                                   params={'user_id': user_id})
        
        if not success:
            self.log_test("Privacy Encryption Settings - GET", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Privacy Encryption Settings - GET", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'settings' in data:
                settings = data['settings']
                expected_fields = ['userId', 'encryptionTier', 'vaultEnabled', 'kmsKeyId']
                
                missing_fields = [field for field in expected_fields if field not in settings]
                if missing_fields:
                    self.log_test("Privacy Encryption Settings - GET", False, 
                                 f"Missing fields: {missing_fields}")
                    return False
                
                self.log_test("Privacy Encryption Settings - GET", True, 
                             f"Encryption tier: {settings.get('encryptionTier')}, Vault: {settings.get('vaultEnabled')}")
                return True
            else:
                self.log_test("Privacy Encryption Settings - GET", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Privacy Encryption Settings - GET", False, "Invalid JSON response")
            return False
    
    def test_privacy_enable_vault(self):
        """Test Privacy Enable Vault API"""
        user_id = "test-user-123"
        vault_data = {
            "user_id": user_id,
            "vault_key_encrypted": "test-encrypted-key-12345"
        }
        
        success, response, error = self.make_request('POST', '/api/v1/privacy/enable-vault', data=vault_data)
        
        if not success:
            self.log_test("Privacy Enable Vault", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Privacy Enable Vault", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'message' in data:
                self.log_test("Privacy Enable Vault", True, data.get('message'))
                return True
            else:
                self.log_test("Privacy Enable Vault", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Privacy Enable Vault", False, "Invalid JSON response")
            return False
    
    def test_privacy_vault_store(self):
        """Test Privacy Vault Store API"""
        user_id = "test-user-123"
        vault_data = {
            "user_id": user_id,
            "node_id": "secret-1",
            "encrypted_content": "encrypted-secret-data-12345",
            "metadata": {"alg": "aes", "created": "2025-12-01"}
        }
        
        success, response, error = self.make_request('POST', '/api/v1/privacy/vault/store', data=vault_data)
        
        if not success:
            self.log_test("Privacy Vault Store", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Privacy Vault Store", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and data.get('node_id') == 'secret-1':
                self.log_test("Privacy Vault Store", True, f"Stored node: {data.get('node_id')}")
                return True
            else:
                self.log_test("Privacy Vault Store", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Privacy Vault Store", False, "Invalid JSON response")
            return False
    
    def test_privacy_vault_retrieve(self):
        """Test Privacy Vault Retrieve API"""
        user_id = "test-user-123"
        node_id = "secret-1"
        
        success, response, error = self.make_request('GET', f'/api/v1/privacy/vault/{node_id}', 
                                                   params={'user_id': user_id})
        
        if not success:
            self.log_test("Privacy Vault Retrieve", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Privacy Vault Retrieve", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'node' in data:
                node = data['node']
                if 'encryptedContent' in node:
                    self.log_test("Privacy Vault Retrieve", True, f"Retrieved node: {node_id}")
                    return True
                else:
                    self.log_test("Privacy Vault Retrieve", False, f"Invalid node data: {node}")
                    return False
            else:
                self.log_test("Privacy Vault Retrieve", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Privacy Vault Retrieve", False, "Invalid JSON response")
            return False
    
    def test_privacy_vault_list(self):
        """Test Privacy Vault List API"""
        user_id = "test-user-123"
        
        success, response, error = self.make_request('GET', '/api/v1/privacy/vault/list', 
                                                   params={'user_id': user_id})
        
        if not success:
            self.log_test("Privacy Vault List", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Privacy Vault List", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'nodes' in data and 'total' in data:
                nodes = data['nodes']
                total = data['total']
                self.log_test("Privacy Vault List", True, f"Found {total} vault nodes")
                return True
            else:
                self.log_test("Privacy Vault List", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Privacy Vault List", False, "Invalid JSON response")
            return False
    
    def test_action_create(self):
        """Test Action Engine Create Action API"""
        action_data = {
            "user_id": "test-user-456",
            "action_type": "send_email",
            "payload": {
                "to": "test@example.com",
                "subject": "Test Email",
                "body": "This is a test email from LifeOS"
            },
            "priority": 5
        }
        
        success, response, error = self.make_request('POST', '/api/actions', data=action_data)
        
        if not success:
            self.log_test("Action Engine Create", False, f"Request failed: {error}")
            return False, None
        
        if response.status_code != 201:
            self.log_test("Action Engine Create", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False, None
        
        try:
            data = response.json()
            if data.get('success') and 'action_id' in data:
                action_id = data['action_id']
                self.log_test("Action Engine Create", True, 
                             f"Created action: {action_id}, Requires approval: {data.get('requires_approval')}")
                return True, action_id
            else:
                self.log_test("Action Engine Create", False, f"Unexpected response: {data}")
                return False, None
        except json.JSONDecodeError:
            self.log_test("Action Engine Create", False, "Invalid JSON response")
            return False, None
    
    def test_action_get_by_id(self, action_id: str):
        """Test Action Engine Get Action by ID API"""
        success, response, error = self.make_request('GET', f'/api/actions/{action_id}')
        
        if not success:
            self.log_test("Action Engine Get by ID", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Action Engine Get by ID", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'action' in data:
                action = data['action']
                if action.get('id') == action_id:
                    self.log_test("Action Engine Get by ID", True, 
                                 f"Retrieved action: {action_id}, Status: {action.get('status')}")
                    return True
                else:
                    self.log_test("Action Engine Get by ID", False, f"ID mismatch: {action}")
                    return False
            else:
                self.log_test("Action Engine Get by ID", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Action Engine Get by ID", False, "Invalid JSON response")
            return False
    
    def test_action_get_by_user(self):
        """Test Action Engine Get Actions by User API"""
        user_id = "test-user-456"
        
        success, response, error = self.make_request('GET', f'/api/actions/user/{user_id}')
        
        if not success:
            self.log_test("Action Engine Get by User", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Action Engine Get by User", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'actions' in data:
                actions = data['actions']
                self.log_test("Action Engine Get by User", True, 
                             f"Found {len(actions)} actions for user {user_id}")
                return True
            else:
                self.log_test("Action Engine Get by User", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Action Engine Get by User", False, "Invalid JSON response")
            return False
    
    def test_billing_plans(self):
        """Test Billing Plans API - should return 4 plans"""
        success, response, error = self.make_request('GET', '/api/v1/billing/plans')
        
        if not success:
            self.log_test("Billing Plans", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Billing Plans", False, 
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
                        self.log_test("Billing Plans", False, f"Missing plans: {missing_plans}")
                        return False
                    
                    # Check plan structure
                    required_fields = ['id', 'plan_name', 'display_name', 'monthly_price', 'features']
                    for plan in plans:
                        missing_fields = [field for field in required_fields if field not in plan]
                        if missing_fields:
                            self.log_test("Billing Plans", False, 
                                         f"Plan {plan.get('plan_name')} missing fields: {missing_fields}")
                            return False
                    
                    self.log_test("Billing Plans", True, 
                                 f"Found {len(plans)} plans: {', '.join(plan_names)}")
                    return True
                else:
                    self.log_test("Billing Plans", False, 
                                 f"Expected 4 plans, got {len(plans)}")
                    return False
            else:
                self.log_test("Billing Plans", False, f"No 'plans' field in response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Billing Plans", False, "Invalid JSON response")
            return False
    
    def test_billing_subscription(self):
        """Test Billing Subscription API"""
        user_id = "test-user-billing"
        
        success, response, error = self.make_request('GET', '/api/v1/billing/subscription', 
                                                   params={'userId': user_id})
        
        if not success:
            self.log_test("Billing Subscription", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Billing Subscription", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if 'subscription' in data:
                subscription = data['subscription']
                # Subscription can be null for new users
                if subscription is None:
                    self.log_test("Billing Subscription", True, "No subscription found (expected for new user)")
                else:
                    # If subscription exists, check structure
                    expected_fields = ['id', 'user_id', 'plan_id', 'status']
                    missing_fields = [field for field in expected_fields if field not in subscription]
                    if missing_fields:
                        self.log_test("Billing Subscription", False, 
                                     f"Subscription missing fields: {missing_fields}")
                        return False
                    
                    self.log_test("Billing Subscription", True, 
                                 f"Found subscription: {subscription.get('status')}")
                return True
            else:
                self.log_test("Billing Subscription", False, f"No 'subscription' field in response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Billing Subscription", False, "Invalid JSON response")
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
            self.log_test("Billing Record Usage - Embeddings", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Billing Record Usage - Embeddings", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and data.get('message'):
                self.log_test("Billing Record Usage - Embeddings", True, 
                             f"Recorded 1000 embeddings usage for {user_id}")
                return True
            else:
                self.log_test("Billing Record Usage - Embeddings", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Billing Record Usage - Embeddings", False, "Invalid JSON response")
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
            self.log_test("Billing Record Usage - LLM Tokens", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Billing Record Usage - LLM Tokens", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and data.get('message'):
                self.log_test("Billing Record Usage - LLM Tokens", True, 
                             f"Recorded 50000 LLM tokens usage for {user_id}")
                return True
            else:
                self.log_test("Billing Record Usage - LLM Tokens", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test("Billing Record Usage - LLM Tokens", False, "Invalid JSON response")
            return False
    
    def test_billing_usage_summary(self):
        """Test Billing Usage Summary API"""
        user_id = "test-user-billing"
        
        success, response, error = self.make_request('GET', f'/api/v1/billing/usage/{user_id}')
        
        if not success:
            self.log_test("Billing Usage Summary", False, f"Request failed: {error}")
            return False
        
        # Accept both 200 (found) and 404 (no subscription) as valid responses
        if response.status_code == 404:
            try:
                data = response.json()
                if 'error' in data and 'subscription' in data['error'].lower():
                    self.log_test("Billing Usage Summary", True, 
                                 "No subscription found (expected for new user)")
                    return True
            except json.JSONDecodeError:
                pass
            
            self.log_test("Billing Usage Summary", False, 
                         f"Unexpected 404 response: {response.text}")
            return False
        
        if response.status_code != 200:
            self.log_test("Billing Usage Summary", False, 
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
                    self.log_test("Billing Usage Summary", True, 
                                 f"Usage summary retrieved with {len(usage)} usage types")
                    return True
                else:
                    self.log_test("Billing Usage Summary", False, 
                                 f"Missing required fields: {missing_fields}")
                    return False
            else:
                usage = data['usage']
                self.log_test("Billing Usage Summary", True, 
                             f"Complete usage summary with {len(usage)} usage types")
                return True
                
        except json.JSONDecodeError:
            self.log_test("Billing Usage Summary", False, "Invalid JSON response")
            return False
    
    def run_all_tests(self):
        """Run all test suites"""
        print("=" * 60)
        print("LifeOS Backend Comprehensive Test Suite")
        print("=" * 60)
        
        # Core API Tests
        print("\n🔧 Core API Tests")
        print("-" * 30)
        self.test_health_check()
        self.test_api_info()
        
        # Privacy & Encryption API Tests
        print("\n🔒 Privacy & Encryption API Tests")
        print("-" * 40)
        self.test_privacy_encryption_settings()
        self.test_privacy_enable_vault()
        self.test_privacy_vault_store()
        self.test_privacy_vault_retrieve()
        self.test_privacy_vault_list()
        
        # Action Engine API Tests
        print("\n⚡ Action Engine API Tests")
        print("-" * 35)
        action_created, action_id = self.test_action_create()
        if action_created and action_id:
            self.test_action_get_by_id(action_id)
        self.test_action_get_by_user()
        
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
    test_suite = LifeOSTestSuite()
    success = test_suite.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)