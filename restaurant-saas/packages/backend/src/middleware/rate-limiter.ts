import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

export interface RateLimiterOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
}

export function createRateLimiter(redis: Redis, options: RateLimiterOptions) {
  const { limit, windowSeconds, keyPrefix } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const key = `${keyPrefix}:${ip}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - count);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (count > limit) {
      res.setHeader('Retry-After', windowSeconds);
      res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
      return;
    }

    next();
  };
}
