"""
LifeOS Python SDK
Allows third-party developers to build plugins and agents
Version: 1.0.0
"""

import requests
import hashlib
import hmac
import secrets
from typing import Dict, List, Optional, Any
from datetime import datetime
from urllib.parse import urlencode


class LifeOSSDK:
    """LifeOS SDK for building plugins and agents"""
    
    def __init__(self, config: Dict[str, str]):
        """
        Initialize the SDK
        
        Args:
            config: Configuration dictionary with:
                - api_url: LifeOS API URL
                - client_id: OAuth client ID
                - client_secret: OAuth client secret
                - redirect_uri: OAuth redirect URI
        """
        self.api_url = config.get('api_url', 'http://localhost:8000')
        self.client_id = config['client_id']
        self.client_secret = config['client_secret']
        self.redirect_uri = config['redirect_uri']
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'LifeOS-SDK-Python/1.0.0'
        })
    
    # =========================================================================
    # AUTHENTICATION
    # =========================================================================
    
    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """
        Get OAuth authorization URL
        
        Args:
            state: Random state for CSRF protection
            
        Returns:
            Authorization URL
        """
        if not state:
            state = secrets.token_hex(16)
        
        params = {
            'response_type': 'code',
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'read:nodes write:nodes register:agent send:events',
            'state': state,
        }
        
        return f"{self.api_url}/oauth/authorize?{urlencode(params)}"
    
    def get_access_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code
            
        Returns:
            Token response dictionary
        """
        try:
            response = requests.post(
                f"{self.api_url}/oauth/token",
                json={
                    'grant_type': 'authorization_code',
                    'code': code,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'redirect_uri': self.redirect_uri,
                }
            )
            response.raise_for_status()
            
            data = response.json()
            self.access_token = data['access_token']
            self.refresh_token = data.get('refresh_token')
            
            self._update_session_auth()
            
            return data
        except requests.exceptions.RequestException as e:
            raise Exception(f"Token exchange failed: {str(e)}")
    
    def refresh_access_token(self) -> Dict[str, Any]:
        """
        Refresh access token
        
        Returns:
            New token response dictionary
        """
        if not self.refresh_token:
            raise Exception("No refresh token available")
        
        try:
            response = requests.post(
                f"{self.api_url}/oauth/token",
                json={
                    'grant_type': 'refresh_token',
                    'refresh_token': self.refresh_token,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                }
            )
            response.raise_for_status()
            
            data = response.json()
            self.access_token = data['access_token']
            if 'refresh_token' in data:
                self.refresh_token = data['refresh_token']
            
            self._update_session_auth()
            
            return data
        except requests.exceptions.RequestException as e:
            raise Exception(f"Token refresh failed: {str(e)}")
    
    def set_tokens(self, access_token: str, refresh_token: Optional[str] = None):
        """
        Set access token manually
        
        Args:
            access_token: Access token
            refresh_token: Refresh token (optional)
        """
        self.access_token = access_token
        self.refresh_token = refresh_token
        self._update_session_auth()
    
    def _update_session_auth(self):
        """Update session with current access token"""
        if self.access_token:
            self.session.headers['Authorization'] = f"Bearer {self.access_token}"
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make authenticated request with auto-retry on 401
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            **kwargs: Additional request arguments
            
        Returns:
            Response JSON
        """
        url = f"{self.api_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            # Auto-refresh on 401
            if response.status_code == 401 and self.refresh_token:
                self.refresh_access_token()
                response = self.session.request(method, url, **kwargs)
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")
    
    # =========================================================================
    # PMG NODE OPERATIONS (with RBAC)
    # =========================================================================
    
    def create_node(self, node: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new PMG node
        
        Args:
            node: Node data with type, content, metadata, tags
            
        Returns:
            Created node data
        """
        payload = {
            'type': node['type'],
            'content': node.get('content', {}),
            'metadata': node.get('metadata', {}),
            'tags': node.get('tags', []),
            'source': 'plugin',
            'created_at': datetime.utcnow().isoformat(),
        }
        
        return self._request('POST', '/api/v1/nodes', json=payload)
    
    def get_node(self, node_id: str) -> Dict[str, Any]:
        """
        Read a PMG node by ID
        
        Args:
            node_id: Node ID
            
        Returns:
            Node data
        """
        return self._request('GET', f'/api/v1/nodes/{node_id}')
    
    def update_node(self, node_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a PMG node
        
        Args:
            node_id: Node ID
            updates: Node updates
            
        Returns:
            Updated node data
        """
        return self._request('PATCH', f'/api/v1/nodes/{node_id}', json=updates)
    
    def delete_node(self, node_id: str) -> Dict[str, Any]:
        """
        Delete a PMG node
        
        Args:
            node_id: Node ID
            
        Returns:
            Deletion response
        """
        return self._request('DELETE', f'/api/v1/nodes/{node_id}')
    
    def query_nodes(self, query: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Query PMG nodes with filters
        
        Args:
            query: Query parameters (type, tags, from_date, to_date, limit)
            
        Returns:
            List of nodes
        """
        params = {}
        if query:
            if 'type' in query:
                params['type'] = query['type']
            if 'tags' in query:
                params['tags'] = ','.join(query['tags'])
            if 'from_date' in query:
                params['from'] = query['from_date'].isoformat()
            if 'to_date' in query:
                params['to'] = query['to_date'].isoformat()
            if 'limit' in query:
                params['limit'] = query['limit']
        
        return self._request('GET', '/api/v1/nodes', params=params)
    
    def create_relationship(self, source_id: str, target_id: str, 
                          relationship_type: str) -> Dict[str, Any]:
        """
        Create relationship between nodes
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            relationship_type: Type of relationship
            
        Returns:
            Relationship data
        """
        payload = {
            'source_id': source_id,
            'target_id': target_id,
            'type': relationship_type,
        }
        
        return self._request('POST', '/api/v1/relationships', json=payload)
    
    # =========================================================================
    # AGENT REGISTRATION
    # =========================================================================
    
    def register_agent(self, agent: Dict[str, Any]) -> Dict[str, Any]:
        """
        Register a new agent
        
        Args:
            agent: Agent configuration with name, description, version, 
                   capabilities, endpoints
            
        Returns:
            Registered agent data
        """
        payload = {
            'name': agent['name'],
            'description': agent['description'],
            'version': agent['version'],
            'capabilities': agent.get('capabilities', []),
            'endpoints': {
                'webhook': agent['endpoints']['webhook'],
                'health': agent['endpoints']['health'],
            },
            'metadata': agent.get('metadata', {}),
            'registered_at': datetime.utcnow().isoformat(),
        }
        
        return self._request('POST', '/api/v1/agents/register', json=payload)
    
    def update_agent(self, agent_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update agent configuration
        
        Args:
            agent_id: Agent ID
            updates: Agent updates
            
        Returns:
            Updated agent data
        """
        return self._request('PATCH', f'/api/v1/agents/{agent_id}', json=updates)
    
    def unregister_agent(self, agent_id: str) -> Dict[str, Any]:
        """
        Unregister an agent
        
        Args:
            agent_id: Agent ID
            
        Returns:
            Unregistration response
        """
        return self._request('DELETE', f'/api/v1/agents/{agent_id}')
    
    def subscribe_to_events(self, agent_id: str, event_types: List[str]) -> Dict[str, Any]:
        """
        Subscribe to event types
        
        Args:
            agent_id: Agent ID
            event_types: List of event types to subscribe to
            
        Returns:
            Subscription response
        """
        payload = {'event_types': event_types}
        return self._request('POST', f'/api/v1/agents/{agent_id}/subscriptions', json=payload)
    
    # =========================================================================
    # EVENT HANDLING
    # =========================================================================
    
    def send_test_event(self, agent_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a test event
        
        Args:
            agent_id: Agent ID
            event: Event data with type and payload
            
        Returns:
            Event response
        """
        payload = {
            'type': event['type'],
            'payload': event['payload'],
            'timestamp': datetime.utcnow().isoformat(),
            'test': True,
        }
        
        return self._request('POST', f'/api/v1/agents/{agent_id}/test-event', json=payload)
    
    def send_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send an event to the platform
        
        Args:
            event: Event data with type, payload, user_id
            
        Returns:
            Event response
        """
        payload = {
            'type': event['type'],
            'payload': event['payload'],
            'user_id': event['user_id'],
            'timestamp': datetime.utcnow().isoformat(),
            'source': 'plugin',
        }
        
        return self._request('POST', '/api/v1/events', json=payload)
    
    @staticmethod
    def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
        """
        Verify webhook signature
        
        Args:
            payload: Request payload
            signature: Request signature header
            secret: Webhook secret
            
        Returns:
            True if signature is valid
        """
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def get_current_user(self) -> Dict[str, Any]:
        """
        Get current user info
        
        Returns:
            User data
        """
        return self._request('GET', '/api/v1/user/me')
    
    def check_agent_health(self, agent_id: str) -> Dict[str, Any]:
        """
        Check agent health
        
        Args:
            agent_id: Agent ID
            
        Returns:
            Health status
        """
        return self._request('GET', f'/api/v1/agents/{agent_id}/health')
