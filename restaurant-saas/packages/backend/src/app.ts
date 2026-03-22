import express from 'express';
import type { Knex as KnexType } from 'knex';
import type Redis from 'ioredis';
import type pino from 'pino';
import { createTenantContextMiddleware } from './middleware/tenant-context';
import { createRequestLogger } from './middleware/request-logger';
import { createErrorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';
import { createEmailService } from './lib/email';
import { createAuthService } from './modules/auth/auth.service';
import { createAuthRouter } from './modules/auth/auth.router';
import { loadConfig } from './config';

interface AppDependencies {
  db: KnexType;
  redis: Redis;
  logger: pino.Logger;
}

export function createApp({ db, redis, logger }: AppDependencies) {
  const app = express();
  const config = loadConfig();

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
  const loginLimiter = createRateLimiter(redis, {
    limit: 5,
    windowSeconds: 60,
    keyPrefix: 'rl:login',
    keyExtractor: (req) => (req.body?.email as string | undefined) ?? req.ip ?? 'unknown',
  });
  const registerLimiter = createRateLimiter(redis, { limit: 3, windowSeconds: 60, keyPrefix: 'rl:register' });
  const forgotPasswordLimiter = createRateLimiter(redis, { limit: 3, windowSeconds: 60, keyPrefix: 'rl:forgotPassword' });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);

  // Global API rate limiter (100 req/min per IP)
  const apiLimiter = createRateLimiter(redis, { limit: 100, windowSeconds: 60, keyPrefix: 'rl:api' });
  app.use('/api', apiLimiter);

  // Auth routes (no tenant context required — register creates the tenant)
  const emailService = createEmailService({ resendApiKey: config.resendApiKey });
  const authService = createAuthService({ db, redis, logger, emailService });
  app.use('/api/auth', createAuthRouter(authService));

  app.use(createTenantContextMiddleware(db, redis, logger));

  app.use(createErrorHandler(logger));

  return app;
}
