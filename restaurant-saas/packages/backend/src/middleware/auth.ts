import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';
import type pino from 'pino';
import { verifyToken } from '../lib/jwt';
import type { TenantContext, UserRole } from '@restaurant-saas/shared';

export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  role: string;
  jti: string;
}

const REVOKED_KEY_PREFIX = 'jti:revoked:';

export function createAuthMiddleware(redis: Redis, logger: pino.Logger) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    try {
      const revoked = await redis.get(`${REVOKED_KEY_PREFIX}${payload.jti}`);
      if (revoked !== null) {
        res.status(401).json({ success: false, error: 'Token has been revoked' });
        return;
      }
    } catch (err) {
      logger.error({ err }, 'Redis revocation check failed');
      res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
      return;
    }

    const tenantContext = (req as any).tenantContext as TenantContext | undefined;
    if (tenantContext && payload.tenant_id !== tenantContext.tenantId) {
      res.status(403).json({ success: false, error: 'Token tenant mismatch' });
      return;
    }

    (req as any).user = {
      sub: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
      jti: payload.jti,
    } satisfies AuthenticatedUser;

    next();
  };
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (user.role === 'super_admin' || allowedRoles.includes(user.role as UserRole)) {
      next();
      return;
    }

    res.status(403).json({ success: false, error: 'Forbidden' });
  };
}
