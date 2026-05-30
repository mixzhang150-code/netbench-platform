import * as amqplib from 'amqplib';
import { createLogger } from '@netbench/logger';

const logger = createLogger('messaging');

export const QUEUES = {
  PING_TASK: 'netbench.ping.task',
  PING_RESULT: 'netbench.ping.result',
  HTTP_TASK: 'netbench.http.task',
  HTTP_RESULT: 'netbench.http.result',
  SPEEDTEST_TASK: 'netbench.speedtest.task',
  SPEEDTEST_RESULT: 'netbench.speedtest.result',
  NODE_HEARTBEAT: 'netbench.node.heartbeat',
  NODE_EVENTS: 'netbench.node.events',
  ALERT_EVENTS: 'netbench.alert.events',
  DATA_PROCESS: 'netbench.data.process',
} as const;

export const EXCHANGES = {
  TASK_ROUTING: 'netbench.task.routing',
  RESULT_FANOUT: 'netbench.result.fanout',
  NODE_EVENTS: 'netbench.node.events',
} as const;

export class MessageBus {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor(url?: string) {
    this.url = url || process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect(): Promise<void> {
    try {
      const conn = await amqplib.connect(this.url);
      this.connection = conn;
      this.channel = await conn.createChannel();

      conn.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting reconnect...');
        this.attemptReconnect();
      });

      conn.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error', { error: err.message });
      });

      await this.setupExchanges();
      await this.setupQueues();

      this.reconnectAttempts = 0;
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error: (error as Error).message });
      throw error;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    try {
      await this.connect();
    } catch {
      this.attemptReconnect();
    }
  }

  private async setupExchanges(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    await this.channel.assertExchange(EXCHANGES.TASK_ROUTING, 'direct', { durable: true });
    await this.channel.assertExchange(EXCHANGES.RESULT_FANOUT, 'fanout', { durable: true });
    await this.channel.assertExchange(EXCHANGES.NODE_EVENTS, 'topic', { durable: true });
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    for (const queue of Object.values(QUEUES)) {
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-message-ttl': 86400000, 'x-max-length': 100000 }
      });
    }
    await this.channel.bindQueue(QUEUES.PING_TASK, EXCHANGES.TASK_ROUTING, 'ping');
    await this.channel.bindQueue(QUEUES.HTTP_TASK, EXCHANGES.TASK_ROUTING, 'http');
    await this.channel.bindQueue(QUEUES.SPEEDTEST_TASK, EXCHANGES.TASK_ROUTING, 'speedtest');
    await this.channel.bindQueue(QUEUES.PING_RESULT, EXCHANGES.RESULT_FANOUT, '');
    await this.channel.bindQueue(QUEUES.HTTP_RESULT, EXCHANGES.RESULT_FANOUT, '');
    await this.channel.bindQueue(QUEUES.SPEEDTEST_RESULT, EXCHANGES.RESULT_FANOUT, '');
  }

  async publish(queue: string, message: unknown, options?: { persistent?: boolean; priority?: number }): Promise<boolean> {
    if (!this.channel) throw new Error('Channel not initialized');
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.sendToQueue(queue, buffer, {
      persistent: options?.persistent ?? true,
      priority: options?.priority ?? 0,
      contentType: 'application/json',
    });
  }

  async publishToExchange(exchange: string, routingKey: string, message: unknown): Promise<boolean> {
    if (!this.channel) throw new Error('Channel not initialized');
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async subscribe(queue: string, handler: (message: unknown) => Promise<void>, options?: { prefetch?: number }): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    if (options?.prefetch) {
      await this.channel.prefetch(options.prefetch);
    }

    await this.channel.consume(queue, async (msg: amqplib.ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error('Message processing failed', { queue, error: (error as Error).message });
        this.channel!.nack(msg, false, !msg.fields.redelivered);
      }
    });
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      try { await this.channel.close(); } catch {}
      this.channel = null;
    }
    if (this.connection) {
      try { await this.connection.close(); } catch {}
      this.connection = null;
    }
    logger.info('Disconnected from RabbitMQ');
  }
}
