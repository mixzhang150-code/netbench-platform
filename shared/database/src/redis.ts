import Redis from 'ioredis';
import { createLogger } from '@netbench/logger';

const logger = createLogger('redis');

export class RedisClient {
  private client: Redis;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  constructor(url?: string) {
    const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 5000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });
  }

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
    }
    return this.subscriber;
  }

  private getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = this.client.duplicate();
    }
    return this.publisher;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const sub = this.getSubscriber();
    await sub.subscribe(channel);
    sub.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.getPublisher().publish(channel, message);
  }

  async acquireLock(lockKey: string, ttlMs: number = 10000): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const result = await this.client.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(lockKey: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, lockKey, token);
    return result === 1;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.subscriber?.quit();
    await this.publisher?.quit();
    await this.client.quit();
    logger.info('Redis connections closed');
  }
}
