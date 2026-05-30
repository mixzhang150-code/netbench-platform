import { createLogger } from '@netbench/logger';
import { HttpTestRequest, HttpTestResult, TargetLocation } from '@netbench/types';

const logger = createLogger('http-engine');

const IP_API_URL = process.env.IP_API_URL || 'https://api.hydun.com/api/ip/index.php';
const IP_API_KEY = process.env.IP_API_KEY || '3236faee46ebc07981794439846cfaf9';

interface TimingInfo {
  dnsTime: number;
  tcpTime: number;
  tlsTime: number;
  ttfb: number;
  totalTime: number;
}

export class HttpEngine {
  async execute(request: HttpTestRequest, nodeId: string, nodeLocation: string): Promise<HttpTestResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      expectedStatus,
      timeout = 10000,
      followRedirects = true,
      validateCert = true,
    } = request;

    logger.info('Executing HTTP test', { url, method });

    const timings: TimingInfo = {
      dnsTime: 0,
      tcpTime: 0,
      tlsTime: 0,
      ttfb: 0,
      totalTime: 0,
    };

    const startTime = performance.now();
    let dnsStart: number;
    let tcpStart: number;
    let tlsStart: number;
    let ttfbStart: number;
    let resolvedIp: string | undefined;
    let targetLocation: import('@netbench/types').TargetLocation | undefined;

    try {
      const parsedUrl = new URL(url);

      dnsStart = performance.now();
      resolvedIp = await this.resolveDns(parsedUrl.hostname);
      targetLocation = await this.resolveTargetLocation(resolvedIp);
      timings.dnsTime = performance.now() - dnsStart;

      tcpStart = performance.now();
      timings.tcpTime = 0;

      if (parsedUrl.protocol === 'https:') {
        tlsStart = performance.now();
        timings.tlsTime = 0;
      }

      ttfbStart = performance.now();

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'NetBench/1.0',
        ...headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = body;
        if (!fetchHeaders['Content-Type']) {
          fetchHeaders['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      timings.ttfb = performance.now() - ttfbStart;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();
      timings.totalTime = performance.now() - startTime;

      let success = true;
      let errorMessage: string | undefined;

      if (expectedStatus && expectedStatus.length > 0) {
        if (!expectedStatus.includes(response.status)) {
          success = false;
          errorMessage = `Expected status ${expectedStatus.join('/')}, got ${response.status}`;
        }
      }

      if (!validateCert && parsedUrl.protocol === 'https:') {
        logger.info('Certificate validation skipped', { url });
      }

      return {
        id: `http_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        url,
        method,
        resolvedIp,
        targetLocation,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        statusText: response.statusText,
        responseTime: timings.totalTime,
        ttfb: timings.ttfb,
        dnsTime: timings.dnsTime,
        tcpTime: timings.tcpTime,
        tlsTime: timings.tlsTime,
        downloadSize: responseBody.length,
        headers: responseHeaders,
        success,
        errorMessage,
        nodeId,
        nodeLocation,
      };
    } catch (error) {
      timings.totalTime = performance.now() - startTime;

      const err = error as Error;
      let errorMessage = err.message;

      if (err.name === 'AbortError') {
        errorMessage = `Request timed out after ${timeout}ms`;
      }

      return {
        id: `http_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        url,
        method,
        resolvedIp,
        targetLocation,
        timestamp: new Date().toISOString(),
        statusCode: 0,
        statusText: 'Error',
        responseTime: timings.totalTime,
        ttfb: 0,
        dnsTime: timings.dnsTime,
        tcpTime: timings.tcpTime,
        tlsTime: timings.tlsTime,
        downloadSize: 0,
        headers: {},
        success: false,
        errorMessage,
        nodeId,
        nodeLocation,
      };
    }
  }

  private async resolveDns(hostname: string): Promise<string> {
    const { lookup } = await import('dns');
    const { promisify } = await import('util');
    const lookupAsync = promisify(lookup);
    const result = await lookupAsync(hostname);
    return result.address;
  }

  private async resolveTargetLocation(ip: string): Promise<TargetLocation | undefined> {
    try {
      const url = IP_API_URL + '?source=ip9&apikey=' + IP_API_KEY + '&type=ip&content=' + ip;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await response.json() as { code: number; data: { ip: string; info: Record<string, string> } };
      if (data.code === 200 && data.data?.info) {
        const info = data.data.info;
        return {
          ip: data.data.ip || ip,
          country: info.country || '',
          region: info.region || '',
          city: info.city || '',
          isp: info.isp || '',
          lat: info.lat,
          lng: info.lng,
        };
      }
    } catch (e) {
      logger.warn('Failed to resolve target location', { ip, error: (e as Error).message });
    }
    return undefined;
  }
}
