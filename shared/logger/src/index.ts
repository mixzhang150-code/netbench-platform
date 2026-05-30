import winston from 'winston';
import { mkdirSync } from 'fs';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, service, ...meta }) => {
  const serviceTag = service ? `[${service}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level} ${serviceTag} ${message}${metaStr}`;
});

export function createLogger(service: string) {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), logFormat)
    }),
  ];

  if (process.env.NODE_ENV !== 'production') {
    try {
      mkdirSync('logs', { recursive: true });
      transports.push(
        new winston.transports.File({
          filename: `logs/${service}-error.log`,
          level: 'error',
          maxsize: 10485760,
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: `logs/${service}-combined.log`,
          maxsize: 10485760,
          maxFiles: 10
        })
      );
    } catch {}
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      logFormat
    ),
    defaultMeta: { service },
    transports,
  });
}

export type Logger = ReturnType<typeof createLogger>;
