import { createLogger } from '@netbench/logger';
import { SpeedTestRequest, SpeedTestResult } from '@netbench/types';

const logger = createLogger('speedtest-engine');

const DEFAULT_DOWNLOAD_URLS = [
  'http://speedtest.tele2.net/10MB.zip',
  'http://proof.ovh.net/files/10Mb.dat',
  'http://speedtest.ftp.otenet.gr/files/test10Mb.db',
];

const DEFAULT_UPLOAD_URL = 'http://speedtest.tele2.net/upload.php';

export class SpeedtestEngine {
  async execute(request: SpeedTestRequest, nodeId: string, nodeLocation: string): Promise<SpeedTestResult> {
    const {
      downloadUrls = DEFAULT_DOWNLOAD_URLS,
      uploadUrl = DEFAULT_UPLOAD_URL,
      duration = 10,
      parallel = 4,
    } = request;

    logger.info('Executing speed test', { duration, parallel });

    const latencyResult = await this.testLatency();
    const downloadResult = await this.testDownload(downloadUrls, duration, parallel);
    const uploadResult = await this.testUpload(uploadUrl, duration, parallel);

    return {
      id: `speed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      downloadSpeed: downloadResult.speed,
      uploadSpeed: uploadResult.speed,
      latency: latencyResult.avg,
      jitter: latencyResult.jitter,
      packetLoss: latencyResult.packetLoss,
      serverId: 'default',
      serverLocation: 'auto',
      nodeId,
      nodeLocation,
      downloadBytes: downloadResult.bytes,
      uploadBytes: uploadResult.bytes,
    };
  }

  private async testLatency(): Promise<{ avg: number; jitter: number; packetLoss: number }> {
    const pings: number[] = [];
    const count = 20;
    let failed = 0;

    for (let i = 0; i < count; i++) {
      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        await fetch('http://speedtest.tele2.net/1MB.zip', {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = performance.now() - start;
        pings.push(elapsed);
      } catch {
        failed++;
      }

      if (i < count - 1) {
        await this.sleep(200);
      }
    }

    const avg = pings.length > 0 ? pings.reduce((a, b) => a + b, 0) / pings.length : 0;
    const jitter = pings.length > 1 ? this.calculateJitter(pings) : 0;
    const packetLoss = (failed / count) * 100;

    return { avg, jitter, packetLoss };
  }

  private async testDownload(urls: string[], durationSec: number, parallel: number): Promise<{ speed: number; bytes: number }> {
    const deadline = Date.now() + durationSec * 1000;
    let totalBytes = 0;
    const startTime = performance.now();

    const workers = Array.from({ length: parallel }, async () => {
      let workerBytes = 0;
      let urlIndex = 0;

      while (Date.now() < deadline) {
        const url = urls[urlIndex % urls.length];
        urlIndex++;

        try {
          const controller = new AbortController();
          const remainingTime = deadline - Date.now();
          if (remainingTime <= 0) break;
          const timeoutId = setTimeout(() => controller.abort(), Math.min(remainingTime, 30000));

          const response = await fetch(url, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.body) {
            const reader = response.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              workerBytes += value.length;
            }
          }
        } catch {
          await this.sleep(100);
        }
      }

      return workerBytes;
    });

    const results = await Promise.all(workers);
    totalBytes = results.reduce((sum, bytes) => sum + bytes, 0);

    const elapsedSec = (performance.now() - startTime) / 1000;
    const speed = elapsedSec > 0 ? (totalBytes * 8) / (elapsedSec * 1000000) : 0;

    return { speed, bytes: totalBytes };
  }

  private async testUpload(url: string, durationSec: number, parallel: number): Promise<{ speed: number; bytes: number }> {
    const deadline = Date.now() + durationSec * 1000;
    let totalBytes = 0;
    const startTime = performance.now();
    const chunkSize = 1024 * 256;
    const chunk = Buffer.alloc(chunkSize, 'x');

    const workers = Array.from({ length: parallel }, async () => {
      let workerBytes = 0;

      while (Date.now() < deadline) {
        try {
          const controller = new AbortController();
          const remainingTime = deadline - Date.now();
          if (remainingTime <= 0) break;
          const timeoutId = setTimeout(() => controller.abort(), Math.min(remainingTime, 30000));

          const response = await fetch(url, {
            method: 'POST',
            body: chunk,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            workerBytes += chunkSize;
          }
        } catch {
          await this.sleep(100);
        }
      }

      return workerBytes;
    });

    const results = await Promise.all(workers);
    totalBytes = results.reduce((sum, bytes) => sum + bytes, 0);

    const elapsedSec = (performance.now() - startTime) / 1000;
    const speed = elapsedSec > 0 ? (totalBytes * 8) / (elapsedSec * 1000000) : 0;

    return { speed, bytes: totalBytes };
  }

  private calculateJitter(values: number[]): number {
    if (values.length < 2) return 0;
    let sumDiff = 0;
    for (let i = 1; i < values.length; i++) {
      sumDiff += Math.abs(values[i] - values[i - 1]);
    }
    return sumDiff / (values.length - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
