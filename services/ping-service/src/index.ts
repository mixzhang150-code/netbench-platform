import express from 'express';
import { createLogger } from '@netbench/logger';
import { PingTestRequest, PingTestResult } from '@netbench/types';
import { RedisClient, InfluxClient } from '@netbench/database';
import { MessageBus, QUEUES } from '@netbench/messaging';
import { Point } from '@influxdata/influxdb-client';
import { PingEngine } from './engine';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('ping-service');
const app = express();
app.use(express.json());

const pingEngine = new PingEngine();
const redis = new RedisClient();
const influx = new InfluxClient();
const messageBus = new MessageBus();

const NODE_ID = process.env.NODE_ID || 'ping-local';
const NODE_LOCATION = process.env.NODE_LOCATION || 'local';

app.get('/health', (_req, res) => {
  res.json({
    service: 'ping-service',
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

app.post('/api/test', async (req, res) => {
  try {
    const request: PingTestRequest = {
      target: req.body.target,
      count: req.body.count || 4,
      timeout: req.body.timeout || 5000,
      interval: req.body.interval || 1000,
      nodeId: req.body.nodeId,
    };

    if (!request.target) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TARGET', message: 'Target host is required' },
      });
      return;
    }

    if (request.count < 1 || request.count > 100) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_COUNT', message: 'Count must be between 1 and 100' },
      });
      return;
    }

    const taskId = uuidv4();

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'ping', request, status: 'running' }), 3600);

    const result: PingTestResult = await pingEngine.execute(request, NODE_ID, NODE_LOCATION);

    await redis.set(`result:${taskId}`, JSON.stringify(result), 86400);

    const point = new Point('ping_test')
      .tag('target', request.target)
      .tag('nodeId', NODE_ID)
      .tag('nodeLocation', NODE_LOCATION)
      .intField('packetsSent', result.packetsSent)
      .intField('packetsReceived', result.packetsReceived)
      .floatField('packetLoss', result.packetLoss)
      .floatField('minRtt', result.minRtt)
      .floatField('maxRtt', result.maxRtt)
      .floatField('avgRtt', result.avgRtt)
      .floatField('stddevRtt', result.stddevRtt);

    influx.writePoint(point);
    await influx.flush();

    await messageBus.publish(QUEUES.PING_RESULT, {
      taskId,
      type: 'ping',
      result,
    });

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'ping', request, status: 'completed', result }), 3600);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Ping test failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'PING_ERROR', message: (error as Error).message },
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

  await messageBus.subscribe(QUEUES.PING_TASK, async (message) => {
    const { taskId, request } = message as { taskId: string; request: PingTestRequest };
    logger.info('Received ping task from queue', { taskId });

    try {
      const result = await pingEngine.execute(request, NODE_ID, NODE_LOCATION);

      await messageBus.publish(QUEUES.PING_RESULT, {
        taskId,
        type: 'ping',
        result,
      });

      const point = new Point('ping_test')
        .tag('target', request.target)
        .tag('nodeId', NODE_ID)
        .tag('nodeLocation', NODE_LOCATION)
        .intField('packetsSent', result.packetsSent)
        .intField('packetsReceived', result.packetsReceived)
        .floatField('packetLoss', result.packetLoss)
        .floatField('minRtt', result.minRtt)
        .floatField('maxRtt', result.maxRtt)
        .floatField('avgRtt', result.avgRtt);

      influx.writePoint(point);
      await influx.flush();
    } catch (error) {
      logger.error('Queue task failed', { taskId, error: (error as Error).message });
    }
  }, { prefetch: 5 });
}

const PORT = process.env.PORT || 3001;

async function main() {
  await startMessageConsumer();

  app.listen(PORT, () => {
    logger.info(`Ping service running on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error('Failed to start ping service', { error: error.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await messageBus.disconnect();
  await redis.close();
  await influx.close();
  process.exit(0);
});
