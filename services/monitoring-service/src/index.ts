import express from 'express';
import { createLogger } from '@netbench/logger';
import { PostgresClient, RedisClient } from '@netbench/database';
import { AlertManager } from './alert-manager';

const logger = createLogger('monitoring-service');
const app = express();
app.use(express.json());

let db: PostgresClient;
let redis: RedisClient;
let alertManager: AlertManager;

const SERVICES = [
  { name: 'ping-service', url: process.env.PING_SERVICE_URL || 'http://localhost:3001' },
  { name: 'http-service', url: process.env.HTTP_SERVICE_URL || 'http://localhost:3002' },
  { name: 'speedtest-service', url: process.env.SPEEDTEST_SERVICE_URL || 'http://localhost:3003' },
  { name: 'node-service', url: process.env.NODE_SERVICE_URL || 'http://localhost:3004' },
  { name: 'user-service', url: process.env.USER_SERVICE_URL || 'http://localhost:3005' },
  { name: 'data-service', url: process.env.DATA_SERVICE_URL || 'http://localhost:3006' },
];

async function waitForDependencies() {
  const maxRetries = 30;

  db = new PostgresClient({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  for (let i = 1; i <= maxRetries; i++) {
    try {
      if (await db.healthCheck()) {
        logger.info('PostgreSQL connected');
        break;
      }
    } catch {}
    logger.warn(`Waiting for PostgreSQL... (${i}/${maxRetries})`);
    await new Promise(r => setTimeout(r, 2000));
  }

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

  alertManager = new AlertManager(db, redis);

  app.get('/api/health', (_req, res) => {
    res.json({
      service: 'monitoring-service',
      status: 'healthy',
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  app.get('/api/services', async (_req, res) => {
    try {
      const health = await alertManager.checkServiceHealth(SERVICES);
      res.json({ success: true, data: health });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'HEALTH_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/alerts', (_req, res) => {
    const alerts = alertManager.getActiveAlerts();
    res.json({ success: true, data: alerts });
  });

  app.post('/api/alerts/:id/acknowledge', async (req, res) => {
    try {
      await alertManager.acknowledgeAlert(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'ACK_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/rules', (_req, res) => {
    const rules = alertManager.getRules();
    res.json({ success: true, data: rules });
  });

  app.post('/api/rules', async (req, res) => {
    try {
      const { name, condition, threshold, duration, severity, notifyChannels } = req.body;
      const rule = await alertManager.addRule({
        name,
        condition,
        threshold,
        duration: duration || 0,
        severity: severity || 'warning',
        enabled: true,
        notifyChannels: notifyChannels || ['log'],
      });
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'RULE_ERROR', message: (error as Error).message },
      });
    }
  });

  app.delete('/api/rules/:id', async (req, res) => {
    try {
      await alertManager.removeRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'RULE_ERROR', message: (error as Error).message },
      });
    }
  });

  await alertManager.start();

  const PORT = process.env.PORT || 3007;
  app.listen(PORT, () => {
    logger.info(`Monitoring service running on port ${PORT}`);
  });

  setInterval(async () => {
    try {
      const health = await alertManager.checkServiceHealth(SERVICES);
      await redis.set('stats:monitor:services', JSON.stringify(health), 60);
    } catch (error) {
      logger.error('Periodic health check failed', { error: (error as Error).message });
    }
  }, 60000);
}

waitForDependencies().catch((err) => {
  logger.error('Failed to start monitoring service', { error: (err as Error).message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  alertManager.stop();
  await redis.close();
  await db.close();
  process.exit(0);
});
