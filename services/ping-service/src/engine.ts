import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import { createLogger } from '@netbench/logger';
import { PingTestRequest, PingTestResult, TargetLocation } from '@netbench/types';

const logger = createLogger('ping-engine');
const execAsync = promisify(exec);
const dnsLookup = promisify(dns.lookup);

const IP_API_URL = process.env.IP_API_URL || 'https://api.hydun.com/api/ip/index.php';
const IP_API_KEY = process.env.IP_API_KEY || '3236faee46ebc07981794439846cfaf9';

export class PingEngine {
  async execute(request: PingTestRequest, nodeId: string, nodeLocation: string): Promise<PingTestResult> {
    const { target, count = 4, timeout = 5000, interval = 1000 } = request;

    logger.info('Executing ping test', { target, count, timeout });

    let resolvedIp: string | undefined;
    let targetLocation: import('@netbench/types').TargetLocation | undefined;
    try {
      resolvedIp = await this.resolveTarget(target);
      targetLocation = await this.resolveTargetLocation(resolvedIp);
    } catch (error) {
      throw new Error(`Cannot resolve target: ${target} - ${(error as Error).message}`);
    }

    const platform = process.platform;
    const command = this.buildCommand(target, count, timeout, interval, platform);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: (count * interval + timeout) * 2,
        maxBuffer: 1024 * 1024,
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      const result = this.parseOutput(stdout, platform);

      return {
        id: `ping_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        target,
        resolvedIp,
        targetLocation,
        timestamp: new Date().toISOString(),
        packetsSent: count,
        packetsReceived: result.received,
        packetLoss: ((count - result.received) / count) * 100,
        minRtt: result.min,
        maxRtt: result.max,
        avgRtt: result.avg,
        stddevRtt: result.stddev,
        rtts: result.rtts,
        nodeId,
        nodeLocation,
      };
    } catch (error) {
      logger.error('Ping execution failed', { target, error: (error as Error).message });
      throw error;
    }
  }

  private async resolveTarget(target: string): Promise<string> {
    try {
      const result = await dnsLookup(target);
      return result.address;
    } catch {
      throw new Error(`DNS resolution failed for ${target}`);
    }
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

  private buildCommand(target: string, count: number, timeout: number, interval: number, platform: string): string {
    const timeoutSec = Math.ceil(timeout / 1000);
    const intervalSec = interval / 1000;

    if (platform === 'win32') {
      return `ping -n ${count} -w ${timeout} ${target}`;
    }

    return `ping -c ${count} -W ${timeoutSec} -i ${intervalSec} ${target}`;
  }

  private parseOutput(output: string, platform: string): {
    received: number;
    min: number;
    max: number;
    avg: number;
    stddev: number;
    rtts: number[];
  } {
    const rtts: number[] = [];

    if (platform === 'win32') {
      return this.parseWindowsOutput(output, rtts);
    }
    return this.parseUnixOutput(output, rtts);
  }

  private parseWindowsOutput(output: string, rtts: number[]): {
    received: number;
    min: number;
    max: number;
    avg: number;
    stddev: number;
    rtts: number[];
  } {
    const timeRegex = /time[=<](\d+)ms/gi;
    let match;
    while ((match = timeRegex.exec(output)) !== null) {
      rtts.push(parseFloat(match[1]));
    }

    const statsMatch = output.match(/Packets:\s+Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+)/);
    const received = statsMatch ? parseInt(statsMatch[2]) : rtts.length;

    const minMaxMatch = output.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/);

    return {
      received,
      min: minMaxMatch ? parseFloat(minMaxMatch[1]) : (rtts.length > 0 ? Math.min(...rtts) : 0),
      max: minMaxMatch ? parseFloat(minMaxMatch[2]) : (rtts.length > 0 ? Math.max(...rtts) : 0),
      avg: minMaxMatch ? parseFloat(minMaxMatch[3]) : this.calculateAverage(rtts),
      stddev: this.calculateStdDev(rtts),
      rtts,
    };
  }

  private parseUnixOutput(output: string, rtts: number[]): {
    received: number;
    min: number;
    max: number;
    avg: number;
    stddev: number;
    rtts: number[];
  } {
    const timeRegex = /time=([\d.]+)\s*ms/g;
    let match;
    while ((match = timeRegex.exec(output)) !== null) {
      rtts.push(parseFloat(match[1]));
    }

    const statsMatch = output.match(/(\d+) packets transmitted,\s*(\d+) received/);
    const received = statsMatch ? parseInt(statsMatch[2]) : rtts.length;

    const rttMatch = output.match(/rtt min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/);

    return {
      received,
      min: rttMatch ? parseFloat(rttMatch[1]) : (rtts.length > 0 ? Math.min(...rtts) : 0),
      max: rttMatch ? parseFloat(rttMatch[3]) : (rtts.length > 0 ? Math.max(...rtts) : 0),
      avg: rttMatch ? parseFloat(rttMatch[2]) : this.calculateAverage(rtts),
      stddev: rttMatch ? parseFloat(rttMatch[4]) : this.calculateStdDev(rtts),
      rtts,
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const avg = this.calculateAverage(values);
    const squareDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
  }
}
