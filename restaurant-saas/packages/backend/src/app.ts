import express from 'express';
import type { Knex as KnexType } from 'knex';
import type Redis from 'ioredis';
import type pino from 'pino';
import { createTenantContextMiddleware } from './middleware/tenant-context';
import { createRequestLogger } from './middleware/request-logger';
import { createErrorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';

interface AppDependencies {
  db: KnexType;
  redis: Redis;
  logger: pino.Logger;
}

export function createApp({ db, redis, logger }: AppDependencies) {
  const app = express();

  app.use(express.json());
  app.use(createRequestLogger(logger));

  app.get('/health', async (_req, res) => {
    try {
      await db.raw('SELECT 1');
      await redis.ping();
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'unhealthy', error: 'Service dependency unavailable' });
    }
  });

  // Route-specific auth rate limiters (applied before tenant resolution)
  const loginLimiter = createRateLimiter(redis, { limit: 5, windowSeconds: 60, keyPrefix: 'rl:login' });
  const registerLimiter = createRateLimiter(redis, { limit: 3, windowSeconds: 60, keyPrefix: 'rl:register' });
  const forgotPasswordLimiter = createRateLimiter(redis, { limit: 3, windowSeconds: 60, keyPrefix: 'rl:forgotPassword' });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);

  // Global API rate limiter (100 req/min per IP)
  const apiLimiter = createRateLimiter(redis, { limit: 100, windowSeconds: 60, keyPrefix: 'rl:api' });
  app.use('/api', apiLimiter);

  app.use(createTenantContextMiddleware(db, redis, logger));

  app.use(createErrorHandler(logger));

  return app;
}
