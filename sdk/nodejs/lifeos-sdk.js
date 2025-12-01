/**
 * LifeOS Node.js SDK
 * Allows third-party developers to build plugins and agents
 * @version 1.0.0
 */

const axios = require('axios');
const crypto = require('crypto');

class LifeOSSDK {
  /**
   * Initialize the SDK
   * @param {Object} config - Configuration object
   * @param {string} config.apiUrl - LifeOS API URL
   * @param {string} config.clientId - OAuth client ID
   * @param {string} config.clientSecret - OAuth client secret
   * @param {string} config.redirectUri - OAuth redirect URI
   */
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:8000';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.accessToken = null;
    this.refreshToken = null;
    
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
    });
    
    // Request interceptor for auth
    this.axiosInstance.interceptors.request.use(async (config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
    
    // Response interceptor for token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.refreshToken) {
          await this.refreshAccessToken();
          return this.axiosInstance.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  /**
   * Get OAuth authorization URL
   * @param {string} state - Random state for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:nodes write:nodes register:agent send:events',
      state: state || crypto.randomBytes(16).toString('hex'),
    });
    
    return `${this.apiUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token response
   */
  async getAccessToken(code) {
    try {
      const response = await axios.post(`${this.apiUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      });
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      return response.data;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.apiUrl}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });
      
      this.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }
      
      return response.data;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Set access token manually
   * @param {string} accessToken - Access token
   * @param {string} refreshToken - Refresh token (optional)
   */
  setTokens(accessToken, refreshToken = null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  // =========================================================================
  // PMG NODE OPERATIONS (with RBAC)
  // =========================================================================

  /**
   * Create a new PMG node
   * @param {Object} node - Node data
   * @param {string} node.type - Node type (document, note, task, etc)
   * @param {Object} node.content - Node content
   * @param {Object} node.metadata - Node metadata
   * @param {Array} node.tags - Node tags
   * @returns {Promise<Object>} Created node
   */
  async createNode(node) {
    try {
      const response = await this.axiosInstance.post('/api/v1/nodes', {
        type: node.type,
        content: node.content,
        metadata: node.metadata || {},
        tags: node.tags || [],
        source: 'plugin',
        created_at: new Date().toISOString(),
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create node: ${error.message}`);
    }
  }

  /**
   * Read a PMG node by ID
   * @param {string} nodeId - Node ID
   * @returns {Promise<Object>} Node data
   */
  async getNode(nodeId) {
    try {
      const response = await this.axiosInstance.get(`/api/v1/nodes/${nodeId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get node: ${error.message}`);
    }
  }

  /**
   * Update a PMG node
   * @param {string} nodeId - Node ID
   * @param {Object} updates - Node updates
   * @returns {Promise<Object>} Updated node
   */
  async updateNode(nodeId, updates) {
    try {
      const response = await this.axiosInstance.patch(`/api/v1/nodes/${nodeId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update node: ${error.message}`);
    }
  }

  /**
   * Delete a PMG node
   * @param {string} nodeId - Node ID
   * @returns {Promise<Object>} Deletion response
   */
  async deleteNode(nodeId) {
    try {
      const response = await this.axiosInstance.delete(`/api/v1/nodes/${nodeId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete node: ${error.message}`);
    }
  }

  /**
   * Query PMG nodes with filters
   * @param {Object} query - Query parameters
   * @param {string} query.type - Node type filter
   * @param {Array} query.tags - Tag filters
   * @param {Date} query.fromDate - Date range start
   * @param {Date} query.toDate - Date range end
   * @param {number} query.limit - Result limit
   * @returns {Promise<Array>} List of nodes
   */
  async queryNodes(query = {}) {
    try {
      const params = new URLSearchParams();
      if (query.type) params.append('type', query.type);
      if (query.tags) params.append('tags', query.tags.join(','));
      if (query.fromDate) params.append('from', query.fromDate.toISOString());
      if (query.toDate) params.append('to', query.toDate.toISOString());
      if (query.limit) params.append('limit', query.limit);
      
      const response = await this.axiosInstance.get(`/api/v1/nodes?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to query nodes: ${error.message}`);
    }
  }

  /**
   * Create relationship between nodes
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {string} relationshipType - Type of relationship
   * @returns {Promise<Object>} Relationship data
   */
  async createRelationship(sourceId, targetId, relationshipType) {
    try {
      const response = await this.axiosInstance.post('/api/v1/relationships', {
        source_id: sourceId,
        target_id: targetId,
        type: relationshipType,
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create relationship: ${error.message}`);
    }
  }

  // =========================================================================
  // AGENT REGISTRATION
  // =========================================================================

  /**
   * Register a new agent
   * @param {Object} agent - Agent configuration
   * @param {string} agent.name - Agent name
   * @param {string} agent.description - Agent description
   * @param {string} agent.version - Agent version
   * @param {Array} agent.capabilities - Agent capabilities
   * @param {Object} agent.endpoints - Callback endpoints
   * @param {string} agent.endpoints.webhook - Webhook URL for events
   * @param {string} agent.endpoints.health - Health check URL
   * @returns {Promise<Object>} Registered agent data
   */
  async registerAgent(agent) {
    try {
      const response = await this.axiosInstance.post('/api/v1/agents/register', {
        name: agent.name,
        description: agent.description,
        version: agent.version,
        capabilities: agent.capabilities || [],
        endpoints: {
          webhook: agent.endpoints.webhook,
          health: agent.endpoints.health,
        },
        metadata: agent.metadata || {},
        registered_at: new Date().toISOString(),
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to register agent: ${error.message}`);
    }
  }

  /**
   * Update agent configuration
   * @param {string} agentId - Agent ID
   * @param {Object} updates - Agent updates
   * @returns {Promise<Object>} Updated agent data
   */
  async updateAgent(agentId, updates) {
    try {
      const response = await this.axiosInstance.patch(`/api/v1/agents/${agentId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update agent: ${error.message}`);
    }
  }

  /**
   * Unregister an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Unregistration response
   */
  async unregisterAgent(agentId) {
    try {
      const response = await this.axiosInstance.delete(`/api/v1/agents/${agentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to unregister agent: ${error.message}`);
    }
  }

  /**
   * Subscribe to event types
   * @param {string} agentId - Agent ID
   * @param {Array<string>} eventTypes - Event types to subscribe to
   * @returns {Promise<Object>} Subscription response
   */
  async subscribeToEvents(agentId, eventTypes) {
    try {
      const response = await this.axiosInstance.post(`/api/v1/agents/${agentId}/subscriptions`, {
        event_types: eventTypes,
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to subscribe to events: ${error.message}`);
    }
  }

  // =========================================================================
  // EVENT HANDLING
  // =========================================================================

  /**
   * Send a test event
   * @param {string} agentId - Agent ID
   * @param {Object} event - Event data
   * @param {string} event.type - Event type
   * @param {Object} event.payload - Event payload
   * @returns {Promise<Object>} Event response
   */
  async sendTestEvent(agentId, event) {
    try {
      const response = await this.axiosInstance.post(`/api/v1/agents/${agentId}/test-event`, {
        type: event.type,
        payload: event.payload,
        timestamp: new Date().toISOString(),
        test: true,
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send test event: ${error.message}`);
    }
  }

  /**
   * Send an event to the platform
   * @param {Object} event - Event data
   * @param {string} event.type - Event type
   * @param {Object} event.payload - Event payload
   * @param {string} event.userId - User ID
   * @returns {Promise<Object>} Event response
   */
  async sendEvent(event) {
    try {
      const response = await this.axiosInstance.post('/api/v1/events', {
        type: event.type,
        payload: event.payload,
        user_id: event.userId,
        timestamp: new Date().toISOString(),
        source: 'plugin',
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send event: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Request payload
   * @param {string} signature - Request signature header
   * @param {string} secret - Webhook secret
   * @returns {boolean} Signature is valid
   */
  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get current user info
   * @returns {Promise<Object>} User data
   */
  async getCurrentUser() {
    try {
      const response = await this.axiosInstance.get('/api/v1/user/me');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Check agent health
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Health status
   */
  async checkAgentHealth(agentId) {
    try {
      const response = await this.axiosInstance.get(`/api/v1/agents/${agentId}/health`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to check agent health: ${error.message}`);
    }
  }
}

module.exports = LifeOSSDK;
