jest.mock('../../src/config', () => ({
  loadConfig: () => ({
    jwtSecret: 'test-secret-at-least-16-chars!!',
  }),
}));

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware } from '../../src/middleware/auth';

const TEST_SECRET = 'test-secret-at-least-16-chars!!';

const SAMPLE_PAYLOAD = {
  sub: 'user-123',
  tenant_id: 'tenant-abc',
  role: 'owner',
  jti: 'jti-xyz',
};

function makeToken(overrides: object = {}) {
  return jwt.sign({ ...SAMPLE_PAYLOAD, ...overrides }, TEST_SECRET, { expiresIn: '15m' });
}

function makeRedisMock(revokedJtis: string[] = []) {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      const jti = key.replace('jti:revoked:', '');
      return Promise.resolve(revokedJtis.includes(jti) ? '1' : null);
    }),
  };
}

function makeLogger() {
  return { error: jest.fn() } as any;
}

function makeApp(
  redisMock: any,
  tenantContext?: { tenantId: string; slug: string; status: string },
) {
  const app = express();
  app.use(express.json());

  // Simulate tenant-context middleware
  app.use((req, _res, next) => {
    if (tenantContext) {
      (req as any).tenantContext = tenantContext;
    }
    next();
  });

  const authMiddleware = createAuthMiddleware(redisMock, makeLogger());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ success: true, user: (req as any).user });
  });

  return app;
}

describe('createAuthMiddleware', () => {
  describe('Authorization header validation', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(makeApp(makeRedisMock())).get('/protected');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing or invalid/i);
    });

    it('returns 401 when Authorization header does not start with Bearer', async () => {
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', 'Basic abc123');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing or invalid/i);
    });
  });

  describe('JWT verification', () => {
    it('returns 401 for an expired token', async () => {
      const token = jwt.sign(SAMPLE_PAYLOAD, TEST_SECRET, { expiresIn: -1 });
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('returns 401 for a malformed token', async () => {
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', 'Bearer not.a.valid.token');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('returns 401 for a token signed with wrong secret', async () => {
      const token = jwt.sign(SAMPLE_PAYLOAD, 'completely-different-secret!!');
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });
  });

  describe('Redis revocation check', () => {
    it('returns 401 for a revoked token', async () => {
      const token = makeToken();
      const res = await request(makeApp(makeRedisMock(['jti-xyz'])))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/revoked/i);
    });

    it('returns 503 when Redis is unavailable', async () => {
      const brokenRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      };
      const token = makeToken();
      const res = await request(makeApp(brokenRedis))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
    });

    it('passes for a non-revoked token', async () => {
      const token = makeToken();
      const res = await request(makeApp(makeRedisMock([])))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Tenant cross-validation', () => {
    it('returns 403 when JWT tenant_id does not match tenant context', async () => {
      const tenantContext = { tenantId: 'tenant-different', slug: 'different', status: 'active' };
      const token = makeToken(); // tenant_id: 'tenant-abc'
      const res = await request(makeApp(makeRedisMock(), tenantContext))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/tenant mismatch/i);
    });

    it('passes when JWT tenant_id matches tenant context', async () => {
      const tenantContext = { tenantId: 'tenant-abc', slug: 'test', status: 'active' };
      const token = makeToken();
      const res = await request(makeApp(makeRedisMock(), tenantContext))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('passes when no tenant context is set', async () => {
      const token = makeToken();
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('req.user population', () => {
    it('sets req.user with correct fields on success', async () => {
      const token = makeToken();
      const res = await request(makeApp(makeRedisMock()))
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        sub: 'user-123',
        tenantId: 'tenant-abc',
        role: 'owner',
        jti: 'jti-xyz',
      });
    });
  });
});
