import express from 'express';
import { createLogger } from '@netbench/logger';
import { NodeInfo, NodeCapabilities } from '@netbench/types';
import { PostgresClient, RedisClient } from '@netbench/database';
import { MessageBus, QUEUES } from '@netbench/messaging';
import { NodeRepository } from './repository';
import { LoadBalancer } from './load-balancer';
import { ReputationSystem } from './reputation';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const logger = createLogger('node-service');
const app = express();
app.use(express.json());

const db = new PostgresClient();
const redis = new RedisClient();
const messageBus = new MessageBus();

const nodeRepository = new NodeRepository(db, redis);
const loadBalancer = new LoadBalancer(nodeRepository);
const reputationSystem = new ReputationSystem(nodeRepository);

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_key';

interface AuthPayload {
  userId: string;
  username: string;
  role: 'admin' | 'sponsor' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '需要管理员权限' } });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.role !== 'admin') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '仅限管理员访问' } });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: '无效的认证令牌' } });
  }
}

app.get('/health', async (_req, res) => {
  const dbHealthy = await db.healthCheck().catch(() => false);
  const redisHealthy = await redis.healthCheck().catch(() => false);
  const overall = dbHealthy && redisHealthy ? 'healthy' : 'degraded';

  res.json({
    service: 'node-service',
    status: overall,
    uptime: process.uptime(),
    version: '1.0.0',
    dependencies: {
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
    },
  });
});

app.get('/api/public/stats', async (_req, res) => {
  try {
    const result = await nodeRepository.list(1, 1000);
    const allNodes = result.nodes;
    const onlineNodes = allNodes.filter(n => n.status === 'online').length;
    const offlineNodes = allNodes.filter(n => n.status !== 'online').length;

    res.json({
      success: true,
      data: {
        totalNodes: result.total,
        onlineNodes,
        offlineNodes,
        regions: [
          { name: '华东地区', nodes: Math.floor(onlineNodes * 0.3) },
          { name: '华南地区', nodes: Math.floor(onlineNodes * 0.25) },
          { name: '华北地区', nodes: Math.floor(onlineNodes * 0.2) },
          { name: '其他地区', nodes: Math.floor(onlineNodes * 0.25) },
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: (error as Error).message } });
  }
});

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'netbench_internal_token_2024';

function requireInternalService(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers['x-internal-token'];
  if (authHeader !== INTERNAL_SERVICE_TOKEN) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal service access only' } });
    return;
  }
  next();
}

app.get('/api/internal/nodes', requireInternalService, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    const status = req.query.status as string;

    const result = await nodeRepository.list(1, limit, status);

    const nodes = result.nodes.map(node => ({
      id: node.id,
      name: node.name,
      status: node.status,
      capabilities: node.capabilities,
      location: {
        city: node.location?.city || 'Unknown',
        region: node.location?.region || '',
        country: node.location?.country || 'CN',
        lat: node.location?.lat || 0,
        lon: node.location?.lon || 0,
      },
      sponsor: (node as unknown as Record<string, unknown>).sponsor as string | undefined,
    }));

    res.json({
      success: true,
      data: nodes,
      meta: { total: result.total }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: (error as Error).message } });
  }
});

app.post('/api/check-name', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: '名称不能为空' } });
      return;
    }
    const existing = await nodeRepository.findByName(name.trim());
    res.json({ success: true, available: !existing });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'CHECK_ERROR', message: (error as Error).message } });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, platform, platformDetails, ip, location, capabilities, version } = req.body;

    if (!name || !platform || !ip) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Name, platform, and IP are required' },
      });
      return;
    }

    const existing = await nodeRepository.findByName(name);
    if (existing) {
      await nodeRepository.updateStatus(existing.id, 'online');
      await nodeRepository.updateHeartbeat(existing.id);
      logger.info('Node re-registered (existing)', { nodeId: existing.id, name });
      res.status(200).json({
        success: true,
        data: {
          id: existing.id,
          token: existing.token,
          status: 'online',
          reRegistered: true,
        },
      });
      return;
    }

    const rawOwnerId = req.headers['x-user-id'] as string;
    const ownerId = rawOwnerId || null;

    const token = jwt.sign(
      { nodeId: '', type: 'node' },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const node = await nodeRepository.create({
      name,
      ownerId,
      status: 'online',
      version: version || '1.0.0',
      platform,
      platformDetails: platformDetails || '',
      ip,
      location: location || { country: 'Unknown', region: 'Unknown', city: 'Unknown', lat: 0, lon: 0, isp: 'Unknown' },
      capabilities: capabilities || { ping: true, http: true, speedtest: true, maxConcurrentTasks: 5, bandwidthLimit: 0 },
      token,
    });

    try {
      await messageBus.publish(QUEUES.NODE_EVENTS, {
        type: 'node.registered',
        nodeId: node.id,
        timestamp: new Date().toISOString(),
      });
    } catch (pubError) {
      logger.warn('Failed to publish node.registered event', { error: (pubError as Error).message });
    }

    logger.info('Node registered', { nodeId: node.id, name });

    res.status(201).json({
      success: true,
      data: {
        id: node.id,
        token: node.token,
        status: node.status,
      },
    });
  } catch (error) {
    logger.error('Node registration failed', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/heartbeat', async (req, res) => {
  try {
    const nodeToken = req.headers['x-node-token'] as string;
    if (!nodeToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Node token required' },
      });
      return;
    }

    const node = await nodeRepository.findByToken(nodeToken);
    if (!node) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid node token' },
      });
      return;
    }

    const { stats, capabilities } = req.body;

    await nodeRepository.updateHeartbeat(node.id);

    if (node.status !== 'online') {
      await nodeRepository.updateStatus(node.id, 'online');
    }

    if (stats) {
      await nodeRepository.updateStats(node.id, stats);
    }

    try {
      await reputationSystem.recordHeartbeat(node.id, true);
    } catch (repError) {
      logger.warn('Failed to record heartbeat reputation', { nodeId: node.id, error: (repError as Error).message });
    }

    res.json({
      success: true,
      data: {
        nodeId: node.id,
        status: 'online',
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'HEARTBEAT_ERROR', message: (error as Error).message },
    });
  }
});

app.get('/api/nodes', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const result = await nodeRepository.list(page, limit, status);
    res.json({
      success: true,
      data: result.nodes,
      meta: { page, limit, total: result.total },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'LIST_ERROR', message: (error as Error).message },
    });
  }
});

app.get('/api/nodes/:id', requireAdmin, async (req, res) => {
  try {
    const node = await nodeRepository.findById(req.params.id);
    if (!node) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Node not found' },
      });
      return;
    }
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: (error as Error).message },
    });
  }
});

app.put('/api/nodes/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'offline', 'maintenance'].includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid status value' },
      });
      return;
    }

    await nodeRepository.updateStatus(req.params.id, status);
    res.json({ success: true, data: { id: req.params.id, status } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: (error as Error).message },
    });
  }
});

app.put('/api/nodes/:id', requireAdmin, async (req, res) => {
  try {
    const { name, platform, location } = req.body;
    const id = req.params.id;

    const existing = await nodeRepository.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Node not found' },
      });
      return;
    }

    if (name && name !== existing.name) {
      const nameConflict = await nodeRepository.findByName(name);
      if (nameConflict && nameConflict.id !== id) {
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: `节点名称 "${name}" 已被其他节点使用` },
        });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.name = name;
      values.push(name);
      paramIndex++;
    }
    if (platform !== undefined) {
      updates.platform = platform;
      values.push(platform);
      paramIndex++;
    }
    if (location !== undefined && typeof location === 'object') {
      if (location.city !== undefined) {
        updates.city = location.city;
        values.push(location.city);
        paramIndex++;
      }
      if (location.country !== undefined) {
        updates.country = location.country;
        values.push(location.country);
        paramIndex++;
      }
      if (location.region !== undefined) {
        updates.region = location.region;
        values.push(location.region);
        paramIndex++;
      }
      if (location.isp !== undefined) {
        updates.isp = location.isp;
        values.push(location.isp);
        paramIndex++;
      }
      if (location.lat !== undefined) {
        updates.lat = location.lat;
        values.push(location.lat);
        paramIndex++;
      }
      if (location.lon !== undefined) {
        updates.lon = location.lon;
        values.push(location.lon);
        paramIndex++;
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
      await db.query(`UPDATE nodes SET ${setClauses} WHERE id = $${values.length + 1}`, [...values, id]);
    }

    const updated = await nodeRepository.findById(id);
    logger.info('Node updated', { nodeId: id, name: updated?.name });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/select', async (req, res) => {
  try {
    const { capability, preferredLocation, excludeNodeIds, count } = req.body;

    if (!capability) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Capability is required' },
      });
      return;
    }

    if (count && count > 1) {
      const nodes = await loadBalancer.selectMultipleNodes(
        capability,
        preferredLocation,
        excludeNodeIds || [],
      );
      res.json({ success: true, data: nodes });
    } else {
      const node = await loadBalancer.selectNode(
        capability,
        preferredLocation,
        excludeNodeIds || [],
      );
      res.json({ success: true, data: node });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'SELECT_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/:id/evaluate', async (req, res) => {
  try {
    const reputation = await reputationSystem.evaluateNode(req.params.id);
    res.json({ success: true, data: reputation });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'EVALUATION_ERROR', message: (error as Error).message },
    });
  }
});

app.post('/api/:id/task-result', async (req, res) => {
  try {
    const body = req.body as { success?: boolean; responseTime?: number; taskId?: string; type?: string; target?: string; status?: string; result?: unknown };
    const isSuccess = body.success ?? (body.status === 'completed');
    await reputationSystem.recordTaskResult(req.params.id, isSuccess, body.responseTime ?? 0);
    if (body.taskId) {
      await redis.set('task-result:' + body.taskId, JSON.stringify({
        nodeId: req.params.id,
        type: body.type,
        target: body.target,
        status: body.status,
        result: body.result,
        completedAt: new Date().toISOString(),
      }), 7200);
    }
    logger.info('Task result received', { nodeId: req.params.id, taskId: body.taskId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'RECORD_ERROR', message: (error as Error).message } });
  }
});

app.post('/api/nodes/push-task', async (req, res) => {
  try {
    const body = req.body as { nodeId?: string; taskId?: string; type?: string; target?: string; config?: Record<string, unknown> };
    if (!body.nodeId || !body.taskId) {
      res.status(400).json({ success: false, error: { code: 'INVALID', message: 'Missing fields' } });
      return;
    }
    const node = await nodeRepository.findById(body.nodeId);
    if (!node) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
      return;
    }
    const taskData = JSON.stringify({
      taskId: body.taskId,
      type: body.type,
      target: body.target,
      config: body.config || {},
      pushedAt: new Date().toISOString(),
    });
    await redis.lpush('tasks:' + body.nodeId, taskData);
    await redis.expire('tasks:' + body.nodeId, 3600);
    logger.info('Task pushed to node', { nodeId: body.nodeId, taskId: body.taskId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'PUSH_ERROR', message: (error as Error).message } });
  }
});

app.get('/api/tasks/:taskId/result', async (req, res) => {
  try {
    const raw = await redis.get('task-result:' + req.params.taskId);
    if (!raw) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }
    res.json({ success: true, data: JSON.parse(raw) });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'RESULT_ERROR', message: (error as Error).message } });
  }
});

app.get('/api/:id/tasks', async (req, res) => {
  try {
    const node = await nodeRepository.findById(req.params.id);
    if (!node) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } }); return; }
    const tasks = [];
    while (true) {
      const raw = await redis.rpop(`tasks:${req.params.id}`);
      if (!raw) break;
      try { tasks.push(JSON.parse(raw)); } catch { continue; }
    }
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'TASK_ERROR', message: (error as Error).message } });
  }
});

app.delete('/api/nodes/:id', requireAdmin, async (req, res) => {
  try {
    await nodeRepository.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: (error as Error).message },
    });
  }
});

app.get('/api/nodes/:id/sponsor', requireAdmin, async (req, res) => {
  try {
    const node = await nodeRepository.findById(req.params.id);
    if (!node) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
      return;
    }
    res.json({ success: true, data: { nodeId: req.params.id, sponsor: node.sponsor || '' } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: (error as Error).message } });
  }
});

app.put('/api/nodes/:id/sponsor', requireAdmin, async (req, res) => {
  try {
    const { sponsor } = req.body;
    if (sponsor !== undefined && typeof sponsor !== 'string') {
      res.status(400).json({ success: false, error: { code: 'INVALID_SPONSOR', message: 'Sponsor must be a string' } });
      return;
    }
    const existing = await nodeRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
      return;
    }
    await nodeRepository.updateSponsor(req.params.id, sponsor || '');
    logger.info('Node sponsor updated', { nodeId: req.params.id, sponsor: sponsor || '(cleared)' });
    const updated = await nodeRepository.findById(req.params.id);
    res.json({ success: true, data: { id: req.params.id, sponsor: updated?.sponsor || '' } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: (error as Error).message } });
  }
});

app.get('/api/admin/nodes', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let result;
    if (search) {
      result = await nodeRepository.searchNodes(search, page, limit, status);
    } else {
      result = await nodeRepository.list(page, limit, status);
    }

    const nodesWithSponsors = result.nodes.map(node => ({
      ...node,
      sponsor: node.sponsor || ''
    }));

    res.json({
      success: true,
      data: nodesWithSponsors,
      meta: { page, limit, total: result.total }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'LIST_ERROR', message: (error as Error).message }
    });
  }
});

app.post('/api/admin/nodes/batch-sponsor', requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'updates must be a non-empty array' }
      });
      return;
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      const { nodeId, sponsor } = update;
      if (!nodeId || typeof sponsor !== 'string') {
        errors.push({ nodeId, error: 'Invalid nodeId or sponsor format' });
        continue;
      }

      try {
        const existing = await nodeRepository.findById(nodeId);
        if (!existing) {
          errors.push({ nodeId, error: 'Node not found' });
          continue;
        }

        await nodeRepository.updateSponsor(nodeId, sponsor || '');
        results.push({ nodeId, sponsor: sponsor || '', success: true });
      } catch (err) {
        errors.push({ nodeId, error: (err as Error).message });
      }
    }

    logger.info('Batch sponsor update completed', {
      total: updates.length,
      successful: results.length,
      failed: errors.length
    });

    res.json({
      success: true,
      data: {
        processed: updates.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'BATCH_UPDATE_ERROR', message: (error as Error).message }
    });
  }
});

app.get('/api/admin/nodes/export', requireAdmin, async (_req, res) => {
  try {
    const result = await nodeRepository.list(1, 10000);

    const exportData = result.nodes.map(node => ({
      ID: node.id,
      Name: node.name,
      Status: node.status,
      IP: node.ip,
      Location: `${node.location?.city || 'Unknown'}, ${node.location?.region || 'Unknown'}, ${node.location?.country || 'Unknown'}`,
      Sponsor: node.sponsor || '',
      Platform: node.platform,
      Version: node.version,
      RegisteredAt: node.registeredAt,
      LastHeartbeat: node.lastHeartbeat
    }));

    res.json({
      success: true,
      data: exportData,
      meta: { total: result.total, exportedAt: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: (error as Error).message }
    });
  }
});

// ==================== 赞助商展示管理 API ====================

const VALID_PAGES = ['ping', 'http', 'dashboard', 'sponsor'];
const VALID_POSITIONS = ['top', 'sidebar', 'footer'];
const VALID_STYLES = ['grid', 'carousel', 'list'];

app.get('/api/sponsor-showcase/config/:page', async (req, res) => {
  try {
    const page = req.params.page;
    if (!VALID_PAGES.includes(page)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: `无效的页面: ${page}` } });
      return;
    }

    const configResult = await db.query(
      'SELECT * FROM sponsor_showcase_configs WHERE page = $1',
      [page]
    );

    if (configResult.rows.length === 0) {
      const newConfig = await db.query(
        `INSERT INTO sponsor_showcase_configs (page, enabled, title, style, max_items)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [page, false, '', 'grid', 6]
      );
      const sponsorsResult = await db.query('SELECT * FROM sponsor_showcase_sponsors ORDER BY sort_order ASC');
      res.json({ success: true, data: { ...newConfig.rows[0], sponsors: sponsorsResult.rows } });
      return;
    }

    const config = configResult.rows[0];
    const sponsorsResult = await db.query('SELECT * FROM sponsor_showcase_sponsors ORDER BY sort_order ASC');

    res.json({
      success: true,
      data: {
        id: config.id,
        page: config.page,
        enabled: config.enabled,
        title: config.title,
        style: config.style,
        maxItems: config.max_items,
        sponsors: sponsorsResult.rows.map(s => ({
          id: s.id,
          name: s.name,
          logo: s.logo,
          url: s.url,
          description: s.description,
          position: s.position,
          enabled: s.enabled,
          order: s.sort_order,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_CONFIG_ERROR', message: (error as Error).message } });
  }
});

app.get('/api/sponsor-showcase/configs', requireAdmin, async (_req, res) => {
  try {
    const configsResult = await db.query('SELECT * FROM sponsor_showcase_configs ORDER BY page ASC');
    const sponsorsResult = await db.query('SELECT * FROM sponsor_showcase_sponsors ORDER BY position, sort_order ASC');

    const sponsorsByPage: Record<string, any[]> = {};
    for (const sponsor of sponsorsResult.rows) {
      const configForSponsor = configsResult.rows.find(c => c.page === (sponsor.position === 'sidebar' ? 'dashboard' : sponsor.position));
      const pageKey: string = (configForSponsor?.page || 'ping') as string;
      if (!sponsorsByPage[pageKey]) sponsorsByPage[pageKey] = [];
      sponsorsByPage[pageKey].push({
        id: sponsor.id,
        name: sponsor.name,
        logo: sponsor.logo,
        url: sponsor.url,
        description: sponsor.description,
        position: sponsor.position,
        enabled: sponsor.enabled,
        order: sponsor.sort_order,
        createdAt: sponsor.created_at,
        updatedAt: sponsor.updated_at
      });
    }

    const data = configsResult.rows.map(config => ({
      id: config.id,
      page: config.page,
      enabled: config.enabled,
      title: config.title,
      style: config.style,
      maxItems: config.max_items,
      sponsors: (sponsorsByPage[config.page as string] || []) as any[]
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_CONFIGS_ERROR', message: (error as Error).message } });
  }
});

app.put('/api/sponsor-showcase/config/:page', requireAdmin, async (req, res) => {
  try {
    const page = req.params.page;
    if (!VALID_PAGES.includes(page)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAGE', message: `无效的页面: ${page}` } });
      return;
    }

    const { enabled, title, style, maxItems } = req.body;

    const existing = await db.query('SELECT id FROM sponsor_showcase_configs WHERE page = $1', [page]);
    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE sponsor_showcase_configs SET
           enabled = COALESCE($2, enabled),
           title = COALESCE($3, title),
           style = COALESCE($4, style),
           max_items = COALESCE($5, max_items),
           updated_at = NOW()
         WHERE page = $1 RETURNING *`,
        [page, enabled, title, style && VALID_STYLES.includes(style) ? style : undefined, maxItems]
      );
    } else {
      result = await db.query(
        `INSERT INTO sponsor_showcase_configs (page, enabled, title, style, max_items)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [page, enabled ?? false, title || '', style && VALID_STYLES.includes(style) ? style : 'grid', maxItems || 6]
      );
    }

    logger.info('Sponsor showcase config updated', { page, enabled, title });

    const sponsorsResult = await db.query('SELECT * FROM sponsor_showcase_sponsors ORDER BY sort_order ASC');
    res.json({
      success: true,
      data: { ...result.rows[0], sponsors: sponsorsResult.rows }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_CONFIG_ERROR', message: (error as Error).message } });
  }
});

app.get('/api/sponsor-showcase/sponsors', requireAdmin, async (req, res) => {
  try {
    const position = req.query.position as string;
    let query = 'SELECT * FROM sponsor_showcase_sponsors';
    const params: any[] = [];

    if (position && VALID_POSITIONS.includes(position)) {
      query += ' WHERE position = $1';
      params.push(position);
    }

    query += ' ORDER BY sort_order ASC';

    const result = await db.query(query, params);
    res.json({
      success: true,
      data: result.rows.map(s => ({
        id: s.id,
        name: s.name,
        logo: s.logo,
        url: s.url,
        description: s.description,
        position: s.position,
        enabled: s.enabled,
        order: s.sort_order,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'LIST_SPONSORS_ERROR', message: (error as Error).message } });
  }
});

app.post('/api/sponsor-showcase/sponsors', requireAdmin, async (req, res) => {
  try {
    const { name, logo, url, description, position, enabled, order } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: '名称不能为空' } });
      return;
    }

    const sponsorPosition = position && VALID_POSITIONS.includes(position) ? position : 'top';
    const sponsorOrder = typeof order === 'number' ? order : 0;

    const result = await db.query(
      `INSERT INTO sponsor_showcase_sponsors (name, logo, url, description, position, enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), logo || '', url || '', description || '', sponsorPosition, enabled !== false, sponsorOrder]
    );

    logger.info('Sponsor created', { sponsorId: result.rows[0].id, name: name.trim() });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'CREATE_SPONSOR_ERROR', message: (error as Error).message } });
  }
});

app.put('/api/sponsor-showcase/sponsors/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, logo, url, description, position, enabled, order } = req.body;

    const existing = await db.query('SELECT id FROM sponsor_showcase_sponsors WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '赞助商不存在' } });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
    if (logo !== undefined) { updates.push(`logo = $${paramIndex++}`); params.push(logo); }
    if (url !== undefined) { updates.push(`url = $${paramIndex++}`); params.push(url); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); params.push(description); }
    if (position !== undefined && VALID_POSITIONS.includes(position)) { updates.push(`position = $${paramIndex++}`); params.push(position); }
    if (enabled !== undefined) { updates.push(`enabled = $${paramIndex++}`); params.push(enabled); }
    if (order !== undefined) { updates.push(`sort_order = $${paramIndex++}`); params.push(order); }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(id);
      await db.query(`UPDATE sponsor_showcase_sponsors SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updated = await db.query('SELECT * FROM sponsor_showcase_sponsors WHERE id = $1', [id]);
    logger.info('Sponsor updated', { sponsorId: id });

    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_SPONSOR_ERROR', message: (error as Error).message } });
  }
});

app.delete('/api/sponsor-showcase/sponsors/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const existing = await db.query('SELECT id, name FROM sponsor_showcase_sponsors WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '赞助商不存在' } });
      return;
    }

    await db.query('DELETE FROM sponsor_showcase_sponsors WHERE id = $1', [id]);
    logger.info('Sponsor deleted', { sponsorId: id, name: existing.rows[0].name });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DELETE_SPONSOR_ERROR', message: (error as Error).message } });
  }
});

app.put('/api/sponsor-showcase/sponsors/order', requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'orders 必须是非空数组' } });
      return;
    }

    for (const item of orders) {
      if (!item.id || typeof item.order !== 'number') continue;
      await db.query('UPDATE sponsor_showcase_sponsors SET sort_order = $1, updated_at = NOW() WHERE id = $2', [item.order, item.id]);
    }

    logger.info('Sponsor order updated', { count: orders.length });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ORDER_ERROR', message: (error as Error).message } });
  }
});

const PORT = process.env.PORT || 3004;

async function runMigrations() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sponsor_showcase_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        page VARCHAR(50) NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT true,
        title VARCHAR(200) DEFAULT '',
        style VARCHAR(20) DEFAULT 'grid',
        max_items INTEGER DEFAULT 6,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sponsor_showcase_sponsors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(200) NOT NULL,
        logo TEXT DEFAULT '',
        url VARCHAR(500) DEFAULT '',
        description TEXT DEFAULT '',
        position VARCHAR(20) NOT NULL DEFAULT 'top',
        enabled BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sponsor_position ON sponsor_showcase_sponsors(position);
      CREATE INDEX IF NOT EXISTS idx_sponsor_enabled ON sponsor_showcase_sponsors(enabled) WHERE enabled = true;

      INSERT INTO sponsor_showcase_configs (page, enabled, title, style, max_items) VALUES
        ('ping', false, '赞助商', 'grid', 6),
        ('http', false, '赞助商', 'grid', 6),
        ('dashboard', false, '合作伙伴', 'carousel', 8),
        ('sponsor', false, '特别感谢', 'list', 12)
      ON CONFLICT (page) DO NOTHING;
    `);
    logger.info('Sponsor showcase tables migrated successfully');
  } catch (error) {
    logger.error('Failed to run sponsor showcase migrations', { error: (error as Error).message });
  }
}

async function main() {
  try {
    await messageBus.connect();
  } catch (error) {
    logger.warn('Failed to connect to RabbitMQ, running without message bus', { error: (error as Error).message });
  }

  try {
    await db.query('SELECT 1');
    logger.info('Database connected successfully');
    await runMigrations();
  } catch (error) {
    logger.warn('Database not available yet, will retry later', { error: (error as Error).message });
  }

  app.listen(PORT, () => {
    logger.info(`Node service running on port ${PORT}`);
  });

  setInterval(async () => {
    if (!messageBus.isConnected()) {
      try {
        await messageBus.connect();
        logger.info('Reconnected to RabbitMQ');
      } catch {
        logger.warn('RabbitMQ reconnection failed');
      }
    }
  }, 30000);

  setInterval(async () => {
    try {
      const { nodes } = await nodeRepository.list(1, 1000, 'online');
      const now = Date.now();
      for (const node of nodes) {
        const lastHeartbeat = new Date(node.lastHeartbeat).getTime();
        if (now - lastHeartbeat > 90000) {
          logger.warn('Node heartbeat timeout, marking offline', { nodeId: node.id });
          await nodeRepository.updateStatus(node.id, 'offline');
        }
      }
    } catch (error) {
      logger.error('Heartbeat check failed', { error: (error as Error).message });
    }
  }, 60000);
}

main().catch((error) => {
  logger.error('Failed to start node service', { error: error.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await messageBus.disconnect();
  await redis.close();
  await db.close();
  process.exit(0);
});
