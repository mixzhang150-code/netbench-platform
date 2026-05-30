import { PostgresClient, RedisClient } from '@netbench/database';
import { createLogger } from '@netbench/logger';
import { NodeInfo, NodeCapabilities, NodeReputation, NodeStats } from '@netbench/types';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('node-repository');

export class NodeRepository {
  private db: PostgresClient;
  private redis: RedisClient;

  constructor(db: PostgresClient, redis: RedisClient) {
    this.db = db;
    this.redis = redis;
  }

  async create(node: Omit<NodeInfo, 'id' | 'reputation' | 'stats' | 'lastHeartbeat' | 'registeredAt'>): Promise<NodeInfo> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const reputation: NodeReputation = {
      score: 50,
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      uptime: 100,
      lastEvaluated: now,
    };

    const stats: NodeStats = {
      currentTasks: 0,
      totalTasksCompleted: 0,
      totalUptime: 0,
      lastTestAt: '',
    };

    await this.db.query(`
      INSERT INTO nodes (
        id, name, owner_id, status, version, platform, platform_details,
        ip, country, region, city, lat, lon, isp,
        cap_ping, cap_http, cap_speedtest, max_concurrent_tasks, bandwidth_limit,
        reputation_score, reputation_total_tasks, reputation_successful_tasks,
        reputation_failed_tasks, reputation_avg_response_time, reputation_uptime,
        stats_current_tasks, stats_total_tasks_completed, stats_total_uptime,
        token, sponsor, registered_at, last_heartbeat
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
    `, [
      id, node.name, node.ownerId, node.status, node.version, node.platform, node.platformDetails,
      node.ip, node.location.country, node.location.region, node.location.city,
      node.location.lat, node.location.lon, node.location.isp,
      node.capabilities.ping, node.capabilities.http, node.capabilities.speedtest,
      node.capabilities.maxConcurrentTasks, node.capabilities.bandwidthLimit,
      reputation.score, reputation.totalTasks, reputation.successfulTasks,
      reputation.failedTasks, reputation.avgResponseTime, reputation.uptime,
      stats.currentTasks, stats.totalTasksCompleted, stats.totalUptime,
      node.token, node.sponsor || '', now, now,
    ]);

    const fullNode: NodeInfo = {
      ...node,
      id,
      reputation,
      stats,
      lastHeartbeat: now,
      registeredAt: now,
    };

    await this.cacheNode(fullNode);

    return fullNode;
  }

  async findById(id: string): Promise<NodeInfo | null> {
    const cached = await this.redis.get(`node:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query<{
      id: string; name: string; owner_id: string; status: string; version: string;
      platform: string; platform_details: string; ip: string;
      country: string; region: string; city: string; lat: number; lon: number; isp: string;
      cap_ping: boolean; cap_http: boolean; cap_speedtest: boolean;
      max_concurrent_tasks: number; bandwidth_limit: number;
      reputation_score: number; reputation_total_tasks: number;
      reputation_successful_tasks: number; reputation_failed_tasks: number;
      reputation_avg_response_time: number; reputation_uptime: number;
      stats_current_tasks: number; stats_total_tasks_completed: number;
      stats_total_uptime: number; token: string; sponsor: string; registered_at: string; last_heartbeat: string;
    }>('SELECT * FROM nodes WHERE id = $1', [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const node = this.mapRowToNode(row);

    await this.cacheNode(node);
    return node;
  }

  async findByToken(token: string): Promise<NodeInfo | null> {
    const result = await this.db.query<{ id: string }>('SELECT id FROM nodes WHERE token = $1', [token]);
    if (result.rows.length === 0) return null;
    return this.findById(result.rows[0].id);
  }

  async findByName(name: string): Promise<NodeInfo | null> {
    const result = await this.db.query<{ id: string }>('SELECT id FROM nodes WHERE name = $1', [name]);
    if (result.rows.length === 0) return null;
    return this.findById(result.rows[0].id);
  }

  async findByOwner(ownerId: string): Promise<NodeInfo[]> {
    const result = await this.db.query<{ id: string }>('SELECT id FROM nodes WHERE owner_id = $1', [ownerId]);
    const nodes: NodeInfo[] = [];
    for (const row of result.rows) {
      const node = await this.findById(row.id);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  async findOnlineByCapability(capability: 'ping' | 'http' | 'speedtest'): Promise<NodeInfo[]> {
    const capColumn = `cap_${capability}`;
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM nodes WHERE status = 'online' AND ${capColumn} = true`
    );
    const nodes: NodeInfo[] = [];
    for (const row of result.rows) {
      const node = await this.findById(row.id);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  async updateStatus(id: string, status: NodeInfo['status']): Promise<void> {
    await this.db.query('UPDATE nodes SET status = $1 WHERE id = $2', [status, id]);
    const node = await this.findById(id);
    if (node) {
      node.status = status;
      await this.cacheNode(node);
    }
  }

  async updateHeartbeat(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.query('UPDATE nodes SET last_heartbeat = $1 WHERE id = $2', [now, id]);
    const node = await this.findById(id);
    if (node) {
      node.lastHeartbeat = now;
      await this.cacheNode(node);
    }
  }

  async updateReputation(id: string, reputation: Partial<NodeReputation>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      score: 'reputation_score',
      totalTasks: 'reputation_total_tasks',
      successfulTasks: 'reputation_successful_tasks',
      failedTasks: 'reputation_failed_tasks',
      avgResponseTime: 'reputation_avg_response_time',
      uptime: 'reputation_uptime',
    };

    for (const [key, value] of Object.entries(reputation)) {
      if (fieldMap[key]) {
        fields.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return;

    values.push(new Date().toISOString());
    fields.push('reputation_last_evaluated = $' + paramIndex);
    paramIndex++;

    await this.db.query('UPDATE nodes SET ' + fields.join(', ') + ' WHERE id = $' + paramIndex, [...values, id]);

    const node = await this.findById(id);
    if (node) {
      Object.assign(node.reputation, reputation);
      await this.cacheNode(node);
    }
  }

  async updateStats(id: string, stats: Partial<NodeStats>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      currentTasks: 'stats_current_tasks',
      totalTasksCompleted: 'stats_total_tasks_completed',
      totalUptime: 'stats_total_uptime',
    };

    for (const [key, value] of Object.entries(stats)) {
      if (fieldMap[key]) {
        fields.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    await this.db.query(`UPDATE nodes SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);

    const node = await this.findById(id);
    if (node) {
      Object.assign(node.stats, stats);
      await this.cacheNode(node);
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM nodes WHERE id = $1', [id]);
    await this.redis.del(`node:${id}`);
  }

  async list(page: number = 1, limit: number = 20, status?: string): Promise<{ nodes: NodeInfo[]; total: number }> {
    let countQuery = 'SELECT COUNT(*) as total FROM nodes';
    let listQuery = 'SELECT id FROM nodes';
    const params: unknown[] = [];

    if (status) {
      countQuery += ' WHERE status = $1';
      listQuery += ' WHERE status = $1';
      params.push(status);
    }

    listQuery += ` ORDER BY registered_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const countResult = await this.db.query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    const listResult = await this.db.query<{ id: string }>(listQuery, params);
    const nodes: NodeInfo[] = [];
    for (const row of listResult.rows) {
      const node = await this.findById(row.id);
      if (node) nodes.push(node);
    }

    return { nodes, total };
  }

  async searchNodes(searchTerm: string, page: number = 1, limit: number = 20, status?: string): Promise<{ nodes: NodeInfo[]; total: number }> {
    const searchPattern = `%${searchTerm}%`;
    let countQuery = `SELECT COUNT(*) as total FROM nodes WHERE (
      name ILIKE $1 OR
      ip ILIKE $1 OR
      sponsor ILIKE $1 OR
      city ILIKE $1 OR
      region ILIKE $1 OR
      country ILIKE $1 OR
      isp ILIKE $1
    )`;
    let listQuery = `SELECT id FROM nodes WHERE (
      name ILIKE $1 OR
      ip ILIKE $1 OR
      sponsor ILIKE $1 OR
      city ILIKE $1 OR
      region ILIKE $1 OR
      country ILIKE $1 OR
      isp ILIKE $1
    )`;
    const params: unknown[] = [searchPattern];

    if (status) {
      countQuery += ` AND status = $2`;
      listQuery += ` AND status = $2`;
      params.push(status);
    }

    listQuery += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const countResult = await this.db.query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    const listResult = await this.db.query<{ id: string }>(listQuery, params);
    const nodes: NodeInfo[] = [];
    for (const row of listResult.rows) {
      const node = await this.findById(row.id);
      if (node) nodes.push(node);
    }

    return { nodes, total };
  }

  private async cacheNode(node: NodeInfo): Promise<void> {
    await this.redis.set(`node:${node.id}`, JSON.stringify(node), 300);
  }

  private mapRowToNode(row: Record<string, unknown>): NodeInfo {
    return {
      id: row.id as string,
      name: row.name as string,
      ownerId: row.owner_id as string,
      status: row.status as NodeInfo['status'],
      version: row.version as string,
      platform: row.platform as NodeInfo['platform'],
      platformDetails: row.platform_details as string,
      ip: row.ip as string,
      location: {
        country: row.country as string,
        region: row.region as string,
        city: row.city as string,
        lat: row.lat as number,
        lon: row.lon as number,
        isp: row.isp as string,
      },
      capabilities: {
        ping: row.cap_ping as boolean,
        http: row.cap_http as boolean,
        speedtest: row.cap_speedtest as boolean,
        maxConcurrentTasks: row.max_concurrent_tasks as number,
        bandwidthLimit: row.bandwidth_limit as number,
      },
      reputation: {
        score: row.reputation_score as number,
        totalTasks: row.reputation_total_tasks as number,
        successfulTasks: row.reputation_successful_tasks as number,
        failedTasks: row.reputation_failed_tasks as number,
        avgResponseTime: row.reputation_avg_response_time as number,
        uptime: row.reputation_uptime as number,
        lastEvaluated: row.reputation_last_evaluated as string || new Date().toISOString(),
      },
      stats: {
        currentTasks: row.stats_current_tasks as number,
        totalTasksCompleted: row.stats_total_tasks_completed as number,
        totalUptime: row.stats_total_uptime as number,
        lastTestAt: row.stats_last_test_at as string || '',
      },
      token: row.token as string,
      sponsor: (row.sponsor as string) || undefined,
      lastHeartbeat: row.last_heartbeat as string,
      registeredAt: row.registered_at as string,
    };
  }

  async updateSponsor(id: string, sponsor: string): Promise<void> {
    await this.db.query('UPDATE nodes SET sponsor = $1 WHERE id = $2', [sponsor || '', id]);
    const node = await this.findById(id);
    if (node) {
      node.sponsor = sponsor || undefined;
      await this.cacheNode(node);
    }
  }
}
