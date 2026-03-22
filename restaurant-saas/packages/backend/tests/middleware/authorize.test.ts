jest.mock('../../src/config', () => ({
  loadConfig: () => ({
    jwtSecret: 'test-secret-at-least-16-chars!!',
  }),
}));

import express from 'express';
import request from 'supertest';
import { authorize } from '../../src/middleware/auth';
import type { AuthenticatedUser } from '../../src/middleware/auth';

function makeApp(allowedRoles: string[], user?: Partial<AuthenticatedUser>) {
  const app = express();
  app.use(express.json());

  // Simulate auth middleware setting req.user
  app.use((req, _res, next) => {
    if (user !== undefined) {
      (req as any).user = { sub: 'user-1', tenantId: 'tenant-1', jti: 'jti-1', ...user };
    }
    next();
  });

  app.get('/resource', authorize(...(allowedRoles as any[])), (_req, res) => {
    res.json({ success: true });
  });

  return app;
}

describe('authorize', () => {
  describe('unauthenticated requests', () => {
    it('returns 401 when req.user is not set', async () => {
      const res = await request(makeApp(['owner'])).get('/resource');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });
  });

  describe('role authorization', () => {
    it('returns 403 when user role is not in allowedRoles', async () => {
      const res = await request(makeApp(['owner'], { role: 'staff' })).get('/resource');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden/i);
    });

    it('passes when user role matches an allowed role', async () => {
      const res = await request(makeApp(['owner', 'manager'], { role: 'manager' })).get('/resource');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('passes when user role is the only allowed role', async () => {
      const res = await request(makeApp(['owner'], { role: 'owner' })).get('/resource');
      expect(res.status).toBe(200);
    });

    it('returns 403 when allowedRoles is empty', async () => {
      const res = await request(makeApp([], { role: 'owner' })).get('/resource');
      expect(res.status).toBe(403);
    });
  });

  describe('super_admin bypass', () => {
    it('always passes for super_admin regardless of allowedRoles', async () => {
      const res = await request(makeApp(['owner'], { role: 'super_admin' })).get('/resource');
      expect(res.status).toBe(200);
    });

    it('passes for super_admin even when allowedRoles is empty', async () => {
      const res = await request(makeApp([], { role: 'super_admin' })).get('/resource');
      expect(res.status).toBe(200);
    });

    it('passes for super_admin when role is in allowedRoles too', async () => {
      const res = await request(makeApp(['super_admin', 'owner'], { role: 'super_admin' })).get('/resource');
      expect(res.status).toBe(200);
    });
  });
});
