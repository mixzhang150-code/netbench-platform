import express from 'express';
import { createLogger } from '@netbench/logger';
import { User, UserPreferences } from '@netbench/types';
import { PostgresClient, RedisClient } from '@netbench/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('user-service');
const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_key';
const JWT_EXPIRY = '24h';

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultPingCount: 4,
  defaultTimeout: 5000,
  defaultHttpMethod: 'GET',
  theme: 'auto',
  notifications: true,
};

let db: PostgresClient;
let redis: RedisClient;

async function waitForDependencies() {
  const maxRetries = 30;

  db = new PostgresClient({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  for (let i = 1; i <= maxRetries; i++) {
    try {
      if (await db.healthCheck()) {
        logger.info('PostgreSQL connected');
        break;
      }
    } catch {}
    logger.warn(`Waiting for PostgreSQL... (${i}/${maxRetries})`);
    await new Promise(r => setTimeout(r, 2000));
  }

  redis = new RedisClient(process.env.REDIS_URL);

  for (let i = 1; i <= maxRetries; i++) {
    try {
      if (await redis.healthCheck()) {
        logger.info('Redis connected');
        break;
      }
    } catch {}
    logger.warn(`Waiting for Redis... (${i}/${maxRetries})`);
    await new Promise(r => setTimeout(r, 2000));
  }

  app.get('/health', (_req, res) => {
    res.json({
      service: 'user-service',
      status: 'healthy',
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  app.post('/api/register', async (req, res) => {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Username, email, and password are required' },
        });
        return;
      }

      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: 'Username or email already exists' },
        });
        return;
      }

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();
      const userRole = role === 'sponsor' ? 'sponsor' : 'user';

      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role, preferences, created_at, last_login)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, username, email, passwordHash, userRole, JSON.stringify(DEFAULT_PREFERENCES), now, now]);

      const token = jwt.sign(
        { userId: id, username, role: userRole },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      logger.info('User registered', { userId: id, username, role: userRole });

      res.status(201).json({
        success: true,
        data: {
          id,
          username,
          email,
          role: userRole,
          token,
        },
      });
    } catch (error) {
      logger.error('Registration failed', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: { code: 'REGISTRATION_ERROR', message: (error as Error).message },
      });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Username and password are required' },
        });
        return;
      }

      const result = await db.query<{
        id: string; username: string; email: string; password_hash: string; role: string;
      }>('SELECT id, username, email, password_hash, role FROM users WHERE username = $1', [username]);

      if (result.rows.length === 0) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
        });
        return;
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
        });
        return;
      }

      await db.query('UPDATE users SET last_login = $1 WHERE id = $2', [new Date().toISOString(), user.id]);

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          token,
        },
      });
    } catch (error) {
      logger.error('Login failed', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: { code: 'LOGIN_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/profile', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
        return;
      }

      const cached = await redis.get(`user:${userId}`);
      if (cached) {
        res.json({ success: true, data: JSON.parse(cached) });
        return;
      }

      const result = await db.query<{
        id: string; username: string; email: string; role: string;
        preferences: string; created_at: string; last_login: string;
      }>('SELECT id, username, email, role, preferences, created_at, last_login FROM users WHERE id = $1', [userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      const row = result.rows[0];
      const profile = {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences,
        createdAt: row.created_at,
        lastLogin: row.last_login,
      };

      await redis.set(`user:${userId}`, JSON.stringify(profile), 300);

      res.json({ success: true, data: profile });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'PROFILE_ERROR', message: (error as Error).message },
      });
    }
  });

  app.put('/api/profile', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { email, preferences } = req.body;

      if (email) {
        await db.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
      }

      if (preferences) {
        await db.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(preferences), userId]);
      }

      await redis.del(`user:${userId}`);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: (error as Error).message },
      });
    }
  });

  app.put('/api/password', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { currentPassword, newPassword } = req.body;

      const result = await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!validPassword) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        });
        return;
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'PASSWORD_ERROR', message: (error as Error).message },
      });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const countResult = await db.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM users');
      const result = await db.query<{
        id: string; username: string; email: string; role: string; created_at: string;
      }>(
        'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.json({
        success: true,
        data: result.rows.map(r => ({
          id: r.id,
          username: r.username,
          email: r.email,
          role: r.role,
          createdAt: r.created_at,
        })),
        meta: { page, limit, total: countResult.rows[0].total },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'LIST_ERROR', message: (error as Error).message },
      });
    }
  });

  app.put('/api/users/:id/role', async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ['admin', 'sponsor', 'user'];

      if (!validRoles.includes(role)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROLE', message: `Role must be one of: ${validRoles.join(', ')}` },
        });
        return;
      }

      await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);

      logger.info('User role updated', { userId: req.params.id, newRole: role });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'ROLE_UPDATE_ERROR', message: (error as Error).message },
      });
    }
  });

  const PORT = process.env.PORT || 3005;

  app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down');
    await redis.close();
    await db.close();
    process.exit(0);
  });
}

waitForDependencies().catch((err) => {
  logger.error('Failed to start service', { error: (err as Error).message });
  process.exit(1);
});
