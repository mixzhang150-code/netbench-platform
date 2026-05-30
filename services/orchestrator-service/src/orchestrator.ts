import { createLogger } from '@netbench/logger';
import { RedisClient } from '@netbench/database';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('test-orchestrator');

export type TestType = 'ping' | 'http' | 'speedtest';

export interface MultiPointTestRequest {
  type: TestType;
  target: string;
  config: Record<string, unknown>;
  nodeIds?: string[];
  excludeNodeIds?: string[];
  maxNodes?: number;
}

export interface NodeTestTask {
  taskId: string;
  batchId: string;
  nodeId: string;
  nodeName: string;
  nodeLocation: string;
  sponsor?: string;
  type: TestType;
  target: string;
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface BatchTest {
  id: string;
  type: TestType;
  target: string;
  config: Record<string, unknown>;
  status: 'dispatching' | 'running' | 'completed' | 'partial' | 'failed';
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  tasks: Map<string, NodeTestTask>;
  createdAt: string;
  completedAt?: string;
  userId?: string;
}

type ResultCallback = (batchId: string, task: NodeTestTask) => void;

export class TestOrchestrator {
  private redis: RedisClient;
  private activeBatches: Map<string, BatchTest> = new Map();
  private resultCallbacks: ResultCallback[] = [];
  private serviceUrls: Record<string, string>;

  constructor(redis: RedisClient, serviceUrls: Record<string, string>) {
    this.redis = redis;
    this.serviceUrls = serviceUrls;
  }

  private getDataServiceUrl(): string {
    return this.serviceUrls.data || 'http://localhost:3006';
  }

  private async saveToHistory(task: NodeTestTask): Promise<void> {
    try {
      const dataServiceUrl = this.getDataServiceUrl();
      const result = task.result as Record<string, unknown> || {};
      const historyPayload = {
        id: task.taskId,
        taskId: task.batchId,
        type: task.type,
        target: task.target,
        status: task.status === 'completed' ? 'success' : 'failed',
        resultData: result,
        nodeId: task.nodeId,
        nodeLocation: task.nodeLocation,
        createdAt: task.createdAt,
      };

      await fetch(`${dataServiceUrl}/api/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyPayload),
      });
      logger.debug('Test result saved to history', { taskId: task.taskId, type: task.type });
    } catch (error) {
      logger.warn('Failed to save test result to history', { taskId: task.taskId, error: (error as Error).message });
    }
  }

  onResult(callback: ResultCallback): void {
    this.resultCallbacks.push(callback);
  }

  async createBatchTest(request: MultiPointTestRequest, userId?: string): Promise<BatchTest> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const nodes = await this.selectNodes(request);

    if (nodes.length === 0) {
      throw new Error('No available nodes for this test');
    }

    const batch: BatchTest = {
      id: batchId,
      type: request.type,
      target: request.target,
      config: request.config,
      status: 'dispatching',
      totalNodes: nodes.length,
      completedNodes: 0,
      failedNodes: 0,
      tasks: new Map(),
      createdAt: new Date().toISOString(),
      userId,
    };

    for (const node of nodes) {
      const task: NodeTestTask = {
        taskId: uuidv4(),
        batchId,
        nodeId: node.id,
        nodeName: node.name,
        nodeLocation: `${node.location.city}, ${node.location.region}`,
        sponsor: node.sponsor || undefined,
        type: request.type,
        target: request.target,
        config: request.config,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      batch.tasks.set(task.taskId, task);
    }

    this.activeBatches.set(batchId, batch);

    await this.redis.set(`batch:${batchId}`, JSON.stringify({
      id: batch.id,
      type: batch.type,
      target: batch.target,
      status: batch.status,
      totalNodes: batch.totalNodes,
      completedNodes: 0,
      failedNodes: 0,
      createdAt: batch.createdAt,
    }), 3600);

    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all([
        this.redis.incr('stats:total_tests'),
        this.redis.incr(`stats:tests:${today}`),
      ]);
    } catch (e) {
      logger.warn('Failed to increment test counters', { error: (e as Error).message });
    }

    logger.info('Batch test created', {
      batchId,
      type: request.type,
      target: request.target,
      nodeCount: nodes.length,
    });

    this.dispatchTasks(batch);

    return batch;
  }

  private async selectNodes(request: MultiPointTestRequest): Promise<Array<{
    id: string;
    name: string;
    location: { city: string; region: string; country: string; lat: number; lon: number };
    sponsor?: string;
  }>> {
    try {
      const nodeServiceUrl = this.serviceUrls.node || 'http://localhost:3004';
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || 'netbench_internal_token_2024';
      const response = await fetch(`${nodeServiceUrl}/api/internal/nodes?limit=200&status=online`, {
        headers: {
          'X-Internal-Token': internalToken,
        },
      });
      const data = await response.json() as { success?: boolean; data?: unknown; error?: { message?: string } };

      if (!data.success || !data.data) return [];

      let nodes = data.data as Array<{
        id: string;
        name: string;
        status: string;
        capabilities?: { ping?: boolean; http?: boolean; speedtest?: boolean };
        location: { city: string; region: string; country: string; lat: number; lon: number };
        sponsor?: string;
      }>;

      if (request.nodeIds && request.nodeIds.length > 0) {
        nodes = nodes.filter(n => request.nodeIds!.includes(n.id));
      }

      if (request.excludeNodeIds && request.excludeNodeIds.length > 0) {
        nodes = nodes.filter(n => !request.excludeNodeIds!.includes(n.id));
      }

      const capKey = request.type;
      nodes = nodes.filter(n => {
        if (!n.capabilities) return true;
        return n.capabilities[capKey as keyof typeof n.capabilities] !== false;
      });

      if (request.maxNodes && request.maxNodes > 0) {
        nodes = nodes.slice(0, request.maxNodes);
      }

      return nodes;
    } catch (error) {
      logger.error('Failed to select nodes', { error: (error as Error).message });
      return [];
    }
  }

  private async dispatchTasks(batch: BatchTest): Promise<void> {
    batch.status = 'running';
    await this.updateBatchStatus(batch);

    const dispatchPromises: Promise<void>[] = [];

    for (const [taskId, task] of batch.tasks) {
      dispatchPromises.push(this.dispatchSingleTask(batch, task));
    }

    Promise.allSettled(dispatchPromises).then(() => {
      logger.info('All tasks dispatched', { batchId: batch.id });
    });
  }

  private async dispatchSingleTask(batch: BatchTest, task: NodeTestTask): Promise<void> {
    task.status = 'running';

    try {
      const nodeServiceUrl = this.serviceUrls.node || 'http://localhost:3004';
      await fetch(`${nodeServiceUrl}/api/nodes/push-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: task.nodeId,
          taskId: task.taskId,
          type: batch.type,
          target: batch.target,
          config: batch.config,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      logger.warn('Failed to push task to node, will try fallback', { taskId: task.taskId, error: (error as Error).message });
      try {
        const serviceUrl = this.getServiceUrl(batch.type);
        if (serviceUrl) {
          const body = this.buildRequestBody(batch.type, batch.target, batch.config);
          const response = await fetch(`${serviceUrl}/api/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000),
          });
          const data = await response.json() as { success?: boolean; data?: Record<string, unknown>; error?: { message?: string } };
          if (data.success && data.data) {
            task.status = 'completed';
            task.result = { ...data.data, sponsor: task.sponsor };
            task.completedAt = new Date().toISOString();
            batch.completedNodes++;
            this.notifyResult(batch.id, task);
            await this.saveToHistory(task);
            await this.checkBatchCompletion(batch);
            return;
          }
        }
      } catch {}
      task.status = 'failed';
      task.result = { error: 'Failed to dispatch task', sponsor: task.sponsor };
      batch.failedNodes++;
      this.notifyResult(batch.id, task);
      await this.saveToHistory(task);
      await this.checkBatchCompletion(batch);
      return;
    }

    this.startResultPolling(batch, task);
  }

  private startResultPolling(batch: BatchTest, task: NodeTestTask): void {
    const maxWait = 120000;
    const startTime = Date.now();
    const nodeServiceUrl = this.serviceUrls.node || 'http://localhost:3004';

    const poll = async () => {
      if (Date.now() - startTime > maxWait) {
        task.status = 'timeout';
        task.result = { error: 'Task timeout - agent did not respond', sponsor: task.sponsor };
        batch.failedNodes++;
        this.notifyResult(batch.id, task);
        await this.saveToHistory(task);
        await this.checkBatchCompletion(batch);
        return;
      }

      try {
        const res = await fetch(`${nodeServiceUrl}/api/tasks/${task.taskId}/result`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as { success?: boolean; data?: Record<string, unknown> };
        if (data.success && data.data) {
          const rd = data.data;
          task.status = (rd.status as string) === 'completed' ? 'completed' : ((rd.status as string) === 'failed' ? 'failed' : 'completed');
          task.result = { ...(rd.result as Record<string, unknown>), sponsor: task.sponsor };
          task.completedAt = new Date().toISOString();
          if (task.status === 'completed') batch.completedNodes++; else batch.failedNodes++;
          this.notifyResult(batch.id, task);
          await this.saveToHistory(task);
          await this.checkBatchCompletion(batch);
          return;
        }
      } catch {}

      setTimeout(poll, 2000);
    };

    setTimeout(poll, 3000);
  }

  private buildRequestBody(type: TestType, target: string, config: Record<string, unknown>): Record<string, unknown> {
    switch (type) {
      case 'ping':
        return {
          target,
          count: config.count || 4,
          timeout: config.timeout || 5000,
          interval: config.interval || 1000,
        };
      case 'http':
        return {
          url: target,
          method: config.method || 'GET',
          headers: config.headers,
          body: config.body,
          expectedStatus: config.expectedStatus,
          timeout: config.timeout || 10000,
          followRedirects: config.followRedirects ?? true,
          validateCert: config.validateCert ?? true,
        };
      case 'speedtest':
        return {
          duration: config.duration || 10,
          parallel: config.parallel || 4,
        };
      default:
        return { target };
    }
  }

  private getServiceUrl(type: TestType): string | null {
    switch (type) {
      case 'ping': return this.serviceUrls.ping;
      case 'http': return this.serviceUrls.http;
      case 'speedtest': return this.serviceUrls.speedtest;
      default: return null;
    }
  }

  private async checkBatchCompletion(batch: BatchTest): Promise<void> {
    const totalProcessed = batch.completedNodes + batch.failedNodes;

    if (totalProcessed >= batch.totalNodes) {
      if (batch.failedNodes === batch.totalNodes) {
        batch.status = 'failed';
      } else if (batch.failedNodes > 0) {
        batch.status = 'partial';
      } else {
        batch.status = 'completed';
      }
      batch.completedAt = new Date().toISOString();

      await this.updateBatchStatus(batch);

      const latencies: number[] = [];
      for (const [, task] of batch.tasks) {
        if (task.status === 'completed' && task.result) {
          const r = task.result as Record<string, unknown>;
          const latency = (r.avgRtt as number) || (r.responseTime as number) || 0;
          if (latency > 0) latencies.push(latency);
        }
      }
      if (latencies.length > 0) {
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        try {
          await this.redis.set('stats:avg_latency', String(Math.round(avg)));
        } catch {}
      }

      logger.info('Batch test completed', {
        batchId: batch.id,
        status: batch.status,
        completed: batch.completedNodes,
        failed: batch.failedNodes,
        total: batch.totalNodes,
      });

      setTimeout(() => {
        this.activeBatches.delete(batch.id);
      }, 60000);
    }
  }

  private async updateBatchStatus(batch: BatchTest): Promise<void> {
    await this.redis.set(`batch:${batch.id}`, JSON.stringify({
      id: batch.id,
      type: batch.type,
      target: batch.target,
      status: batch.status,
      totalNodes: batch.totalNodes,
      completedNodes: batch.completedNodes,
      failedNodes: batch.failedNodes,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
    }), 3600);
  }

  private notifyResult(batchId: string, task: NodeTestTask): void {
    for (const callback of this.resultCallbacks) {
      try {
        callback(batchId, task);
      } catch (error) {
        logger.error('Result callback error', { error: (error as Error).message });
      }
    }
  }

  getBatch(batchId: string): BatchTest | undefined {
    return this.activeBatches.get(batchId);
  }

  getBatchResults(batchId: string): NodeTestTask[] {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return [];
    return Array.from(batch.tasks.values());
  }

  getActiveBatches(): BatchTest[] {
    return Array.from(this.activeBatches.values());
  }
}
