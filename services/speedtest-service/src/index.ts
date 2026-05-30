import express from 'express';
import { createLogger } from '@netbench/logger';
import { SpeedTestRequest, SpeedTestResult } from '@netbench/types';
import { RedisClient, InfluxClient } from '@netbench/database';
import { MessageBus, QUEUES } from '@netbench/messaging';
import { Point } from '@influxdata/influxdb-client';
import { SpeedtestEngine } from './engine';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('speedtest-service');
const app = express();
app.use(express.json());

const speedtestEngine = new SpeedtestEngine();
const redis = new RedisClient();
const influx = new InfluxClient();
const messageBus = new MessageBus();

const NODE_ID = process.env.NODE_ID || 'speedtest-local';
const NODE_LOCATION = process.env.NODE_LOCATION || 'local';

app.get('/health', (_req, res) => {
  res.json({
    service: 'speedtest-service',
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

app.post('/api/test', async (req, res) => {
  try {
    const request: SpeedTestRequest = {
      nodeId: req.body.nodeId,
      downloadUrls: req.body.downloadUrls,
      uploadUrl: req.body.uploadUrl,
      duration: req.body.duration || 10,
      parallel: req.body.parallel || 4,
    };

    if (request.duration < 1 || request.duration > 60) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_DURATION', message: 'Duration must be between 1 and 60 seconds' },
      });
      return;
    }

    if (request.parallel < 1 || request.parallel > 16) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARALLEL', message: 'Parallel must be between 1 and 16' },
      });
      return;
    }

    const taskId = uuidv4();

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'speedtest', request, status: 'running' }), 3600);

    const result: SpeedTestResult = await speedtestEngine.execute(request, NODE_ID, NODE_LOCATION);

    await redis.set(`result:${taskId}`, JSON.stringify(result), 86400);

    const point = new Point('speed_test')
      .tag('nodeId', NODE_ID)
      .tag('nodeLocation', NODE_LOCATION)
      .floatField('downloadSpeed', result.downloadSpeed)
      .floatField('uploadSpeed', result.uploadSpeed)
      .floatField('latency', result.latency)
      .floatField('jitter', result.jitter)
      .floatField('packetLoss', result.packetLoss)
      .intField('downloadBytes', result.downloadBytes)
      .intField('uploadBytes', result.uploadBytes);

    influx.writePoint(point);
    await influx.flush();

    await messageBus.publish(QUEUES.SPEEDTEST_RESULT, {
      taskId,
      type: 'speedtest',
      result,
    });

    await redis.set(`task:${taskId}`, JSON.stringify({ type: 'speedtest', request, status: 'completed', result }), 3600);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Speedtest failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'SPEEDTEST_ERROR', message: (error as Error).message },
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

  await messageBus.subscribe(QUEUES.SPEEDTEST_TASK, async (message) => {
    const { taskId, request } = message as { taskId: string; request: SpeedTestRequest };
    logger.info('Received speedtest task from queue', { taskId });

    try {
      const result = await speedtestEngine.execute(request, NODE_ID, NODE_LOCATION);

      await messageBus.publish(QUEUES.SPEEDTEST_RESULT, {
        taskId,
        type: 'speedtest',
        result,
      });

      const point = new Point('speed_test')
        .tag('nodeId', NODE_ID)
        .floatField('downloadSpeed', result.downloadSpeed)
        .floatField('uploadSpeed', result.uploadSpeed)
        .floatField('latency', result.latency);

      influx.writePoint(point);
      await influx.flush();
    } catch (error) {
      logger.error('Queue task failed', { taskId, error: (error as Error).message });
    }
  }, { prefetch: 2 });
}

const PORT = process.env.PORT || 3003;

async function main() {
  await startMessageConsumer();

  app.listen(PORT, () => {
    logger.info(`Speedtest service running on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error('Failed to start speedtest service', { error: error.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await messageBus.disconnect();
  await redis.close();
  await influx.close();
  process.exit(0);
});
