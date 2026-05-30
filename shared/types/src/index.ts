export interface TargetLocation {
  ip: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  lat?: string;
  lng?: string;
}

export interface PingTestRequest {
  target: string;
  count: number;
  timeout: number;
  interval: number;
  nodeId?: string;
}

export interface PingTestResult {
  id: string;
  target: string;
  resolvedIp?: string;
  targetLocation?: TargetLocation;
  timestamp: string;
  packetsSent: number;
  packetsReceived: number;
  packetLoss: number;
  minRtt: number;
  maxRtt: number;
  avgRtt: number;
  stddevRtt: number;
  rtts: number[];
  nodeId: string;
  nodeLocation: string;
}

export interface HttpTestRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  expectedStatus?: number[];
  timeout: number;
  followRedirects: boolean;
  validateCert: boolean;
  nodeId?: string;
}

export interface HttpTestResult {
  id: string;
  url: string;
  method: string;
  resolvedIp?: string;
  targetLocation?: TargetLocation;
  timestamp: string;
  statusCode: number;
  statusText: string;
  responseTime: number;
  ttfb: number;
  dnsTime: number;
  tcpTime: number;
  tlsTime: number;
  downloadSize: number;
  headers: Record<string, string>;
  success: boolean;
  errorMessage?: string;
  nodeId: string;
  nodeLocation: string;
}

export interface SpeedTestRequest {
  nodeId?: string;
  downloadUrls?: string[];
  uploadUrl?: string;
  duration: number;
  parallel: number;
}

export interface SpeedTestResult {
  id: string;
  timestamp: string;
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  serverId: string;
  serverLocation: string;
  nodeId: string;
  nodeLocation: string;
  downloadBytes: number;
  uploadBytes: number;
}

export interface TestTask {
  id: string;
  type: 'ping' | 'http' | 'speedtest';
  status: 'pending' | 'dispatched' | 'running' | 'completed' | 'failed' | 'timeout';
  request: PingTestRequest | HttpTestRequest | SpeedTestRequest;
  result?: PingTestResult | HttpTestResult | SpeedTestResult;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  userId: string;
  assignedNodeId?: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

export interface NodeInfo {
  id: string;
  name: string;
  ownerId: string | null;
  status: 'online' | 'offline' | 'maintenance' | 'suspended';
  version: string;
  platform: 'windows' | 'macos' | 'linux';
  platformDetails: string;
  ip: string;
  location: {
    country: string;
    region: string;
    city: string;
    lat: number;
    lon: number;
    isp: string;
  };
  capabilities: NodeCapabilities;
  reputation: NodeReputation;
  stats: NodeStats;
  lastHeartbeat: string;
  registeredAt: string;
  token: string;
  sponsor?: string;
}

export interface NodeCapabilities {
  ping: boolean;
  http: boolean;
  speedtest: boolean;
  maxConcurrentTasks: number;
  bandwidthLimit: number;
}

export interface NodeReputation {
  score: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgResponseTime: number;
  uptime: number;
  lastEvaluated: string;
}

export interface NodeStats {
  currentTasks: number;
  totalTasksCompleted: number;
  totalUptime: number;
  lastTestAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'sponsor' | 'user';
  nodes: string[];
  createdAt: string;
  lastLogin: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  defaultPingCount: number;
  defaultTimeout: number;
  defaultHttpMethod: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  checks: {
    name: string;
    status: 'up' | 'down';
    latency?: number;
    message?: string;
  }[];
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notifyChannels: string[];
}

export interface TestReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  tasks: string[];
  createdAt: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    avgResponseTime: number;
  };
}
