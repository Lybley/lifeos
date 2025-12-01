import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== ACTION ENGINE ====================
  
  async createAction(data: {
    user_id: string;
    action_type: string;
    payload: any;
    priority?: number;
    scheduled_for?: string;
  }) {
    const response = await this.client.post('/actions', data);
    return response.data;
  }

  async approveAction(actionId: string, approvedBy: string) {
    const response = await this.client.post(`/actions/${actionId}/approve`, { approved_by: approvedBy });
    return response.data;
  }

  async rejectAction(actionId: string, rejectedBy: string, reason: string) {
    const response = await this.client.post(`/actions/${actionId}/reject`, { rejected_by: rejectedBy, reason });
    return response.data;
  }

  async getAction(actionId: string) {
    const response = await this.client.get(`/actions/${actionId}`);
    return response.data;
  }

  async getUserActions(userId: string, limit = 50, offset = 0) {
    const response = await this.client.get(`/actions/user/${userId}`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async getActionAuditLogs(actionId: string) {
    const response = await this.client.get(`/actions/${actionId}/audit`);
    return response.data;
  }

  async getRateLimits(userId: string, actionType: string) {
    const response = await this.client.get(`/actions/rate-limits/${userId}/${actionType}`);
    return response.data;
  }

  async rollbackAction(actionId: string, rolledBackBy: string, reason: string) {
    const response = await this.client.post(`/actions/${actionId}/rollback`, {
      rolled_back_by: rolledBackBy,
      reason,
    });
    return response.data;
  }

  // ==================== RAG ====================
  
  async ragQuery(query: string, userId: string, filters?: any) {
    const response = await this.client.post('/v1/rag/query', {
      query,
      user_id: userId,
      filters,
    });
    return response.data;
  }

  // ==================== AI AGENTS ====================
  
  async extractTasks(text: string, userId: string, metadata?: any) {
    const response = await this.client.post('/v1/agents/extract-tasks', {
      text,
      user_id: userId,
      metadata,
    });
    return response.data;
  }

  async summarizeDocument(documentId: string, userId: string, style?: 'brief' | 'detailed') {
    const response = await this.client.post('/v1/agents/summarize', {
      document_id: documentId,
      user_id: userId,
      style,
    });
    return response.data;
  }

  async draftReply(messageId: string, userId: string, context?: any) {
    const response = await this.client.post('/v1/agents/draft-reply', {
      message_id: messageId,
      user_id: userId,
      context,
    });
    return response.data;
  }

  // ==================== GRAPH NODES ====================
  
  async getNodes(params?: any) {
    const response = await this.client.get('/nodes', { params });
    return response.data;
  }

  async createNode(nodeData: any) {
    const response = await this.client.post('/nodes', nodeData);
    return response.data;
  }

  async updateNode(nodeId: string, nodeData: any) {
    const response = await this.client.put(`/nodes/${nodeId}`, nodeData);
    return response.data;
  }

  async deleteNode(nodeId: string) {
    const response = await this.client.delete(`/nodes/${nodeId}`);
    return response.data;
  }

  // ==================== VECTOR SEARCH ====================
  
  async vectorSearch(query: string, limit = 10) {
    const response = await this.client.post('/vectors/search', { query, limit });
    return response.data;
  }

  async upsertVector(data: any) {
    const response = await this.client.post('/vectors', data);
    return response.data;
  }

  // ==================== JOBS ====================
  
  async getJobs(status?: string) {
    const response = await this.client.get('/jobs', {
      params: status ? { status } : undefined,
    });
    return response.data;
  }

  async getJob(jobId: string) {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
