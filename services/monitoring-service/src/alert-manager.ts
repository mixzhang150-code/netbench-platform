import { PostgresClient, RedisClient } from '@netbench/database';
import { createLogger } from '@netbench/logger';
import { AlertRule, ServiceHealth } from '@netbench/types';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('alert-manager');

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export class AlertManager {
  private db: PostgresClient;
  private redis: RedisClient;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(db: PostgresClient, redis: RedisClient) {
    this.db = db;
    this.redis = redis;
  }

  async start(): Promise<void> {
    await this.loadRules();
    this.checkInterval = setInterval(() => this.runChecks(), 30000);
    logger.info('Alert manager started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    logger.info('Alert manager stopped');
  }

  async addRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const id = uuidv4();
    const fullRule: AlertRule = { ...rule, id };

    this.rules.set(id, fullRule);

    await this.db.query(`
      INSERT INTO alert_rules (id, name, condition, threshold, duration, severity, enabled, notify_channels)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, rule.name, rule.condition, rule.threshold, rule.duration, rule.severity, rule.enabled, JSON.stringify(rule.notifyChannels)]);

    logger.info('Alert rule added', { ruleId: id, name: rule.name });
    return fullRule;
  }

  async removeRule(id: string): Promise<void> {
    this.rules.delete(id);
    await this.db.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    logger.info('Alert rule removed', { ruleId: id });
  }

  async enableRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = true;
      await this.db.query('UPDATE alert_rules SET enabled = true WHERE id = $1', [id]);
    }
  }

  async disableRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = false;
      await this.db.query('UPDATE alert_rules SET enabled = false WHERE id = $1', [id]);
    }
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.db.query('UPDATE alerts SET acknowledged = true WHERE id = $1', [alertId]);
    }
  }

  async checkServiceHealth(services: { name: string; url: string }[]): Promise<ServiceHealth[]> {
    const results: ServiceHealth[] = [];

    for (const service of services) {
      const start = Date.now();
      try {
        const response = await fetch(`${service.url}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;

        const health: ServiceHealth = {
          service: service.name,
          status: response.ok ? 'healthy' : 'degraded',
          uptime: process.uptime(),
          version: '1.0.0',
          checks: [
            {
              name: 'http',
              status: response.ok ? 'up' : 'down',
              latency,
            },
          ],
        };

        results.push(health);

        if (!response.ok) {
          await this.evaluateAlert('service_down', service.name, 1);
        }
      } catch {
        const health: ServiceHealth = {
          service: service.name,
          status: 'unhealthy',
          uptime: 0,
          version: 'unknown',
          checks: [
            {
              name: 'http',
              status: 'down',
              message: 'Connection refused or timeout',
            },
          ],
        };

        results.push(health);
        await this.evaluateAlert('service_down', service.name, 1);
      }
    }

    return results;
  }

  private async evaluateAlert(condition: string, target: string, value: number): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.condition !== condition) continue;

      if (this.shouldTrigger(rule, value)) {
        await this.triggerAlert(rule, target, value);
      }
    }
  }

  private shouldTrigger(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'service_down':
      case 'node_offline':
      case 'high_packet_loss':
        return value >= rule.threshold;
      case 'high_latency':
      case 'high_error_rate':
        return value >= rule.threshold;
      case 'low_reputation':
        return value <= rule.threshold;
      default:
        return value >= rule.threshold;
    }
  }

  private async triggerAlert(rule: AlertRule, target: string, value: number): Promise<void> {
    const alertKey = `${rule.id}:${target}`;

    if (this.activeAlerts.has(alertKey)) return;

    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Alert: ${rule.name} - ${target} (value: ${value}, threshold: ${rule.threshold})`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.activeAlerts.set(alertKey, alert);

    await this.db.query(`
      INSERT INTO alerts (id, rule_id, severity, message, target, value, threshold, acknowledged, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [alert.id, rule.id, alert.severity, alert.message, target, value, rule.threshold, false, alert.timestamp]);

    await this.sendNotifications(rule, alert);

    logger.warn('Alert triggered', {
      ruleName: rule.name,
      severity: rule.severity,
      target,
    });
  }

  private async sendNotifications(rule: AlertRule, alert: Alert): Promise<void> {
    for (const channel of rule.notifyChannels) {
      switch (channel) {
        case 'log':
          logger.error('ALERT', { alert });
          break;
        case 'redis':
          await this.redis.publish('netbench:alerts', JSON.stringify(alert));
          break;
        default:
          logger.info('Notification channel not implemented', { channel });
      }
    }
  }

  private async runChecks(): Promise<void> {
    try {
      const nodeStats = await this.redis.get('stats:monitor:nodes');
      if (nodeStats) {
        const stats = JSON.parse(nodeStats);
        if (stats.offlineCount > 0) {
          await this.evaluateAlert('node_offline', 'cluster', stats.offlineCount);
        }
      }
    } catch (error) {
      logger.error('Alert check failed', { error: (error as Error).message });
    }
  }

  private async loadRules(): Promise<void> {
    try {
      const result = await this.db.query<{
        id: string; name: string; condition: string; threshold: number;
        duration: number; severity: string; enabled: boolean; notify_channels: string;
      }>('SELECT * FROM alert_rules WHERE enabled = true');

      for (const row of result.rows) {
        this.rules.set(row.id, {
          id: row.id,
          name: row.name,
          condition: row.condition,
          threshold: row.threshold,
          duration: row.duration,
          severity: row.severity as AlertRule['severity'],
          enabled: row.enabled,
          notifyChannels: typeof row.notify_channels === 'string'
            ? JSON.parse(row.notify_channels)
            : row.notify_channels,
        });
      }

      logger.info('Alert rules loaded', { count: this.rules.size });
    } catch (error) {
      logger.warn('Failed to load alert rules', { error: (error as Error).message });
    }
  }
}
