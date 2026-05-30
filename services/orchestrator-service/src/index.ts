import express from 'express';
import { createLogger } from '@netbench/logger';
import { RedisClient } from '@netbench/database';
import { TestOrchestrator, MultiPointTestRequest } from './orchestrator';

const logger = createLogger('orchestrator-service');
const app = express();
app.use(express.json());

const serviceUrls = {
  ping: process.env.PING_SERVICE_URL || 'http://localhost:3001',
  http: process.env.HTTP_SERVICE_URL || 'http://localhost:3002',
  speedtest: process.env.SPEEDTEST_SERVICE_URL || 'http://localhost:3003',
  node: process.env.NODE_SERVICE_URL || 'http://localhost:3004',
  data: process.env.DATA_SERVICE_URL || 'http://localhost:3006',
};

let redis: RedisClient;
let orchestrator: TestOrchestrator;

async function waitForDependencies() {
  const maxRetries = 30;

  redis = new RedisClient(process.env.REDIS_URL);

  for (let i = 1; i <= maxRetries; i++) {
    try {
      if (await redis.healthCheck()) {
        logger.info('Redis connected');
        break;
      }
    } catch {}
    logger.warn(`Waiting for Redis... (${i}/${maxRetries})`);
    await new Promise(r => setTimeout(r, 2000));
  }

  orchestrator = new TestOrchestrator(redis, serviceUrls);

  const wsClients: Map<string, { ws: unknown; batchIds: Set<string> }> = new Map();

  orchestrator.onResult((batchId, task) => {
    const message = JSON.stringify({
      type: 'test:result',
      data: {
        batchId,
        task: {
          taskId: task.taskId,
          nodeId: task.nodeId,
          nodeName: task.nodeName,
          nodeLocation: task.nodeLocation,
          sponsor: task.sponsor || undefined,
          type: task.type,
          target: task.target,
          status: task.status,
          result: task.result,
          completedAt: task.completedAt,
        },
      },
    });

    for (const [, client] of wsClients) {
      if (client.batchIds.has(batchId)) {
        const ws = client.ws as { send: (msg: string) => void; readyState: number };
        if (ws.readyState === 1) {
          ws.send(message);
        }
      }
    }
  });

  app.get('/health', (_req, res) => {
    res.json({
      service: 'orchestrator-service',
      status: 'healthy',
      uptime: process.uptime(),
      version: '1.0.0',
      activeBatches: orchestrator.getActiveBatches().length,
    });
  });

  app.post('/api/test/ping', async (req, res) => {
    try {
      const { target, count, timeout, interval, nodeIds, excludeNodeIds, maxNodes } = req.body;

      if (!target) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_TARGET', message: '目标主机不能为空' },
        });
        return;
      }

      const request: MultiPointTestRequest = {
        type: 'ping',
        target,
        config: { count: count || 4, timeout: timeout || 5000, interval: interval || 1000 },
        nodeIds,
        excludeNodeIds,
        maxNodes: maxNodes || 50,
      };

      const userId = req.headers['x-user-id'] as string;
      const batch = await orchestrator.createBatchTest(request, userId);

      res.status(202).json({
        success: true,
        data: {
          batchId: batch.id,
          type: batch.type,
          target: batch.target,
          totalNodes: batch.totalNodes,
          status: batch.status,
          createdAt: batch.createdAt,
        },
      });
    } catch (error) {
      logger.error('Ping batch test failed', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: { code: 'PING_BATCH_ERROR', message: (error as Error).message },
      });
    }
  });

  app.post('/api/test/http', async (req, res) => {
    try {
      const { url, method, headers, body: reqBody, expectedStatus, timeout, followRedirects, validateCert, nodeIds, excludeNodeIds, maxNodes } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_URL', message: 'URL不能为空' },
        });
        return;
      }

      const request: MultiPointTestRequest = {
        type: 'http',
        target: url,
        config: {
          method: method || 'GET',
          headers,
          body: reqBody,
          expectedStatus,
          timeout: timeout || 10000,
          followRedirects: followRedirects ?? true,
          validateCert: validateCert ?? true,
        },
        nodeIds,
        excludeNodeIds,
        maxNodes: maxNodes || 50,
      };

      const userId = req.headers['x-user-id'] as string;
      const batch = await orchestrator.createBatchTest(request, userId);

      res.status(202).json({
        success: true,
        data: {
          batchId: batch.id,
          type: batch.type,
          target: batch.target,
          totalNodes: batch.totalNodes,
          status: batch.status,
          createdAt: batch.createdAt,
        },
      });
    } catch (error) {
      logger.error('HTTP batch test failed', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: { code: 'HTTP_BATCH_ERROR', message: (error as Error).message },
      });
    }
  });

  app.post('/api/test/speedtest', async (req, res) => {
    try {
      const { duration, parallel, nodeIds, excludeNodeIds, maxNodes } = req.body;

      const request: MultiPointTestRequest = {
        type: 'speedtest',
        target: 'speedtest',
        config: { duration: duration || 10, parallel: parallel || 4 },
        nodeIds,
        excludeNodeIds,
        maxNodes: maxNodes || 20,
      };

      const userId = req.headers['x-user-id'] as string;
      const batch = await orchestrator.createBatchTest(request, userId);

      res.status(202).json({
        success: true,
        data: {
          batchId: batch.id,
          type: batch.type,
          target: batch.target,
          totalNodes: batch.totalNodes,
          status: batch.status,
          createdAt: batch.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'SPEEDTEST_BATCH_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/batch/:batchId', async (req, res) => {
    try {
      const batch = orchestrator.getBatch(req.params.batchId);
      if (!batch) {
        const cached = await redis.get(`batch:${req.params.batchId}`);
        if (!cached) {
          res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: '测试任务不存在' },
          });
          return;
        }
        res.json({ success: true, data: JSON.parse(cached) });
        return;
      }

      const tasks = Array.from(batch.tasks.values()).map(t => ({
        taskId: t.taskId,
        nodeId: t.nodeId,
        nodeName: t.nodeName,
        nodeLocation: t.nodeLocation,
        sponsor: t.sponsor || undefined,
        status: t.status,
        result: t.result,
        completedAt: t.completedAt,
      }));

      res.json({
        success: true,
        data: {
          id: batch.id,
          type: batch.type,
          target: batch.target,
          status: batch.status,
          totalNodes: batch.totalNodes,
          completedNodes: batch.completedNodes,
          failedNodes: batch.failedNodes,
          tasks,
          createdAt: batch.createdAt,
          completedAt: batch.completedAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'BATCH_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/batch/:batchId/results', (req, res) => {
    try {
      const results = orchestrator.getBatchResults(req.params.batchId);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'RESULTS_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/test/stats', async (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [totalTests, todayTests, avgLatency] = await Promise.all([
        redis.get('stats:total_tests'),
        redis.get(`stats:tests:${today}`),
        redis.get('stats:avg_latency'),
      ]);
      res.json({
        success: true,
        data: {
          totalTests: parseInt(totalTests || '0', 10),
          todayTests: parseInt(todayTests || '0', 10),
          avgLatency: parseInt(avgLatency || '0', 10),
          date: today,
        },
      });
    } catch (error) {
      logger.error('Failed to get test stats', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: (error as Error).message },
      });
    }
  });

  const PORT = process.env.PORT || 3008;

  app.listen(PORT, () => {
    logger.info(`Orchestrator service running on port ${PORT}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down');
    await redis.close();
    process.exit(0);
  });
}

waitForDependencies().catch((err) => {
  logger.error('Failed to start service', { error: (err as Error).message });
  process.exit(1);
});
