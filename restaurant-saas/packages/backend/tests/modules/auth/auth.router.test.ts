/**
 * Auth Router Integration Tests
 *
 * Tests HTTP layer: request validation, response shape, status codes.
 * Mocks the auth service to keep tests fast and focused on HTTP behavior.
 */

jest.mock('../../../src/config', () => ({
  loadConfig: () => ({
    jwtSecret: 'test-secret-at-least-16-chars!!',
    nodeEnv: 'test',
  }),
}));

import express from 'express';
import request from 'supertest';
import { createAuthRouter } from '../../../src/modules/auth/auth.router';

// ─── Service mock factory ──────────────────────────────────────────────────────

function makeServiceMock(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    register: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' }),
    login: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'acc2', refreshToken: 'ref2' }),
    logout: jest.fn().mockResolvedValue(undefined),
    forgotPassword: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    verifyEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeApp(service: ReturnType<typeof makeServiceMock>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(service as any));
  // Simple error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ success: false, error: err.message ?? 'Internal error' });
  });
  return app;
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 with token pair on valid input', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Password1!', name: 'Restaurant', slug: 'my-resto' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('acc');
    expect(res.body.data.refreshToken).toBe('ref');
    expect(service.register).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'Password1!',
      name: 'Restaurant',
      slug: 'my-resto',
    });
  });

  it('returns 422 when email is missing', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password1!', name: 'Restaurant', slug: 'my-resto' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 when slug is invalid format', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Password1!', name: 'Resto', slug: 'INVALID SLUG!' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when password is too short', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'short', name: 'Resto', slug: 'my-resto' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when service throws slug-taken error', async () => {
    const service = makeServiceMock({
      register: jest.fn().mockRejectedValue(new Error('Slug is already taken')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Password1!', name: 'Resto', slug: 'taken' });

    expect(res.status).toBe(409);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 with token pair on valid credentials', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('acc');
  });

  it('returns 422 for missing email', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password1!' });
    expect(res.status).toBe(422);
  });

  it('returns 401 when service throws invalid credentials', async () => {
    const service = makeServiceMock({
      login: jest.fn().mockRejectedValue(new Error('Invalid credentials.')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 423 when account is locked', async () => {
    const service = makeServiceMock({
      login: jest.fn().mockRejectedValue(new Error('Account is locked')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Password1!' });

    expect(res.status).toBe(423);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns 200 with new token pair', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('acc2');
    expect(service.refresh).toHaveBeenCalledWith({ refreshToken: 'some-token' });
  });

  it('returns 422 when refreshToken is missing', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(422);
  });

  it('returns 401 when token is revoked or invalid', async () => {
    const service = makeServiceMock({
      refresh: jest.fn().mockRejectedValue(new Error('Refresh token has been revoked.')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'revoked-token' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 204 on success', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ accessToken: 'some-access-token' });

    expect(res.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith({ accessToken: 'some-access-token' });
  });

  it('returns 422 when accessToken is missing', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 204 for valid email', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(204);
    expect(service.forgotPassword).toHaveBeenCalledWith({ email: 'a@b.com' });
  });

  it('returns 422 for invalid email', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 204 on success', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'tok', password: 'NewPass123!' });

    expect(res.status).toBe(204);
    expect(service.resetPassword).toHaveBeenCalledWith({ token: 'tok', password: 'NewPass123!' });
  });

  it('returns 422 when token is missing', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: 'NewPass123!' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when password is too short', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'tok', password: 'short' });
    expect(res.status).toBe(422);
  });

  it('returns 400 when token is invalid or expired', async () => {
    const service = makeServiceMock({
      resetPassword: jest.fn().mockRejectedValue(new Error('Invalid or expired password reset token.')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad', password: 'NewPass123!' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

describe('POST /api/auth/verify-email', () => {
  it('returns 204 on success', async () => {
    const service = makeServiceMock();
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'verify-tok' });

    expect(res.status).toBe(204);
    expect(service.verifyEmail).toHaveBeenCalledWith({ token: 'verify-tok' });
  });

  it('returns 422 when token is missing', async () => {
    const app = makeApp(makeServiceMock());
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(422);
  });

  it('returns 400 when token is invalid or expired', async () => {
    const service = makeServiceMock({
      verifyEmail: jest.fn().mockRejectedValue(new Error('Invalid or expired email verification token.')),
    });
    const app = makeApp(service);

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'bad' });

    expect(res.status).toBe(400);
  });
});
