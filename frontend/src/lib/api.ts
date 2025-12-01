import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// API methods
export const nodesApi = {
  getAll: () => apiClient.get('/nodes'),
  getById: (id: string) => apiClient.get(`/nodes/${id}`),
  create: (data: { label: string; properties?: any }) => apiClient.post('/nodes', data),
  delete: (id: string) => apiClient.delete(`/nodes/${id}`),
};

export const vectorsApi = {
  upsert: (data: { vectors: any[]; namespace?: string }) => apiClient.post('/vectors/upsert', data),
  query: (data: { vector: number[]; topK?: number; namespace?: string; filter?: any }) =>
    apiClient.post('/vectors/query', data),
  delete: (data: { ids: string[]; namespace?: string }) => apiClient.post('/vectors/delete', data),
};

export const jobsApi = {
  create: (data: { name: string; data?: any; options?: any }) => apiClient.post('/jobs', data),
  getById: (id: string) => apiClient.get(`/jobs/${id}`),
  getStats: () => apiClient.get('/jobs/stats/overview'),
};
