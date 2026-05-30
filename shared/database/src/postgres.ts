import { Pool, PoolConfig, QueryResult } from 'pg';
import { createLogger } from '@netbench/logger';

const logger = createLogger('postgres');

export class PostgresClient {
  private pool: Pool;

  constructor(config?: PoolConfig) {
    this.pool = new Pool(config || {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected pool error', { error: err.message });
    });
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', { query: text.substring(0, 100), duration });
    }

    return result;
  }

  async transaction<T>(callback: (client: { query: <R extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<R>> }) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback({
        query: (text, params) => client.query(text, params)
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL connection pool closed');
  }
}
