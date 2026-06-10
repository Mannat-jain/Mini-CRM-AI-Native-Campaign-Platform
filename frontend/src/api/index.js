import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API_BASE });

export const customersAPI = {
  list: (params) => api.get('/api/customers/', { params }),
  create: (data) => api.post('/api/customers/', data),
  stats: () => api.get('/api/customers/stats'),
  seed: () => api.post('/api/customers/seed'),
  reset: () => api.post('/api/customers/reset'),
  upload: (formData) => api.post('/api/customers/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const segmentsAPI = {
  list: () => api.get('/api/segments/'),
  create: (data) => api.post('/api/segments/', data),
  preview: (sql_query) => api.post('/api/segments/preview', { sql_query }),
  getCustomers: (id) => api.get(`/api/segments/${id}/customers`),
  delete: (id) => api.delete(`/api/segments/${id}`),
};

export const campaignsAPI = {
  list: () => api.get('/api/campaigns/'),
  create: (data) => api.post('/api/campaigns/', data),
  send: (id) => api.post(`/api/campaigns/${id}/send`),
  stats: (id) => api.get(`/api/campaigns/${id}/stats`),
  delete: (id) => api.delete(`/api/campaigns/${id}`),
};

export const insightsAPI = {
  overview: () => api.get('/api/insights/overview'),
  performance: () => api.get('/api/insights/campaigns/performance'),
  channelBreakdown: () => api.get('/api/insights/channel/breakdown'),
};

export const aiAPI = {
  segment: (query) => api.post('/api/ai/segment', { query }),
  message: (data) => api.post('/api/ai/message', data),
  insights: (data) => api.post('/api/ai/insights', data),
  chat: (message) => api.post('/api/ai/chat', { message }),
};
