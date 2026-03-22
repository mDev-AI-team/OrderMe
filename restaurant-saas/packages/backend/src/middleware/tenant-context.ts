import type { Request, Response, NextFunction } from 'express';
import type { Knex as KnexType } from 'knex';
import type Redis from 'ioredis';
import type pino from 'pino';
import type { TenantContext } from '@restaurant-saas/shared';
import { asyncContext } from '../lib/async-context';
import crypto from 'crypto';

const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;
const TENANT_CACHE_TTL = 300;

interface TenantRow {
  id: string;
  slug: string;
  status: string;
}

export function createTenantContextMiddleware(
  db: KnexType,
  redis: Redis,
  logger: pino.Logger,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path === '/health') {
      return next();
    }

    const host = req.hostname;
    const parts = host.split('.');
    if (parts.length < 2) {
      res.status(400).json({ success: false, error: 'Invalid host' });
      return;
    }

    const slug = parts[0];
    if (!SLUG_REGEX.test(slug)) {
      res.status(400).json({ success: false, error: 'Invalid subdomain' });
      return;
    }

    try {
      const cacheKey = `tenant:slug:${slug}`;
      const cached = await redis.get(cacheKey);
      let tenant: TenantRow;

      if (cached) {
        tenant = JSON.parse(cached);
      } else {
        const row = await db('tenants')
          .select('id', 'slug', 'status')
          .where('slug', slug)
          .first();

        if (!row) {
          res.status(404).json({ success: false, error: 'Restaurant not found' });
          return;
        }

        tenant = row;
        await redis.set(cacheKey, JSON.stringify(tenant), 'EX', TENANT_CACHE_TTL);
      }

      if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
        res.status(403).json({ success: false, error: 'Restaurant temporarily unavailable' });
        return;
      }

      if (tenant.status === 'pending') {
        const isOnboardingRoute = req.path.startsWith('/api/onboarding');
        if (!isOnboardingRoute) {
          res.status(403).json({ success: false, error: 'Restaurant not yet active' });
          return;
        }
      }

      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        slug: tenant.slug,
        status: tenant.status as any,
      };

      (req as any).tenantContext = tenantContext;

      asyncContext.run(
        { tenant: tenantContext, requestId: (req as any).id || crypto.randomUUID() },
        () => next(),
      );
    } catch (err) {
      logger.error({ err, slug }, 'Tenant resolution failed');
      next(err);
    }
  };
}
