#!/usr/bin/env node

import axios, { AxiosError } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import * as os from 'os';
import si from 'systeminformation';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const execAsync = promisify(exec);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp: ts, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${ts} ${level} ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console({ format: winston.format.colorize() })],
});

const MAX_RETRY_DELAY = 300000;
const INITIAL_RETRY_DELAY = 5000;
const REGISTRATION_RETRY_INTERVAL = 60000;

export interface AgentConfig {
  serverUrl: string;
  token: string;
  name: string;
  heartbeatInterval: number;
}

interface TaskRequest {
  taskId: string;
  type: 'ping' | 'http' | 'speedtest';
  target: string;
  config: Record<string, unknown>;
}

interface TaskResult {
  taskId: string;
  nodeId: string;
  nodeName: string;
  nodeLocation: string;
  type: string;
  target: string;
  status: 'completed' | 'failed' | 'timeout';
  result: Record<string, unknown>;
  completedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class NodeAgent {
  private config: AgentConfig;
  private nodeId: string | null = null;
  private isRunning = false;
  private isRegistered = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private registrationTimer: NodeJS.Timeout | null = null;
  private api;
  private nodeInfo: { name: string; location: string } = { name: '', location: '' };
  private ipInfo: {
    ip: string; country: string; countryShort: string; region: string;
    city: string; isp: string; lat: number; lon: number;
  } | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: `${config.serverUrl}/api`,
      timeout: 15000,
      headers: {
        'X-Node-Token': config.token,
        'Content-Type': 'application/json',
      },
    });
  }

  async start(): Promise<void> {
    logger.info('Starting NetBench Node Agent...');
    this.isRunning = true;

    await this.detectLocation();

    try {
      await this.registerWithRetry();
    } catch {
      logger.warn('Initial registration failed, will keep retrying in background...');
    }

    this.startBackgroundRegistration();

    logger.info('Agent is running, waiting for registration...', {
      name: this.config.name,
      registered: this.isRegistered,
      nodeId: this.nodeId,
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.registrationTimer) { clearInterval(this.registrationTimer); this.registrationTimer = null; }
    logger.info('Agent stopped');
  }

  private async registerWithRetry(maxAttempts: number = 5): Promise<void> {
    let delay = INITIAL_RETRY_DELAY;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.register();
        this.isRegistered = true;
        this.onRegistered();
        return;
      } catch (error) {
        const axiosErr = error as AxiosError;
        const status = axiosErr.response?.status;
        const message = (error as Error).message;

        if (attempt < maxAttempts) {
          logger.warn(`Registration attempt ${attempt}/${maxAttempts} failed, retrying in ${delay / 1000}s...`, {
            error: message,
            status: status || 'N/A',
          });
          await sleep(delay);
          delay = Math.min(delay * 2, MAX_RETRY_DELAY);
        } else {
          logger.error(`Registration failed after ${maxAttempts} attempts`, { error: message, status: status || 'N/A' });
          throw error;
        }
      }
    }
  }

  private startBackgroundRegistration(): void {
    if (this.isRegistered) return;

    this.registrationTimer = setInterval(async () => {
      if (!this.isRunning || this.isRegistered) {
        if (this.registrationTimer) { clearInterval(this.registrationTimer); this.registrationTimer = null; }
        return;
      }

      try {
        logger.info('Retrying registration...');
        await this.register();
        this.isRegistered = true;
        this.onRegistered();
        if (this.registrationTimer) { clearInterval(this.registrationTimer); this.registrationTimer = null; }
      } catch (error) {
        logger.warn('Background registration retry failed, will try again later', {
          error: (error as Error).message,
        });
      }
    }, REGISTRATION_RETRY_INTERVAL);
  }

  private onRegistered(): void {
    logger.info('Agent registered successfully', {
      nodeId: this.nodeId,
      name: this.config.name,
      location: this.nodeInfo.location,
    });

    this.startHeartbeat();
    this.startTaskPolling();
  }

  private async detectLocation(): Promise<void> {
    try {
      logger.info('Detecting node location from IP...');
      const response = await axios.get(
        'https://api.hydun.com/api/ip/index.php?source=ip9&apikey=3236faee46ebc07981794439846cfaf9',
        { timeout: 10000 }
      );

      if (response.data?.code === 200 && response.data?.data?.info) {
        const info = response.data.data.info;
        this.ipInfo = {
          ip: response.data.data.ip || '',
          country: info.country || 'Unknown',
          countryShort: info.en_name_short || '',
          region: info.region || 'Unknown',
          city: info.city || 'Unknown',
          isp: info.isp || 'Unknown',
          lat: parseFloat(info.lat) || 0,
          lon: parseFloat(info.lng) || 0,
        };
        logger.info('Location detected', {
          ip: this.ipInfo.ip,
          country: this.ipInfo.country,
          region: this.ipInfo.region,
          city: this.ipInfo.city,
          isp: this.ipInfo.isp,
        });
        return;
      }
    } catch (error) {
      logger.warn('Primary IP API failed, trying fallback...', { error: (error as Error).message });
    }

    try {
      const fallbackResponse = await axios.get('http://ip-api.com/json/?lang=zh-CN', { timeout: 10000 });
      if (fallbackResponse.data?.status === 'success') {
        const d = fallbackResponse.data;
        this.ipInfo = {
          ip: d.query || '',
          country: d.country || 'Unknown',
          countryShort: d.countryCode || '',
          region: d.regionName || 'Unknown',
          city: d.city || 'Unknown',
          isp: d.isp || 'Unknown',
          lat: d.lat || 0,
          lon: d.lon || 0,
        };
        logger.info('Location detected via fallback', {
          ip: this.ipInfo.ip,
          country: this.ipInfo.country,
          region: this.ipInfo.region,
          city: this.ipInfo.city,
          isp: this.ipInfo.isp,
        });
        return;
      }
    } catch (error) {
      logger.warn('Fallback IP API also failed', { error: (error as Error).message });
    }

    logger.warn('All IP detection methods failed, using environment variables or defaults');
  }

  private async register(): Promise<void> {
    const systemInfo = await this.getSystemInfo();
    const loc = this.ipInfo;

    const response = await axios.post(`${this.config.serverUrl}/api/nodes/register`, {
      name: this.config.name,
      platform: this.getPlatform(),
      platformDetails: `${systemInfo.osName} ${systemInfo.osVersion}`,
      ip: loc?.ip || systemInfo.ip,
      location: {
        country: process.env.NODE_COUNTRY || loc?.country || 'Unknown',
        region: process.env.NODE_REGION || loc?.region || 'Unknown',
        city: process.env.NODE_CITY || loc?.city || 'Unknown',
        lat: parseFloat(process.env.NODE_LAT || String(loc?.lat || '0')),
        lon: parseFloat(process.env.NODE_LON || String(loc?.lon || '0')),
        isp: process.env.NODE_ISP || loc?.isp || 'Unknown',
      },
      capabilities: {
        ping: true,
        http: true,
        speedtest: true,
        maxConcurrentTasks: parseInt(process.env.MAX_TASKS || '5'),
      },
      version: '1.0.0',
    }, {
      timeout: 15000,
    });

    const { id, token, reRegistered } = response.data.data;
    this.nodeId = id;
    this.nodeInfo.name = this.config.name;
    this.nodeInfo.location = process.env.NODE_CITY || loc?.city || 'Unknown';

    if (token && token !== this.config.token) {
      this.config.token = token;
      this.api.defaults.headers['X-Node-Token'] = token;
    }

    logger.info(reRegistered ? 'Node re-registered (existing identity)' : 'Node registered', { nodeId: id, ip: loc?.ip, city: this.nodeInfo.location, isp: loc?.isp });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning || !this.nodeId) return;
      try {
        const stats = await this.getCurrentStats();
        await this.api.post('/nodes/heartbeat', { stats });
        logger.debug('Heartbeat sent');
      } catch (error) {
        logger.warn('Heartbeat failed', { error: (error as Error).message });
        if ((error as { response?: { status?: number } }).response?.status === 401) {
          logger.info('Token invalid, re-registering...');
          try {
            await this.register();
          } catch {
            logger.warn('Re-registration failed, will retry later');
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  private startTaskPolling(): void {
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning || !this.nodeId) return;
      try {
        const response = await this.api.get(`/nodes/${this.nodeId}/tasks`);
        if (response.data.success && response.data.data) {
          const tasks: TaskRequest[] = response.data.data;
          for (const task of tasks) {
            this.executeTask(task).catch(err => {
              logger.error('Task execution error', { taskId: task.taskId, error: (err as Error).message });
            });
          }
        }
      } catch (error) {
        logger.debug('Task poll failed', { error: (error as Error).message });
      }
    }, 5000);
  }

  private async executeTask(task: TaskRequest): Promise<void> {
    logger.info('Executing task', { taskId: task.taskId, type: task.type, target: task.target });

    const result: TaskResult = {
      taskId: task.taskId,
      nodeId: this.nodeId!,
      nodeName: this.nodeInfo.name,
      nodeLocation: this.nodeInfo.location,
      type: task.type,
      target: task.target,
      status: 'completed',
      result: {},
      completedAt: new Date().toISOString(),
    };

    try {
      switch (task.type) {
        case 'ping':
          result.result = await this.executePing(task.target, task.config);
          break;
        case 'http':
          result.result = await this.executeHttp(task.target, task.config);
          break;
        case 'speedtest':
          result.result = await this.executeSpeedtest(task.config);
          break;
        default:
          result.status = 'failed';
          result.result = { error: `Unknown task type: ${task.type}` };
      }
    } catch (error) {
      result.status = 'failed';
      result.result = { error: (error as Error).message };
    }

    try {
      await this.api.post(`/nodes/${this.nodeId}/task-result`, result);
      logger.info('Task result sent', { taskId: task.taskId, status: result.status });
    } catch (error) {
      logger.error('Failed to send task result', { taskId: task.taskId, error: (error as Error).message });
    }
  }

  private async resolveTargetIp(target: string): Promise<string> {
    const lookupAsync = promisify(dns.lookup);
    try {
      const result = await lookupAsync(target);
      return result.address;
    } catch { return target; }
  }

  private async resolveTargetLocation(ip: string): Promise<Record<string, string> | undefined> {
    try {
      const url = 'https://api.hydun.com/api/ip/index.php?source=ip9&apikey=3236faee46ebc07981794439846cfaf9&type=ip&content=' + ip;
      const response = await axios.get(url, { timeout: 5000 });
      if (response.data?.code === 200 && response.data?.data?.info) {
        const info = response.data.data.info;
        return { ip: response.data.data.ip || ip, country: info.country || '', region: info.region || '', city: info.city || '', isp: info.isp || '' };
      }
    } catch {}
    return undefined;
  }

  private async executePing(target: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const count = (config.count as number) || 4;
    const timeout = (config.timeout as number) || 5000;

    const resolvedIp = await this.resolveTargetIp(target);
    const targetLocation = await this.resolveTargetLocation(resolvedIp);

    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `ping -n ${count} -w ${timeout} ${target}`
      : `ping -c ${count} -W ${Math.ceil(timeout / 1000)} ${target}`;

    try {
      const { stdout } = await execAsync(cmd, { timeout: timeout * count + 5000 });
      return { ...this.parsePingOutput(stdout, isWin), resolvedIp, targetLocation };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string };
      if (err.stdout) {
        return { ...this.parsePingOutput(err.stdout, isWin), resolvedIp, targetLocation };
      }
      throw new Error(`Ping failed: ${err.stderr || (error as Error).message}`);
    }
  }

  private parsePingOutput(output: string, isWin: boolean): Record<string, unknown> {
    const result: Record<string, number> = {};

    if (isWin) {
      const minMatch = output.match(/Minimum\s*=\s*(\d+)/i);
      const maxMatch = output.match(/Maximum\s*=\s*(\d+)/i);
      const avgMatch = output.match(/Average\s*=\s*(\d+)/i);
      const lossMatch = output.match(/\((\d+)%\s*loss\)/i);
      const sentMatch = output.match(/Sent\s*=\s*(\d+)/i);
      const recvMatch = output.match(/Received\s*=\s*(\d+)/i);

      result.minRtt = minMatch ? parseFloat(minMatch[1]) : 0;
      result.maxRtt = maxMatch ? parseFloat(maxMatch[1]) : 0;
      result.avgRtt = avgMatch ? parseFloat(avgMatch[1]) : 0;
      result.packetLoss = lossMatch ? parseFloat(lossMatch[1]) : 100;
      result.packetsSent = sentMatch ? parseInt(sentMatch[1]) : 0;
      result.packetsReceived = recvMatch ? parseInt(recvMatch[1]) : 0;
    } else {
      const rttMatch = output.match(/rtt min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
      const lossMatch = output.match(/(\d+)%\s*packet\s*loss/);
      const statsMatch = output.match(/(\d+)\s*packets?\s*transmitted,\s*(\d+)/);

      result.minRtt = rttMatch ? parseFloat(rttMatch[1]) : 0;
      result.avgRtt = rttMatch ? parseFloat(rttMatch[2]) : 0;
      result.maxRtt = rttMatch ? parseFloat(rttMatch[3]) : 0;
      result.jitter = rttMatch ? parseFloat(rttMatch[4]) : 0;
      result.packetLoss = lossMatch ? parseFloat(lossMatch[1]) : 100;
      result.packetsSent = statsMatch ? parseInt(statsMatch[1]) : 0;
      result.packetsReceived = statsMatch ? parseInt(statsMatch[2]) : 0;
    }

    return result;
  }

  private async executeHttp(target: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const method = (config.method as string) || 'GET';
    const headers = (config.headers as Record<string, string>) || {};
    const body = config.body as string | undefined;
    const timeout = (config.timeout as number) || 10000;
    const followRedirects = config.followRedirects !== false;

    const url = target.startsWith('http') ? target : `https://${target}`;
    let resolvedIp: string | undefined;
    let targetLocation: Record<string, string> | undefined;
    try { const parsedUrl = new URL(url); resolvedIp = await this.resolveTargetIp(parsedUrl.hostname); targetLocation = await this.resolveTargetLocation(resolvedIp); } catch {}

    const startTime = Date.now();

    try {
      const fetchHeaders: Record<string, string> = { ...headers };
      if (body && !fetchHeaders['content-type']) {
        fetchHeaders['content-type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body || undefined,
        signal: AbortSignal.timeout(timeout),
        redirect: followRedirects ? 'follow' : 'manual',
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        statusCode: response.status,
        statusText: response.statusText,
        responseTime,
        ttfb: responseTime,
        downloadSize: responseBody.length,
        headers: Object.fromEntries(response.headers.entries()),
        resolvedIp,
        targetLocation,
        success: response.status >= 200 && response.status < 400,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        statusCode: 0,
        responseTime,
        resolvedIp,
        targetLocation,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async executeSpeedtest(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const duration = (config.duration as number) || 10;
    const parallel = (config.parallel as number) || 4;

    const downloadResult = await this.testDownload(duration, parallel);
    const uploadResult = await this.testUpload(duration, parallel);

    return {
      downloadSpeed: downloadResult.speed,
      uploadSpeed: uploadResult.speed,
      latency: downloadResult.latency,
      jitter: downloadResult.jitter,
      downloadBytes: downloadResult.bytes,
      uploadBytes: uploadResult.bytes,
      server: downloadResult.server,
    };
  }

  private async testDownload(duration: number, parallel: number): Promise<{ speed: number; bytes: number; latency: number; jitter: number; server: string }> {
    const testUrl = 'http://speedtest.tele2.net/1MB.zip';
    const startTime = Date.now();
    let totalBytes = 0;
    const latencies: number[] = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), duration * 1000 + 5000);

      while (Date.now() - startTime < duration * 1000) {
        const reqStart = Date.now();
        const response = await fetch(testUrl, {
          signal: controller.signal,
        });
        const buffer = await response.arrayBuffer();
        totalBytes += buffer.byteLength;
        latencies.push(Date.now() - reqStart);
      }

      clearTimeout(timeoutId);
    } catch {}

    const elapsed = (Date.now() - startTime) / 1000;
    const speedMbps = elapsed > 0 ? (totalBytes * 8) / (elapsed * 1000000) : 0;
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const jitter = latencies.length > 1
      ? latencies.slice(1).reduce((sum, val, i) => sum + Math.abs(val - latencies[i]), 0) / (latencies.length - 1)
      : 0;

    return { speed: speedMbps, bytes: totalBytes, latency: avgLatency, jitter, server: 'tele2' };
  }

  private async testUpload(duration: number, _parallel: number): Promise<{ speed: number; bytes: number }> {
    const testUrl = 'http://speedtest.tele2.net/upload.php';
    const startTime = Date.now();
    let totalBytes = 0;
    const chunkSize = 256 * 1024;
    const chunk = Buffer.alloc(chunkSize, 'x');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), duration * 1000 + 5000);

      while (Date.now() - startTime < duration * 1000) {
        try {
          await fetch(testUrl, {
            method: 'POST',
            body: chunk,
            signal: controller.signal,
          });
          totalBytes += chunkSize;
        } catch { break; }
      }

      clearTimeout(timeoutId);
    } catch {}

    const elapsed = (Date.now() - startTime) / 1000;
    const speedMbps = elapsed > 0 ? (totalBytes * 8) / (elapsed * 1000000) : 0;

    return { speed: speedMbps, bytes: totalBytes };
  }

  private async getSystemInfo(): Promise<{
    osName: string; osVersion: string; ip: string; isp: string;
  }> {
    try {
      const [osInfo, networkInterfaces] = await Promise.all([si.osInfo(), si.networkInterfaces()]);
      const defaultInterface = networkInterfaces.find(iface => iface.default) || networkInterfaces[0];
      return {
        osName: osInfo.distro,
        osVersion: osInfo.release,
        ip: defaultInterface?.ip4 || '0.0.0.0',
        isp: process.env.NODE_ISP || 'Unknown',
      };
    } catch {
      return { osName: process.platform, osVersion: 'unknown', ip: '0.0.0.0', isp: 'Unknown' };
    }
  }

  private async getCurrentStats(): Promise<Record<string, unknown>> {
    try {
      const [cpuLoad, memInfo] = await Promise.all([si.currentLoad(), si.mem()]);
      return {
        currentTasks: 0,
        totalTasksCompleted: 0,
        totalUptime: process.uptime(),
        cpuUsage: cpuLoad.currentLoad,
        memoryUsage: (memInfo.used / memInfo.total) * 100,
      };
    } catch {
      return { currentTasks: 0, totalTasksCompleted: 0, totalUptime: process.uptime(), cpuUsage: 0, memoryUsage: 0 };
    }
  }

  private getPlatform(): 'windows' | 'macos' | 'linux' {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'macos';
      default: return 'linux';
    }
  }
}
