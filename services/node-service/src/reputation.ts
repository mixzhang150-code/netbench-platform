import { NodeInfo, NodeReputation } from '@netbench/types';
import { createLogger } from '@netbench/logger';
import { NodeRepository } from './repository';

const logger = createLogger('reputation');

export class ReputationSystem {
  private repository: NodeRepository;

  private readonly WEIGHTS = {
    taskSuccess: 0.30,
    responseTime: 0.20,
    uptime: 0.25,
    consistency: 0.15,
    contribution: 0.10,
  };

  private readonly SCORE_BOUNDS = {
    min: 0,
    max: 100,
    initial: 50,
    penaltyThreshold: 20,
    suspensionThreshold: 10,
  };

  constructor(repository: NodeRepository) {
    this.repository = repository;
  }

  async evaluateNode(nodeId: string): Promise<NodeReputation> {
    const node = await this.repository.findById(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const taskSuccessScore = this.calculateTaskSuccessScore(node);
    const responseTimeScore = this.calculateResponseTimeScore(node);
    const uptimeScore = this.calculateUptimeScore(node);
    const consistencyScore = this.calculateConsistencyScore(node);
    const contributionScore = this.calculateContributionScore(node);

    const overallScore = Math.round(
      taskSuccessScore * this.WEIGHTS.taskSuccess +
      responseTimeScore * this.WEIGHTS.responseTime +
      uptimeScore * this.WEIGHTS.uptime +
      consistencyScore * this.WEIGHTS.consistency +
      contributionScore * this.WEIGHTS.contribution
    );

    const clampedScore = Math.max(this.SCORE_BOUNDS.min, Math.min(this.SCORE_BOUNDS.max, overallScore));

    const reputation: Partial<NodeReputation> = {
      score: clampedScore,
      lastEvaluated: new Date().toISOString(),
    };

    await this.repository.updateReputation(nodeId, reputation);

    if (clampedScore < this.SCORE_BOUNDS.suspensionThreshold) {
      logger.warn('Node suspended due to low reputation', { nodeId, score: clampedScore });
      await this.repository.updateStatus(nodeId, 'suspended');
    } else if (clampedScore < this.SCORE_BOUNDS.penaltyThreshold) {
      logger.warn('Node reputation below penalty threshold', { nodeId, score: clampedScore });
    }

    logger.info('Node reputation evaluated', {
      nodeId,
      score: clampedScore,
      breakdown: {
        taskSuccess: taskSuccessScore,
        responseTime: responseTimeScore,
        uptime: uptimeScore,
        consistency: consistencyScore,
        contribution: contributionScore,
      },
    });

    const updatedNode = await this.repository.findById(nodeId);
    return updatedNode!.reputation;
  }

  async recordTaskResult(nodeId: string, success: boolean, responseTime: number): Promise<void> {
    const node = await this.repository.findById(nodeId);
    if (!node) return;

    const updates: Partial<NodeReputation> = {
      totalTasks: node.reputation.totalTasks + 1,
    };

    if (success) {
      updates.successfulTasks = node.reputation.successfulTasks + 1;
    } else {
      updates.failedTasks = node.reputation.failedTasks + 1;
    }

    const totalResponseTime = node.reputation.avgResponseTime * node.reputation.totalTasks + responseTime;
    updates.avgResponseTime = totalResponseTime / (node.reputation.totalTasks + 1);

    await this.repository.updateReputation(nodeId, updates);

    if (node.reputation.totalTasks % 10 === 0) {
      await this.evaluateNode(nodeId);
    }
  }

  async recordHeartbeat(nodeId: string, isOnline: boolean): Promise<void> {
    const node = await this.repository.findById(nodeId);
    if (!node) return;

    const totalHeartbeats = node.reputation.totalTasks + 1;
    const onlineHeartbeats = isOnline
      ? Math.ceil(node.reputation.uptime * node.reputation.totalTasks / 100) + 1
      : Math.ceil(node.reputation.uptime * node.reputation.totalTasks / 100);

    const newUptime = (onlineHeartbeats / totalHeartbeats) * 100;

    await this.repository.updateReputation(nodeId, { uptime: newUptime });
  }

  private calculateTaskSuccessScore(node: NodeInfo): number {
    if (node.reputation.totalTasks === 0) return 50;
    const successRate = node.reputation.successfulTasks / node.reputation.totalTasks;
    return successRate * 100;
  }

  private calculateResponseTimeScore(node: NodeInfo): number {
    const avgTime = node.reputation.avgResponseTime;
    if (avgTime === 0) return 50;
    if (avgTime < 100) return 100;
    if (avgTime < 500) return 80;
    if (avgTime < 1000) return 60;
    if (avgTime < 3000) return 40;
    if (avgTime < 5000) return 20;
    return 10;
  }

  private calculateUptimeScore(node: NodeInfo): number {
    return node.reputation.uptime;
  }

  private calculateConsistencyScore(node: NodeInfo): number {
    if (node.reputation.totalTasks < 5) return 50;
    const successRate = node.reputation.successfulTasks / node.reputation.totalTasks;
    const variance = successRate * (1 - successRate);
    const consistency = 1 - (variance * 4);
    return Math.max(0, consistency * 100);
  }

  private calculateContributionScore(node: NodeInfo): number {
    const tasks = node.stats.totalTasksCompleted;
    if (tasks === 0) return 0;
    if (tasks < 10) return 20;
    if (tasks < 50) return 40;
    if (tasks < 100) return 60;
    if (tasks < 500) return 80;
    return 100;
  }
}
