import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('netbench_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('netbench_token');
      if (token) {
        localStorage.removeItem('netbench_token');
        localStorage.removeItem('netbench_user');
        const adminPaths = ['/api/monitor', '/api/users/profile'];
        if (adminPaths.some(p => error.config?.url?.startsWith(p))) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface MultiPointPingRequest {
  target: string;
  count?: number;
  timeout?: number;
  interval?: number;
  maxNodes?: number;
}

export interface MultiPointHttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus?: number[];
  timeout?: number;
  followRedirects?: boolean;
  validateCert?: boolean;
  maxNodes?: number;
}

export interface MultiPointSpeedTestRequest {
  duration?: number;
  parallel?: number;
  maxNodes?: number;
}

export interface BatchTestResponse {
  batchId: string;
  type: string;
  target: string;
  totalNodes: number;
  status: string;
  createdAt: string;
}

export interface NodeTestResult {
  taskId: string;
  nodeId: string;
  nodeName: string;
  nodeLocation: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: Record<string, unknown>;
  completedAt?: string;
  sponsor?: string;
}

export interface BatchDetail {
  id: string;
  type: string;
  target: string;
  status: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  tasks: NodeTestResult[];
  createdAt: string;
  completedAt?: string;
}

export const testApi = {
  ping: (data: MultiPointPingRequest) =>
    api.post<{ success: boolean; data: BatchTestResponse }>('/test/ping', data),
  http: (data: MultiPointHttpRequest) =>
    api.post<{ success: boolean; data: BatchTestResponse }>('/test/http', data),
  speedtest: (data: MultiPointSpeedTestRequest) =>
    api.post<{ success: boolean; data: BatchTestResponse }>('/test/speedtest', data),
  getBatch: (batchId: string) =>
    api.get<{ success: boolean; data: BatchDetail }>(`/batch/${batchId}`),
  getResults: (batchId: string) =>
    api.get<{ success: boolean; data: NodeTestResult[] }>(`/batch/${batchId}/results`),
  stats: () =>
    api.get<{ success: boolean; data: { totalTests: number; todayTests: number; avgLatency: number; date: string } }>('/test/stats'),
};

export interface SponsorShowcaseItem {
  id: string;
  name: string;
  logo?: string;
  url?: string;
  description?: string;
  position: 'top' | 'sidebar' | 'footer';
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SponsorShowcaseConfig {
  id: string;
  page: 'ping' | 'http' | 'dashboard' | 'sponsor';
  enabled: boolean;
  title?: string;
  style: 'grid' | 'carousel' | 'list';
  maxItems: number;
  sponsors: SponsorShowcaseItem[];
}

export const sponsorShowcaseApi = {
  getPageConfig: (page: string) =>
    api.get<{ success: boolean; data: SponsorShowcaseConfig }>(`/sponsor-showcase/config/${page}`),
  getAllConfigs: () =>
    api.get<{ success: boolean; data: SponsorShowcaseConfig[] }>('/sponsor-showcase/configs'),
  updatePageConfig: (page: string, data: Partial<SponsorShowcaseConfig>) =>
    api.put(`/sponsor-showcase/config/${page}`, data),
  listSponsors: (position?: string) =>
    api.get<{ success: boolean; data: SponsorShowcaseItem[] }>('/sponsor-showcase/sponsors', { params: { position } }),
  createSponsor: (data: Omit<SponsorShowcaseItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ success: boolean; data: SponsorShowcaseItem }>('/sponsor-showcase/sponsors', data),
  updateSponsor: (id: string, data: Partial<SponsorShowcaseItem>) =>
    api.put(`/sponsor-showcase/sponsors/${id}`, data),
  deleteSponsor: (id: string) =>
    api.delete(`/sponsor-showcase/sponsors/${id}`),
  updateOrder: (orders: Array<{ id: string; order: number }>) =>
    api.put('/sponsor-showcase/sponsors/order', { orders }),
};

export const nodeApi = {
  list: (page?: number, limit?: number, status?: string) =>
    api.get('/nodes/nodes', { params: { page, limit, status } }),
  get: (id: string) => api.get(`/nodes/nodes/${id}`),
  delete: (id: string) => api.delete(`/nodes/nodes/${id}`),
  update: (id: string, data: unknown) => api.put(`/nodes/nodes/${id}`, data),
  register: (data: unknown) => api.post('/nodes/register', data),
  checkName: (name: string) => api.post('/nodes/check-name', { name }),
  getSponsor: (id: string) => api.get(`/nodes/nodes/${id}/sponsor`),
  updateSponsor: (id: string, sponsor: string) => api.put(`/nodes/nodes/${id}/sponsor`, { sponsor }),
  adminList: (page?: number, limit?: number, status?: string, search?: string) =>
    api.get('/nodes/admin/nodes', { params: { page, limit, status, search } }),
  batchUpdateSponsor: (updates: Array<{ nodeId: string; sponsor: string }>) =>
    api.post('/nodes/admin/nodes/batch-sponsor', { updates }),
  exportNodes: () => api.get('/nodes/admin/nodes/export'),
  publicStats: () => api.get('/nodes/public/stats'),
};

export const userApi = {
  login: (username: string, password: string) =>
    api.post('/users/login', { username, password }),
  register: (username: string, email: string, password: string, role?: string) =>
    api.post('/users/register', { username, email, password, role }),
  profile: () => api.get('/users/profile'),
  updateProfile: (data: unknown) => api.put('/users/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/password', { currentPassword, newPassword }),
  list: (page?: number, limit?: number) =>
    api.get('/users/users', { params: { page, limit } }),
  updateRole: (userId: string, role: string) =>
    api.put(`/users/users/${userId}/role`, { role }),
};

export const monitorApi = {
  health: () => api.get('/services/health'),
  services: () => api.get('/services/health'),
  alerts: () => api.get('/monitor/alerts'),
  alertRules: () => api.get('/monitor/rules'),
};

export const dataApi = {
  history: (params: { type?: string; nodeId?: string; startTime?: string; endTime?: string; page?: number; limit?: number }) =>
    api.get('/data/history', { params }),
  trend: (type: string, target?: string, period?: string, points?: number) =>
    api.get('/data/trend', { params: { type, target, period, points } }),
  report: (title: string, taskIds: string[], description?: string) =>
    api.post('/data/report', { title, taskIds, description }),
};

export function createTestWebSocket(onMessage: (data: { type: string; data: unknown }) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', data: { channels: ['test:result'] } }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      onMessage(message);
    } catch {}
  };

  return ws;
}

export default api;
