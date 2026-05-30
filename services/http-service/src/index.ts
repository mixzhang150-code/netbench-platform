import express from 'express';
import { createLogger } from '@netbench/logger';
import { HttpTestRequest, HttpTestResult } from '@netbench/types';
import { RedisClient, InfluxClient } from '@netbench/database';
import { MessageBus, QUEUES } from '@netbench/messaging';
import { Point } from '@influxdata/influxdb-client';
import { HttpEngine } from './engine';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('http-service');
const app = express();
app.use(express.json({ limit: '10mb' }));

const httpEngine = new HttpEngine();
const redis = new RedisClient();
const influx = new InfluxClient();
const messageBus = new MessageBus();

const NODE_ID = process.env.NODE_ID || 'http-local';
const NODE_LOCATION = process.env.NODE_LOCATION || 'local';

app.get('/health', (_req, res) => {
  res.json({
    service: 'http-service',
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

app.post('/api/test', async (req, res) => {
  try {
    const request: HttpTestRequest = {
      url: req.body.url,
      method: req.body.method || 'GET',
      headers: req.body.headers,
      body: req.body.body,
      expectedStatus: req.body.expectedStatus,
      timeout: req.body.timeout || 10000,
      followRedirects: req.body.followRedirects ?? true,
      validateCert: req.body.validateCert ?? true,
      nodeId: req.body.nodeId,
    };

    if (!request.url) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_URL', message: 'URL is required' },
      });
      return;
    }

    try {
      new URL(request.url);
    } catch {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_URL', message: 'Invalid URL format' },
      });
      return;
    }

    const taskId = uuidv4();

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'http', request, status: 'running' }), 3600);

    const result: HttpTestResult = await httpEngine.execute(request, NODE_ID, NODE_LOCATION);

    await redis.set(`result:${taskId}`, JSON.stringify(result), 86400);

    const point = new Point('http_test')
      .tag('url', request.url)
      .tag('method', request.method)
      .tag('nodeId', NODE_ID)
      .tag('nodeLocation', NODE_LOCATION)
      .tag('statusCode', String(result.statusCode))
      .tag('success', String(result.success))
      .floatField('responseTime', result.responseTime)
      .floatField('ttfb', result.ttfb)
      .floatField('dnsTime', result.dnsTime)
      .floatField('tcpTime', result.tcpTime)
      .floatField('tlsTime', result.tlsTime)
      .intField('downloadSize', result.downloadSize);

    influx.writePoint(point);
    await influx.flush();

    await messageBus.publish(QUEUES.HTTP_RESULT, {
      taskId,
      type: 'http',
      result,
    });

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'http', request, status: 'completed', result }), 3600);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('HTTP test failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'HTTP_ERROR', message: (error as Error).message },
    });
  }
});

app.get('/api/result/:taskId', async (req, res) => {
  try {
    const result = await redis.get(`result:${req.params.taskId}`);
    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Result not found' },
      });
      return;
    }
    res.json({ success: true, data: JSON.parse(result) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'RESULT_ERROR', message: (error as Error).message },
    });
  }
});

async function startMessageConsumer(): Promise<void> {
  await messageBus.connect();

  await messageBus.subscribe(QUEUES.HTTP_TASK, async (message) => {
    const { taskId, request } = message as { taskId: string; request: HttpTestRequest };
    logger.info('Received HTTP task from queue', { taskId });

    try {
      const result = await httpEngine.execute(request, NODE_ID, NODE_LOCATION);

      await messageBus.publish(QUEUES.HTTP_RESULT, {
        taskId,
        type: 'http',
        result,
      });

      const point = new Point('http_test')
        .tag('url', request.url)
        .tag('method', request.method)
        .tag('nodeId', NODE_ID)
        .tag('statusCode', String(result.statusCode))
        .floatField('responseTime', result.responseTime)
        .floatField('ttfb', result.ttfb);

      influx.writePoint(point);
      await influx.flush();
    } catch (error) {
      logger.error('Queue task failed', { taskId, error: (error as Error).message });
    }
  }, { prefetch: 5 });
}

const PORT = process.env.PORT || 3002;

async function main() {
  await startMessageConsumer();

  app.listen(PORT, () => {
    logger.info(`HTTP service running on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error('Failed to start HTTP service', { error: error.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await messageBus.disconnect();
  await redis.close();
  await influx.close();
  process.exit(0);
});
