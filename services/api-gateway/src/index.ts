import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '@netbench/logger';
import { authMiddleware, optionalAuth, requireRole } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { setupRoutes } from './routes';
import { WebSocketManager } from './websocket';

const logger = createLogger('api-gateway');

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
const wsManager = new WebSocketManager(wss);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const serviceUrls: Record<string, string> = {
  ping: process.env.PING_SERVICE_URL || 'http://localhost:3001',
  http: process.env.HTTP_SERVICE_URL || 'http://localhost:3002',
  speedtest: process.env.SPEEDTEST_SERVICE_URL || 'http://localhost:3003',
  node: process.env.NODE_SERVICE_URL || 'http://localhost:3004',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3005',
  data: process.env.DATA_SERVICE_URL || 'http://localhost:3006',
  monitor: process.env.MONITORING_SERVICE_URL || 'http://localhost:3007',
  orchestrator: process.env.ORCHESTRATOR_SERVICE_URL || 'http://localhost:3008',
};

function createForwardHandler(targetUrl: string, pathPrefix?: string) {
  return async (req: express.Request, res: express.Response) => {
    const rewrittenPath = pathPrefix
      ? req.originalUrl.replace(new RegExp(`^${pathPrefix}`), '/api')
      : req.originalUrl;
    const url = `${targetUrl}${rewrittenPath}`;

    logger.info('Forwarding request', {
      method: req.method,
      originalUrl: req.originalUrl,
      rewrittenPath,
      targetUrl: url,
      hasBody: !!req.body,
    });

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !['host', 'connection', 'content-length', 'content-type'].includes(key)) {
        headers[key] = value;
      }
    }

    if ((req as unknown as Record<string, unknown>).user) {
      const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown>;
      headers['x-user-id'] = user.userId as string;
      headers['x-user-role'] = user.role as string;
    }

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(30000),
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        headers['content-type'] = 'application/json';
      }

      logger.info('Sending fetch', { url, method: req.method });
      const response = await fetch(url, fetchOptions);
      logger.info('Fetch response received', { status: response.status, statusText: response.statusText });
      const data = await response.text();

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (!['transfer-encoding', 'connection'].includes(key)) {
          res.setHeader(key, value);
        }
      });

      res.send(data);
    } catch (err) {
      logger.error('Forward error', { method: req.method, path: req.path, error: (err as Error).message });
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { code: 'PROXY_ERROR', message: `Service unavailable: ${(err as Error).message}` },
        });
      }
    }
  };
}

app.use('/api/test', optionalAuth, createForwardHandler(serviceUrls.orchestrator));
app.use('/api/batch', optionalAuth, createForwardHandler(serviceUrls.orchestrator));
app.use('/api/ping', optionalAuth, createForwardHandler(serviceUrls.ping, '/api/ping'));
app.use('/api/http', optionalAuth, createForwardHandler(serviceUrls.http, '/api/http'));
app.use('/api/speedtest', optionalAuth, createForwardHandler(serviceUrls.speedtest, '/api/speedtest'));
app.use('/api/nodes', optionalAuth, createForwardHandler(serviceUrls.node, '/api/nodes'));
app.use('/api/tasks', optionalAuth, createForwardHandler(serviceUrls.node, '/api/tasks'));
app.use('/api/sponsor-showcase', optionalAuth, createForwardHandler(serviceUrls.node));

app.use('/api/nodes/nodes', optionalAuth, requireRole('admin'), createForwardHandler(serviceUrls.node, '/api/nodes'));
app.use('/api/users', optionalAuth, createForwardHandler(serviceUrls.user, '/api/users'));

app.use('/api/users/users', optionalAuth, requireRole('admin'), createForwardHandler(serviceUrls.user, '/api/users'));
app.use('/api/data', optionalAuth, createForwardHandler(serviceUrls.data, '/api/data'));
app.use('/api/monitor', authMiddleware, createForwardHandler(serviceUrls.monitor, '/api/monitor'));

setupRoutes(app, wsManager);

app.get('/health', (_req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
  });
});

app.use(errorHandler);

wss.on('connection', (ws: WebSocket) => {
  wsManager.handleConnection(ws);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`, { version: '2.0.0-fetch' });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    wsManager.close();
    process.exit(0);
  });
});

export { app, server, wsManager };
