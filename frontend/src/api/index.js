
import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
});

// ── Existing exports (keep yours, these are for reference) ───────────
export const getCustomers = () => API.get('/api/customers/');
export const seedCustomers = () => API.post('/api/customers/seed');
export const resetDB = () => API.post('/api/customers/reset');
export const uploadCustomers = (data) => API.post('/api/customers/upload', data);

export const getSegments = () => API.get('/api/segments/');
export const createSegment = (data) => API.post('/api/segments/', data);
export const generateSegmentSQL = (nl) => API.post('/api/ai/segment', { query: nl });

export const getCampaigns = () => API.get('/api/campaigns/');
export const createCampaign = (data) => API.post('/api/campaigns/', data);
export const sendCampaign = (id) => API.post(`/api/campaigns/${id}/send`);
export const draftMessage = (data) => API.post('/api/ai/message', data);

export const getInsights = () => API.get('/api/insights/overview');
export const getAISummary = (data) => API.post('/api/ai/insights', data);
export const sendChatMessage = (msg) => API.post('/api/ai/chat', { message: msg });

// ── NEW: Add these two ───────────────────────────────────────────────

// Previews how many customers match a raw SQL query
// Used in Segments.js after NL→SQL generation
export const previewSegment = (sql) =>
  API.post('/api/segments/preview', { sql_query: sql });

// Sends a broad goal to the AI planner endpoint
// Returns { campaigns: [{ title, segment, channel, message }, ...] }
export const planCampaign = (goal) =>
  API.post('/api/ai/plan', { goal });

// ── Namespace exports ───────────────────────────────────────────────
export const customersAPI = {
  list: (params) => API.get('/api/customers/', { params }),
  stats: () => API.get('/api/customers/stats'),
  seed: () => API.post('/api/customers/seed'),
  reset: () => API.post('/api/customers/reset'),
  upload: (data) => API.post('/api/customers/upload', data),
};

export const segmentsAPI = {
  list: () => API.get('/api/segments/'),
  create: (data) => API.post('/api/segments/', data),
  preview: (sql) => API.post('/api/segments/preview', { sql_query: sql }),
};

export const campaignsAPI = {
  list: () => API.get('/api/campaigns/'),
  create: (data) => API.post('/api/campaigns/', data),
  send: (id) => API.post(`/api/campaigns/${id}/send`),
  delete: (id) => API.delete(`/api/campaigns/${id}`),
};

export const insightsAPI = {
  overview: () => API.get('/api/insights/overview'),
  performance: () => API.get('/api/insights/campaigns/performance'),
  communications: () => API.get('/api/insights/communications'),
};

export const aiAPI = {
  chat: (msg) => typeof msg === 'string' ? API.post('/api/ai/chat', { message: msg }) : API.post('/api/ai/chat', msg),
  message: (data) => API.post('/api/ai/message', data),
  insights: (data) => API.post('/api/ai/insights', data),
  segment: (nl) => API.post('/api/ai/segment', { query: nl }),
  recommendations: () => API.get('/api/ai/recommendations'),
  plan: (goal) => API.post('/api/ai/plan', { goal }),
};
