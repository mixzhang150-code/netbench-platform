import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { createLogger } from '@netbench/logger';

const logger = createLogger('influx');

export class InfluxClient {
  private influxDB: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;

  constructor() {
    const url = process.env.INFLUX_URL || 'http://localhost:8086';
    const token = process.env.INFLUX_TOKEN || '';
    const org = process.env.INFLUX_ORG || 'netbench';
    const bucket = process.env.INFLUX_BUCKET || 'test_results';

    this.influxDB = new InfluxDB({ url, token });
    this.writeApi = this.influxDB.getWriteApi(org, bucket, 'ms', {
      batchSize: 1000,
      flushInterval: 5000,
      maxRetries: 3,
    });
    this.queryApi = this.influxDB.getQueryApi(org);
  }

  writePoint(point: Point): void {
    this.writeApi.writePoint(point);
  }

  writePoints(points: Point[]): void {
    this.writeApi.writePoints(points);
  }

  async flush(): Promise<void> {
    try {
      await this.writeApi.flush();
    } catch (error) {
      logger.error('Failed to flush InfluxDB points', { error: (error as Error).message });
    }
  }

  async query<T>(fluxQuery: string): Promise<T[]> {
    const results: T[] = [];

    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const values = tableMeta.toObject(row);
          results.push(values as T);
        },
        error(error) {
          logger.error('InfluxDB query error', { error: error.message });
          reject(error);
        },
        complete() {
          resolve(results);
        },
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('from(bucket: "test_results") |> range(start: -1s) |> limit(n: 1)');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.writeApi.close();
    logger.info('InfluxDB connection closed');
  }
}
