// frontend/src/api/index.js  ── ADDITIONS ONLY
// =====================================================================
// ADD these two functions to your existing api/index.js file.
// Find the export block at the bottom and add planCampaign + previewSegment.
// =====================================================================

import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
});

// ── Existing exports (keep yours, these are for reference) ───────────
export const getCustomers    = ()      => API.get('/api/customers/');
export const seedCustomers   = ()      => API.post('/api/customers/seed');
export const resetDB         = ()      => API.post('/api/customers/reset');
export const uploadCustomers = (data)  => API.post('/api/customers/upload', data);

export const getSegments      = ()     => API.get('/api/segments/');
export const createSegment    = (data) => API.post('/api/segments/', data);
export const generateSegmentSQL = (nl) => API.post('/api/ai/segment', { query: nl });

export const getCampaigns  = ()      => API.get('/api/campaigns/');
export const createCampaign = (data) => API.post('/api/campaigns/', data);
export const sendCampaign  = (id)    => API.post(`/api/campaigns/${id}/send`);
export const draftMessage  = (data)  => API.post('/api/ai/message', data);

export const getInsights      = ()     => API.get('/api/insights/overview');
export const getAISummary     = (data) => API.post('/api/ai/insights', data);
export const sendChatMessage  = (msg)  => API.post('/api/ai/chat', { message: msg });

// ── NEW: Add these two ───────────────────────────────────────────────

// Previews how many customers match a raw SQL query
// Used in Segments.js after NL→SQL generation
export const previewSegment = (sql) =>
  API.post('/api/segments/preview', { sql_query: sql });

// Sends a broad goal to the AI planner endpoint
// Returns { campaigns: [{ title, segment, channel, message }, ...] }
export const planCampaign = (goal) =>
  API.post('/api/ai/plan', { goal });
