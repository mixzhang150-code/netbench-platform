import { Router, Request, Response } from 'express';
import { WebSocketManager } from '../websocket';

export function setupRoutes(app: Router, wsManager: WebSocketManager): void {
  app.post('/api/tasks', async (req: Request, res: Response) => {
    try {
      const { type, config } = req.body;

      if (!type || !config) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Missing type or config' },
        });
        return;
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      wsManager.broadcast({
        type: 'task:created',
        data: { id: taskId, type, config, userId: req.user?.userId },
      });

      res.status(202).json({
        success: true,
        data: { taskId, type, status: 'pending' },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'TASK_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/services/health', async (_req: Request, res: Response) => {
    const services = [
      { name: 'ping', url: process.env.PING_SERVICE_URL || 'http://localhost:3001' },
      { name: 'http', url: process.env.HTTP_SERVICE_URL || 'http://localhost:3002' },
      { name: 'speedtest', url: process.env.SPEEDTEST_SERVICE_URL || 'http://localhost:3003' },
      { name: 'node', url: process.env.NODE_SERVICE_URL || 'http://localhost:3004' },
      { name: 'user', url: process.env.USER_SERVICE_URL || 'http://localhost:3005' },
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async (svc) => {
        try {
          const response = await fetch(`${svc.url}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          return { service: svc.name, status: response.ok ? 'healthy' : 'degraded' };
        } catch {
          return { service: svc.name, status: 'unhealthy' };
        }
      })
    );

    const results = healthChecks.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return { service: services[index].name, status: 'unhealthy' };
    });

    res.json({ success: true, data: results });
  });
}
