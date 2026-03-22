import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middleware/rate-limiter';

// Minimal in-memory Redis mock
function makeRedisMock() {
  const store: Record<string, { value: number; expiresAt: number | null }> = {};

  const get = (key: string) => {
    const entry = store[key];
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      delete store[key];
      return Promise.resolve(null);
    }
    return Promise.resolve(String(entry.value));
  };

  const incr = async (key: string) => {
    const entry = store[key];
    if (!entry || (entry.expiresAt !== null && Date.now() > entry.expiresAt)) {
      store[key] = { value: 1, expiresAt: null };
      return 1;
    }
    store[key].value += 1;
    return store[key].value;
  };

  const expire = (key: string, seconds: number) => {
    if (store[key]) {
      store[key].expiresAt = Date.now() + seconds * 1000;
    }
    return Promise.resolve(1);
  };

  const del = (...keys: string[]) => {
    let count = 0;
    for (const k of keys) {
      if (store[k]) { delete store[k]; count++; }
    }
    return Promise.resolve(count);
  };

  const reset = () => { for (const k of Object.keys(store)) delete store[k]; };

  return { get, incr, expire, del, reset, _store: store };
}

function makeApp(limit: number, windowSeconds: number) {
  const redis = makeRedisMock();
  const app = express();
  const limiter = createRateLimiter(redis as any, { limit, windowSeconds, keyPrefix: 'rl:test' });
  app.get('/test', limiter, (_req, res) => res.json({ ok: true }));
  return { app, redis };
}

describe('createRateLimiter', () => {
  it('allows requests within the limit', async () => {
    const { app } = makeApp(3, 60);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test').set('X-Forwarded-For', '1.2.3.4');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when the limit is exceeded', async () => {
    const { app } = makeApp(3, 60);

    for (let i = 0; i < 3; i++) {
      await request(app).get('/test').set('X-Forwarded-For', '5.6.7.8');
    }

    const res = await request(app).get('/test').set('X-Forwarded-For', '5.6.7.8');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many requests/i);
  });

  it('includes X-RateLimit-Remaining header', async () => {
    const { app } = makeApp(5, 60);

    const res = await request(app).get('/test').set('X-Forwarded-For', '9.9.9.9');
    expect(res.status).toBe(200);
    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(4);
  });

  it('includes Retry-After header on 429 response', async () => {
    const { app } = makeApp(1, 60);

    await request(app).get('/test').set('X-Forwarded-For', '10.0.0.1');
    const res = await request(app).get('/test').set('X-Forwarded-For', '10.0.0.1');

    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('tracks limits independently per IP', async () => {
    const { app } = makeApp(2, 60);

    // IP-A hits limit
    await request(app).get('/test').set('X-Forwarded-For', '11.0.0.1');
    await request(app).get('/test').set('X-Forwarded-For', '11.0.0.1');
    const resA = await request(app).get('/test').set('X-Forwarded-For', '11.0.0.1');
    expect(resA.status).toBe(429);

    // IP-B is unaffected
    const resB = await request(app).get('/test').set('X-Forwarded-For', '11.0.0.2');
    expect(resB.status).toBe(200);
  });
});
