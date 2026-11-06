// frontend/src/services/api.js
// Axios client with interceptors + typed API modules.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies for session-based auth
});

// ── Request interceptor — attach auth token if present ────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 globally ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Phase 2: redirect to login / clear session
      console.warn('[API] 401 Unauthorized — will redirect to login in Phase 2.');
    }
    return Promise.reject(error);
  },
);

// ── Typed API modules ─────────────────────────────────────────────────────────

export const healthApi = {
  /** GET /api/health */
  getHealth: () => apiClient.get('/health'),
};

export const authApi = {
  /** Get Google OAuth consent screen URL */
  getGoogleAuthUrl: () => apiClient.get('/auth/google?json=true'),
  /** Fetch current authenticated user */
  getMe: () => apiClient.get('/auth/me'),
  /** Terminate session */
  logout: () => apiClient.post('/auth/logout'),
};

export const gmailApi = {
  /** GET /api/gmail/status */
  getStatus: (accountId) => apiClient.get('/gmail/status', { params: { accountId } }),
  /** GET /api/gmail/sync/status */
  getSyncStatus: (accountId) => apiClient.get('/gmail/sync/status', { params: { accountId } }),
  /** GET /api/gmail/profile */
  getProfile: (accountId) => apiClient.get('/gmail/profile', { params: { accountId } }),
  /** POST /api/gmail/sync */
  syncEmails: (limit = 20, accountId) => apiClient.post('/gmail/sync', { limit, accountId }),
  /** POST /api/gmail/watch/start */
  startWatch: (accountId) => apiClient.post('/gmail/watch/start', { accountId }),
  /** POST /api/gmail/watch/renew */
  renewWatch: (accountId) => apiClient.post('/gmail/watch/renew', { accountId }),
  /** GET /api/gmail/emails */
  getEmails: (params = {}) => apiClient.get('/gmail/emails', { params }),
  /** DELETE /api/gmail/disconnect */
  disconnect: (accountId) => apiClient.delete('/gmail/disconnect', { data: { accountId } }),
};

export const analysisApi = {
  /** POST /api/emails/:id/summarize */
  summarizeEmail: (emailId, force = false) => apiClient.post(`/emails/${emailId}/summarize`, { force }),
  /** GET /api/emails/:id/summary */
  getEmailSummary: (emailId) => apiClient.get(`/emails/${emailId}/summary`),
  /** GET /api/summaries */
  getSummaries: (params = {}) => apiClient.get('/summaries', { params }),
  /** GET /api/summaries/:id */
  getSummaryById: (id) => apiClient.get(`/summaries/${id}`),
  /** GET /api/actions */
  getActionItems: (params = {}) => apiClient.get('/actions', { params }),
};


