import { NodeInfo, NodeCapabilities } from '@netbench/types';
import { createLogger } from '@netbench/logger';
import { NodeRepository } from './repository';

const logger = createLogger('load-balancer');

interface NodeScore {
  nodeId: string;
  score: number;
  currentLoad: number;
  reputation: number;
  latency: number;
}

export class LoadBalancer {
  private repository: NodeRepository;

  constructor(repository: NodeRepository) {
    this.repository = repository;
  }

  async selectNode(
    capability: 'ping' | 'http' | 'speedtest',
    preferredLocation?: { lat: number; lon: number },
    excludeNodeIds: string[] = []
  ): Promise<NodeInfo | null> {
    const nodes = await this.repository.findOnlineByCapability(capability);

    const availableNodes = nodes.filter(
      node => !excludeNodeIds.includes(node.id) && node.stats.currentTasks < node.capabilities.maxConcurrentTasks
    );

    if (availableNodes.length === 0) {
      logger.warn('No available nodes for capability', { capability });
      return null;
    }

    const scored = availableNodes.map(node => this.calculateScore(node, preferredLocation));

    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0];
    const node = availableNodes.find(n => n.id === selected.nodeId);

    logger.info('Node selected', {
      capability,
      nodeId: selected.nodeId,
      score: selected.score,
      availableCount: availableNodes.length,
    });

    return node || null;
  }

  async selectMultipleNodes(
    capability: 'ping' | 'http' | 'speedtest',
    count: number,
    preferredLocation?: { lat: number; lon: number },
    excludeNodeIds: string[] = []
  ): Promise<NodeInfo[]> {
    const nodes = await this.repository.findOnlineByCapability(capability);

    const availableNodes = nodes.filter(
      node => !excludeNodeIds.includes(node.id) && node.stats.currentTasks < node.capabilities.maxConcurrentTasks
    );

    if (availableNodes.length === 0) return [];

    const scored = availableNodes.map(node => this.calculateScore(node, preferredLocation));
    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, count);
    return selected
      .map(s => availableNodes.find(n => n.id === s.nodeId)!)
      .filter(Boolean);
  }

  private calculateScore(node: NodeInfo, preferredLocation?: { lat: number; lon: number }): NodeScore {
    const loadFactor = 1 - (node.stats.currentTasks / node.capabilities.maxConcurrentTasks);
    const reputationFactor = node.reputation.score / 100;

    let locationFactor = 0.5;
    if (preferredLocation) {
      const distance = this.calculateDistance(
        preferredLocation.lat, preferredLocation.lon,
        node.location.lat, node.location.lon
      );
      locationFactor = Math.max(0, 1 - (distance / 20000));
    }

    const uptimeFactor = node.reputation.uptime / 100;

    const score = (
      loadFactor * 0.35 +
      reputationFactor * 0.30 +
      locationFactor * 0.20 +
      uptimeFactor * 0.15
    );

    return {
      nodeId: node.id,
      score,
      currentLoad: node.stats.currentTasks,
      reputation: node.reputation.score,
      latency: node.reputation.avgResponseTime,
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
