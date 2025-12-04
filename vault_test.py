#!/usr/bin/env python3
"""
Client-Side Encryption Vault End-to-End Test Suite
Tests the complete vault workflow as specified in the review request
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BASE_URL = "http://localhost:8000"

class VaultTestSuite:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.failed_tests = []
        self.user_id = "test-user-vault-123"
        self.stored_items = []
        
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
    
    def test_vault_initialize(self):
        """Test vault initialization for user"""
        print(f"\n🔐 Testing Vault Initialization for user: {self.user_id}")
        
        vault_data = {
            "userId": self.user_id,
            "kdfSaltHex": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",  # 64 char hex
            "kdfIterations": 100000,
            "kdfAlgorithm": "PBKDF2",
            "kdfHash": "SHA-256",
            "passphraseHint": "my favorite color",
            "require2FA": False,
            "autoLockMinutes": 15
        }
        
        success, response, error = self.make_request('POST', '/api/v1/vault/initialize', data=vault_data)
        
        if not success:
            self.log_test("Vault Initialize", False, f"Request failed: {error}")
            return False
        
        if response.status_code == 409:
            # Vault already exists, that's okay for testing
            self.log_test("Vault Initialize", True, "Vault already exists (409 - expected for repeat tests)")
            return True
        elif response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data and 'config' in data:
                    self.log_test("Vault Initialize", True, f"Vault created: {data['message']}")
                    return True
                else:
                    self.log_test("Vault Initialize", False, f"Unexpected response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_test("Vault Initialize", False, "Invalid JSON response")
                return False
        else:
            self.log_test("Vault Initialize", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
    
    def test_vault_config(self):
        """Test getting vault configuration"""
        print(f"\n📋 Testing Vault Configuration Retrieval")
        
        success, response, error = self.make_request('GET', f'/api/v1/vault/config/{self.user_id}')
        
        if not success:
            self.log_test("Vault Config", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Vault Config", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            expected_fields = ['user_id', 'vault_enabled', 'kdf_algorithm', 'kdf_iterations', 'kdf_salt_hex']
            
            missing_fields = [field for field in expected_fields if field not in data]
            if missing_fields:
                self.log_test("Vault Config", False, f"Missing fields: {missing_fields}")
                return False
            
            self.log_test("Vault Config", True, 
                         f"Config retrieved - KDF: {data.get('kdf_algorithm')}, Iterations: {data.get('kdf_iterations')}")
            return True
        except json.JSONDecodeError:
            self.log_test("Vault Config", False, "Invalid JSON response")
            return False
    
    def test_store_encrypted_item(self, item_type: str, label: str, data: str):
        """Test storing an encrypted item"""
        print(f"\n💾 Testing Store Encrypted Item: {label}")
        
        # Simulate encrypted data (in real app, this would be client-side encrypted)
        encrypted_data = f"ENCRYPTED_{data}_WITH_AES256"
        encrypted_label = f"ENCRYPTED_{label}_LABEL"
        
        item_data = {
            "userId": self.user_id,
            "nodeType": item_type,
            "encryptedLabel": encrypted_label,
            "labelIv": "1234567890abcdef1234567890abcdef",  # 32 char hex IV
            "encryptedData": encrypted_data,
            "encryptionIv": "abcdef1234567890abcdef1234567890",  # 32 char hex IV
            "metadata": {
                "algorithm": "AES-256-GCM",
                "created": "2025-12-01T12:00:00Z",
                "type": item_type
            }
        }
        
        success, response, error = self.make_request('POST', '/api/v1/vault/items', data=item_data)
        
        if not success:
            self.log_test(f"Store Item ({label})", False, f"Request failed: {error}")
            return None
        
        if response.status_code != 200:
            self.log_test(f"Store Item ({label})", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return None
        
        try:
            data = response.json()
            if 'id' in data and 'createdAt' in data:
                item_id = data['id']
                self.stored_items.append({
                    'id': item_id,
                    'type': item_type,
                    'label': label
                })
                self.log_test(f"Store Item ({label})", True, f"Item stored with ID: {item_id}")
                return item_id
            else:
                self.log_test(f"Store Item ({label})", False, f"Unexpected response: {data}")
                return None
        except json.JSONDecodeError:
            self.log_test(f"Store Item ({label})", False, "Invalid JSON response")
            return None
    
    def test_list_vault_items(self):
        """Test listing all vault items for user"""
        print(f"\n📝 Testing List Vault Items")
        
        success, response, error = self.make_request('GET', '/api/v1/vault/items', 
                                                   params={'userId': self.user_id})
        
        if not success:
            self.log_test("List Vault Items", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("List Vault Items", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            items = response.json()
            if isinstance(items, list):
                item_count = len(items)
                self.log_test("List Vault Items", True, f"Found {item_count} vault items")
                
                # Verify our stored items are in the list
                stored_ids = [item['id'] for item in self.stored_items]
                found_ids = [item['id'] for item in items]
                
                missing_items = [item_id for item_id in stored_ids if item_id not in found_ids]
                if missing_items:
                    self.log_test("List Vault Items - Verification", False, 
                                 f"Missing stored items: {missing_items}")
                else:
                    self.log_test("List Vault Items - Verification", True, 
                                 "All stored items found in list")
                
                return True
            else:
                self.log_test("List Vault Items", False, f"Expected array, got: {type(items)}")
                return False
        except json.JSONDecodeError:
            self.log_test("List Vault Items", False, "Invalid JSON response")
            return False
    
    def test_get_specific_item(self, item_id: str, label: str):
        """Test retrieving a specific item by ID"""
        print(f"\n🔍 Testing Get Specific Item: {label}")
        
        success, response, error = self.make_request('GET', f'/api/v1/vault/items/{item_id}')
        
        if not success:
            self.log_test(f"Get Item ({label})", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test(f"Get Item ({label})", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            expected_fields = ['id', 'user_id', 'node_type', 'encrypted_data', 'encryption_iv']
            
            missing_fields = [field for field in expected_fields if field not in data]
            if missing_fields:
                self.log_test(f"Get Item ({label})", False, f"Missing fields: {missing_fields}")
                return False
            
            if data['id'] != item_id:
                self.log_test(f"Get Item ({label})", False, f"ID mismatch: expected {item_id}, got {data['id']}")
                return False
            
            if data['user_id'] != self.user_id:
                self.log_test(f"Get Item ({label})", False, f"User ID mismatch: expected {self.user_id}, got {data['user_id']}")
                return False
            
            self.log_test(f"Get Item ({label})", True, 
                         f"Item retrieved - Type: {data.get('node_type')}, ID: {data['id']}")
            return True
        except json.JSONDecodeError:
            self.log_test(f"Get Item ({label})", False, "Invalid JSON response")
            return False
    
    def test_delete_item(self, item_id: str, label: str):
        """Test deleting a specific item"""
        print(f"\n🗑️ Testing Delete Item: {label}")
        
        success, response, error = self.make_request('DELETE', f'/api/v1/vault/items/{item_id}')
        
        if not success:
            self.log_test(f"Delete Item ({label})", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test(f"Delete Item ({label})", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            data = response.json()
            if data.get('success') and 'message' in data:
                self.log_test(f"Delete Item ({label})", True, f"Item deleted: {data['message']}")
                return True
            else:
                self.log_test(f"Delete Item ({label})", False, f"Unexpected response: {data}")
                return False
        except json.JSONDecodeError:
            self.log_test(f"Delete Item ({label})", False, "Invalid JSON response")
            return False
    
    def test_verify_deletion(self):
        """Test that deleted item is no longer in the list"""
        print(f"\n✅ Testing Verify Deletion")
        
        success, response, error = self.make_request('GET', '/api/v1/vault/items', 
                                                   params={'userId': self.user_id})
        
        if not success:
            self.log_test("Verify Deletion", False, f"Request failed: {error}")
            return False
        
        if response.status_code != 200:
            self.log_test("Verify Deletion", False, 
                         f"Status code: {response.status_code}, Response: {response.text}")
            return False
        
        try:
            items = response.json()
            if isinstance(items, list):
                current_count = len(items)
                expected_count = len(self.stored_items) - 1  # One item should be deleted
                
                if current_count == expected_count:
                    self.log_test("Verify Deletion", True, 
                                 f"Item count correct after deletion: {current_count} items remaining")
                    return True
                else:
                    self.log_test("Verify Deletion", False, 
                                 f"Item count mismatch: expected {expected_count}, got {current_count}")
                    return False
            else:
                self.log_test("Verify Deletion", False, f"Expected array, got: {type(items)}")
                return False
        except json.JSONDecodeError:
            self.log_test("Verify Deletion", False, "Invalid JSON response")
            return False
    
    def run_end_to_end_test(self):
        """Run the complete end-to-end vault test scenario"""
        print("=" * 80)
        print("CLIENT-SIDE ENCRYPTION VAULT - END-TO-END TEST")
        print("=" * 80)
        print(f"Backend URL: {self.base_url}")
        print(f"Test User: {self.user_id}")
        
        # Step 1: Initialize vault
        if not self.test_vault_initialize():
            print("\n❌ Vault initialization failed - stopping test")
            return False
        
        # Step 2: Get vault configuration
        if not self.test_vault_config():
            print("\n❌ Vault configuration retrieval failed - stopping test")
            return False
        
        # Step 3: Store encrypted items
        aws_key_id = self.test_store_encrypted_item("password", "AWS Key", "AKIAIOSFODNN7EXAMPLE")
        secret_note_id = self.test_store_encrypted_item("note", "Secret Note", "This is my secret note content")
        
        if not aws_key_id or not secret_note_id:
            print("\n❌ Failed to store encrypted items - stopping test")
            return False
        
        # Step 4: List all items
        if not self.test_list_vault_items():
            print("\n❌ Failed to list vault items - stopping test")
            return False
        
        # Step 5: Retrieve specific item
        if not self.test_get_specific_item(aws_key_id, "AWS Key"):
            print("\n❌ Failed to retrieve specific item - stopping test")
            return False
        
        # Step 6: Delete one item
        if not self.test_delete_item(secret_note_id, "Secret Note"):
            print("\n❌ Failed to delete item - stopping test")
            return False
        
        # Step 7: Verify deletion
        if not self.test_verify_deletion():
            print("\n❌ Failed to verify deletion - stopping test")
            return False
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
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
        else:
            print("\n🎉 ALL VAULT TESTS PASSED!")
            print("\n✅ End-to-End Vault Flow Verification:")
            print("   ✅ Vault initialization working")
            print("   ✅ Vault configuration retrieval working")
            print("   ✅ Encrypted item storage working")
            print("   ✅ Item listing working")
            print("   ✅ Specific item retrieval working")
            print("   ✅ Item deletion working")
            print("   ✅ Deletion verification working")
        
        return failed_tests == 0

if __name__ == "__main__":
    test_suite = VaultTestSuite()
    success = test_suite.run_end_to_end_test()
    
    if success:
        print("\n🎉 Client-Side Encryption Vault: ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("\n💥 Client-Side Encryption Vault: SOME TESTS FAILED!")
        sys.exit(1)