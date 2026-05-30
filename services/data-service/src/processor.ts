import { PostgresClient, RedisClient, InfluxClient } from '@netbench/database';
import { createLogger } from '@netbench/logger';
import { PingTestResult, HttpTestResult, SpeedTestResult, TestReport } from '@netbench/types';

const logger = createLogger('data-processor');

export interface TestResultInput {
  id: string;
  taskId: string;
  type: string;
  target: string;
  status: string;
  resultData: Record<string, unknown>;
  nodeId: string;
  nodeLocation: string;
  createdAt: string;
}

export class DataProcessor {
  private db: PostgresClient;
  private redis: RedisClient;
  private influx: InfluxClient;

  constructor(db: PostgresClient, redis: RedisClient, influx: InfluxClient) {
    this.db = db;
    this.redis = redis;
    this.influx = influx;
  }

  async saveTestResult(input: TestResultInput): Promise<void> {
    await this.db.query(`
      INSERT INTO test_results (id, task_id, type, target, status, result_data, node_id, node_location, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        result_data = EXCLUDED.result_data,
        node_location = EXCLUDED.node_location
    `, [
      input.id,
      input.taskId,
      input.type,
      input.target,
      input.status,
      JSON.stringify(input.resultData),
      input.nodeId,
      input.nodeLocation,
      input.createdAt,
    ]);

    const numericMetrics: Record<string, number> = {};
    for (const [key, value] of Object.entries(input.resultData)) {
      if (typeof value === 'number') {
        numericMetrics[key] = value;
      }
    }
    await this.updateRealtimeStats(input.type, input.nodeId, numericMetrics);

    logger.info('Test result saved', { id: input.id, type: input.type, target: input.target });
  }

  async processPingResult(taskId: string, result: PingTestResult): Promise<void> {
    await this.db.query(`
      INSERT INTO test_results (id, task_id, type, target, status, result_data, node_id, node_location, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      result.id,
      taskId,
      'ping',
      result.target,
      result.packetLoss === 0 ? 'success' : 'partial',
      JSON.stringify(result),
      result.nodeId,
      result.nodeLocation,
      result.timestamp,
    ]);

    await this.updateRealtimeStats('ping', result.nodeId, {
      avgRtt: result.avgRtt,
      packetLoss: result.packetLoss,
    });

    logger.info('Ping result processed', { taskId, target: result.target });
  }

  async processHttpResult(taskId: string, result: HttpTestResult): Promise<void> {
    await this.db.query(`
      INSERT INTO test_results (id, task_id, type, target, status, result_data, node_id, node_location, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      result.id,
      taskId,
      'http',
      result.url,
      result.success ? 'success' : 'failed',
      JSON.stringify(result),
      result.nodeId,
      result.nodeLocation,
      result.timestamp,
    ]);

    await this.updateRealtimeStats('http', result.nodeId, {
      responseTime: result.responseTime,
      statusCode: result.statusCode,
    });

    logger.info('HTTP result processed', { taskId, url: result.url });
  }

  async processSpeedtestResult(taskId: string, result: SpeedTestResult): Promise<void> {
    await this.db.query(`
      INSERT INTO test_results (id, task_id, type, target, status, result_data, node_id, node_location, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      result.id,
      taskId,
      'speedtest',
      `${result.nodeLocation} -> ${result.serverLocation}`,
      'success',
      JSON.stringify(result),
      result.nodeId,
      result.nodeLocation,
      result.timestamp,
    ]);

    await this.updateRealtimeStats('speedtest', result.nodeId, {
      downloadSpeed: result.downloadSpeed,
      uploadSpeed: result.uploadSpeed,
      latency: result.latency,
    });

    logger.info('Speedtest result processed', { taskId });
  }

  private async updateRealtimeStats(type: string, nodeId: string, metrics: Record<string, number>): Promise<void> {
    const key = `stats:${type}:${nodeId}`;
    const existing = await this.redis.get(key);
    const stats = existing ? JSON.parse(existing) : { count: 0, metrics: {} };

    stats.count++;
    for (const [metric, value] of Object.entries(metrics)) {
      if (stats.metrics[metric]) {
        stats.metrics[metric] = (stats.metrics[metric] * (stats.count - 1) + value) / stats.count;
      } else {
        stats.metrics[metric] = value;
      }
    }

    await this.redis.set(key, JSON.stringify(stats), 3600);
  }

  async getTestHistory(
    type?: string,
    nodeId?: string,
    startTime?: string,
    endTime?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ results: unknown[]; total: number }> {
    let query = 'SELECT * FROM test_results WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (nodeId) {
      query += ` AND node_id = $${paramIndex}`;
      params.push(nodeId);
      paramIndex++;
    }

    if (startTime) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startTime);
      paramIndex++;
    }

    if (endTime) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endTime);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await this.db.query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const result = await this.db.query(query, params);

    return {
      results: result.rows.map(row => ({
        ...row,
        result_data: typeof row.result_data === 'string' ? JSON.parse(row.result_data) : row.result_data,
      })),
      total,
    };
  }

  async getTrendAnalysis(
    type: string,
    target: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    points: number = 24
  ): Promise<unknown[]> {
    const fluxQuery = `
      from(bucket: "test_results")
        |> range(start: -${points}${period === 'hour' ? 'h' : period === 'day' ? 'd' : period === 'week' ? 'w' : 'mo'})
        |> filter(fn: (r) => r._measurement == "${type}_test")
        ${target ? `|> filter(fn: (r) => r.target == "${target}")` : ''}
        |> aggregateWindow(every: ${period === 'hour' ? '5m' : period === 'day' ? '1h' : period === 'week' ? '6h' : '1d'}, fn: mean, createEmpty: false)
        |> limit(n: ${points})
    `;

    try {
      return await this.influx.query(fluxQuery);
    } catch (error) {
      logger.error('Trend analysis query failed', { error: (error as Error).message });
      return [];
    }
  }

  async generateReport(
    userId: string,
    title: string,
    description: string,
    taskIds: string[]
  ): Promise<TestReport> {
    const result = await this.db.query(
      'SELECT result_data, type FROM test_results WHERE task_id = ANY($1)',
      [taskIds]
    );

    let passed = 0;
    let failed = 0;
    let totalResponseTime = 0;
    let count = 0;

    for (const row of result.rows) {
      const data = typeof row.result_data === 'string' ? JSON.parse(row.result_data) : row.result_data;
      if (data.success !== false && data.packetLoss !== 100) {
        passed++;
      } else {
        failed++;
      }

      if (data.avgRtt) {
        totalResponseTime += data.avgRtt;
        count++;
      } else if (data.responseTime) {
        totalResponseTime += data.responseTime;
        count++;
      }
    }

    const report: TestReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      title,
      description,
      tasks: taskIds,
      createdAt: new Date().toISOString(),
      summary: {
        totalTests: passed + failed,
        passed,
        failed,
        avgResponseTime: count > 0 ? totalResponseTime / count : 0,
      },
    };

    await this.db.query(`
      INSERT INTO reports (id, user_id, title, description, task_ids, summary, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      report.id,
      userId,
      title,
      description,
      JSON.stringify(taskIds),
      JSON.stringify(report.summary),
      report.createdAt,
    ]);

    return report;
  }

  async archiveOldData(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.query(
      'DELETE FROM test_results WHERE created_at < $1',
      [cutoffDate.toISOString()]
    );

    logger.info('Data archived', {
      cutoffDate: cutoffDate.toISOString(),
      deletedRows: result.rowCount,
    });

    return result.rowCount || 0;
  }
}
