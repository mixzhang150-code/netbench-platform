import express from 'express';
import { createLogger } from '@netbench/logger';
import { PostgresClient, RedisClient, InfluxClient } from '@netbench/database';
import { MessageBus, QUEUES } from '@netbench/messaging';
import { PingTestResult, HttpTestResult, SpeedTestResult } from '@netbench/types';
import { DataProcessor } from './processor';

const logger = createLogger('data-service');
const app = express();
app.use(express.json());

const db = new PostgresClient();
const redis = new RedisClient();
const influx = new InfluxClient();
const messageBus = new MessageBus();
const processor = new DataProcessor(db, redis, influx);

app.get('/health', (_req, res) => {
  res.json({
    service: 'data-service',
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

app.get('/api/history', async (req, res) => {
  try {
    const type = req.query.type as string;
    const nodeId = req.query.nodeId as string;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await processor.getTestHistory(type, nodeId, startTime, endTime, page, limit);
    res.json({
      success: true,
      data: result.results,
      meta: { page, limit, total: result.total },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'HISTORY_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const { id, taskId, type, target, status, resultData, nodeId, nodeLocation, createdAt } = req.body;

    if (!id || !type || !target) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Missing required fields' },
      });
      return;
    }

    await processor.saveTestResult({
      id,
      taskId: taskId || '',
      type,
      target,
      status: status || 'success',
      resultData: resultData || {},
      nodeId: nodeId || '',
      nodeLocation: nodeLocation || '',
      createdAt: createdAt || new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    logger.error('Failed to save test result', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_ERROR', message: (error as Error).message },
    });
  }
});

app.get('/api/trend', async (req, res) => {
  try {
    const type = req.query.type as string;
    const target = req.query.target as string;
    const period = (req.query.period as string) || 'day';
    const points = parseInt(req.query.points as string) || 24;

    const trend = await processor.getTrendAnalysis(type, target, period as 'hour' | 'day' | 'week' | 'month', points);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'TREND_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/report', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { title, description, taskIds } = req.body;

    if (!title || !taskIds || !Array.isArray(taskIds)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Title and taskIds are required' },
      });
      return;
    }

    const report = await processor.generateReport(userId, title, description, taskIds);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'REPORT_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/archive', async (req, res) => {
  try {
    const { daysToKeep } = req.body;
    const deletedCount = await processor.archiveOldData(daysToKeep || 90);
    res.json({ success: true, data: { deletedCount } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ARCHIVE_ERROR', message: (error as Error).message },
    });
  }
});

async function startMessageConsumer(): Promise<void> {
  await messageBus.connect();

  await messageBus.subscribe(QUEUES.PING_RESULT, async (message) => {
    const { taskId, result } = message as { taskId: string; result: PingTestResult };
    try {
      await processor.processPingResult(taskId, result);
    } catch (error) {
      logger.error('Failed to process ping result', { taskId, error: (error as Error).message });
    }
  });

  await messageBus.subscribe(QUEUES.HTTP_RESULT, async (message) => {
    const { taskId, result } = message as { taskId: string; result: HttpTestResult };
    try {
      await processor.processHttpResult(taskId, result);
    } catch (error) {
      logger.error('Failed to process HTTP result', { taskId, error: (error as Error).message });
    }
  });

  await messageBus.subscribe(QUEUES.SPEEDTEST_RESULT, async (message) => {
    const { taskId, result } = message as { taskId: string; result: SpeedTestResult };
    try {
      await processor.processSpeedtestResult(taskId, result);
    } catch (error) {
      logger.error('Failed to process speedtest result', { taskId, error: (error as Error).message });
    }
  });
}

const PORT = process.env.PORT || 3006;

async function main() {
  await startMessageConsumer();

  app.listen(PORT, () => {
    logger.info(`Data service running on port ${PORT}`);
  });

  setInterval(async () => {
    try {
      await processor.archiveOldData(90);
    } catch (error) {
      logger.error('Scheduled archive failed', { error: (error as Error).message });
    }
  }, 24 * 60 * 60 * 1000);
}

main().catch((error) => {
  logger.error('Failed to start data service', { error: error.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await messageBus.disconnect();
  await redis.close();
  await influx.close();
  await db.close();
  process.exit(0);
});
