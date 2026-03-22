/**
 * Auth Service Tests
 *
 * Uses real DB (admin connection) for data persistence,
 * in-memory Redis mock (consistent with existing test patterns),
 * and mocked password module to avoid slow bcrypt in tests.
 */

jest.mock('../../../src/config', () => ({
  loadConfig: () => ({
    jwtSecret: 'test-secret-at-least-16-chars!!',
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: 'redis://localhost:6379',
    gatewayEncryptionKey: 'test-gateway-key-that-is-at-least-32-chars!!',
    logLevel: 'silent',
    resendApiKey: undefined,
  }),
}));

// Mock bcrypt to avoid slow hashing in tests
jest.mock('../../../src/lib/password', () => ({
  hashPassword: async (plain: string) => `hashed:${plain}`,
  comparePassword: async (plain: string, hash: string) => hash === `hashed:${plain}`,
}));

import { createTestDb, createTestLogger, insertTestTenant } from '../../helpers';
import type { Knex as KnexType } from 'knex';
import crypto from 'crypto';
import { createAuthService } from '../../../src/modules/auth/auth.service';
import { createEmailService } from '../../../src/lib/email';
import { verifyToken } from '../../../src/lib/jwt';
import { createUser, findUserById } from '../../../src/modules/auth/auth.repository';

// ─── In-memory Redis mock ─────────────────────────────────────────────────────
function makeRedisMock() {
  const store: Map<string, { value: string; expiresAt: number | null }> = new Map();

  const isExpired = (key: string) => {
    const entry = store.get(key);
    if (!entry) return true;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      store.delete(key);
      return true;
    }
    return false;
  };

  return {
    get: (key: string): Promise<string | null> => {
      if (isExpired(key)) return Promise.resolve(null);
      return Promise.resolve(store.get(key)!.value);
    },
    set: (key: string, value: string, ...args: any[]): Promise<'OK'> => {
      let expiresAt: number | null = null;
      for (let i = 0; i < args.length - 1; i++) {
        if (String(args[i]).toUpperCase() === 'EX') {
          expiresAt = Date.now() + Number(args[i + 1]) * 1000;
        }
      }
      store.set(key, { value, expiresAt });
      return Promise.resolve('OK');
    },
    del: (...keys: string[]): Promise<number> => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return Promise.resolve(count);
    },
    keys: (pattern: string): Promise<string[]> => {
      // Simple prefix match (strip trailing *)
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      const now = Date.now();
      const result: string[] = [];
      for (const [k, v] of store.entries()) {
        if (k.startsWith(prefix)) {
          if (v.expiresAt === null || now <= v.expiresAt) result.push(k);
        }
      }
      return Promise.resolve(result);
    },
    incr: (key: string): Promise<number> => {
      if (isExpired(key)) {
        store.set(key, { value: '1', expiresAt: null });
        return Promise.resolve(1);
      }
      const entry = store.get(key)!;
      const next = parseInt(entry.value, 10) + 1;
      entry.value = String(next);
      return Promise.resolve(next);
    },
    _store: store,
    _clear: () => store.clear(),
  };
}

describe('AuthService', () => {
  let db: KnexType;
  let redis: ReturnType<typeof makeRedisMock>;
  let service: ReturnType<typeof createAuthService>;
  let tenantId: string;
  let tenantSlug: string;

  beforeAll(async () => {
    db = createTestDb();
    redis = makeRedisMock();
    const logger = createTestLogger();
    const emailService = createEmailService({ resendApiKey: undefined });
    service = createAuthService({ db, redis: redis as any, logger, emailService });

    tenantSlug = `auth-svc-${Date.now()}`;
    const tenant = await insertTestTenant(db, {
      slug: tenantSlug,
      name: 'Auth Service Test Restaurant',
      status: 'pending',
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db('users').where({ tenant_id: tenantId }).delete();
    await db('tenants').where({ id: tenantId }).delete();
    await db.destroy();
  });

  afterEach(async () => {
    await db('users').where({ tenant_id: tenantId }).delete();
    redis._clear();
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a tenant and owner user, returns a token pair', async () => {
      const slug = `reg-new-${Date.now()}`;
      const email = `owner-${Date.now()}@newrestaurant.com`;
      let newTenantId: string | undefined;
      try {
        const result = await service.register({
          email,
          password: 'Password123!',
          name: 'New Restaurant',
          slug,
        });

        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();

        const payload = verifyToken(result.accessToken);
        expect(payload.role).toBe('owner');
        expect(payload.sub).toBeDefined();
        newTenantId = payload.tenant_id;
      } finally {
        if (newTenantId) {
          await db('users').where({ tenant_id: newTenantId }).delete();
          await db('tenants').where({ id: newTenantId }).delete();
        }
      }
    });

    it('stores an email verification token in Redis after register', async () => {
      const slug = `reg-verify-${Date.now()}`;
      let newTenantId: string | undefined;
      try {
        await service.register({
          email: 'verify@newrestaurant.com',
          password: 'Password123!',
          name: 'Verify Restaurant',
          slug,
        });

        const keys = await redis.keys('email:verify:*');
        expect(keys.length).toBe(1);
      } finally {
        const tenant = await db('tenants').where({ slug }).first();
        if (tenant) {
          newTenantId = tenant.id;
          await db('users').where({ tenant_id: newTenantId }).delete();
          await db('tenants').where({ id: newTenantId }).delete();
        }
      }
    });

    it('throws if slug is already taken', async () => {
      await expect(
        service.register({
          email: 'owner2@example.com',
          password: 'Password123!',
          name: 'Duplicate Slug',
          slug: tenantSlug,
        })
      ).rejects.toThrow(/slug.*taken|already.*exist|unavailable/i);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    beforeEach(async () => {
      await db.transaction((trx) =>
        createUser(trx, {
          email: 'login-user@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );
    });

    it('returns a token pair for valid credentials', async () => {
      const result = await service.login({
        email: 'login-user@example.com',
        password: 'Password123!',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const payload = verifyToken(result.accessToken);
      expect(payload.tenant_id).toBe(tenantId);
      expect(payload.role).toBe('owner');
    });

    it('throws for wrong password', async () => {
      await expect(
        service.login({ email: 'login-user@example.com', password: 'WrongPassword!' })
      ).rejects.toThrow(/invalid.*credentials|wrong.*password|unauthorized/i);
    });

    it('throws for non-existent email', async () => {
      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'Password123!' })
      ).rejects.toThrow(/invalid.*credentials|not.*found|unauthorized/i);
    });

    it('throws when account is locked out', async () => {
      await redis.set('lockout:locked:login-user@example.com', '1', 'EX', 1800);

      await expect(
        service.login({ email: 'login-user@example.com', password: 'Password123!' })
      ).rejects.toThrow(/locked|too.*many.*attempt/i);
    });

    it('records a failed attempt on wrong password', async () => {
      await service.login({ email: 'login-user@example.com', password: 'Bad!' }).catch(() => {});

      const keys = await redis.keys('lockout:attempts:*');
      expect(keys.length).toBeGreaterThan(0);
    });

    it('clears failed attempts on successful login', async () => {
      // Pre-plant a failed attempt
      await redis.set('lockout:attempts:login-user@example.com', '3', 'EX', 3600);

      await service.login({ email: 'login-user@example.com', password: 'Password123!' });

      const keys = await redis.keys('lockout:attempts:*');
      expect(keys.length).toBe(0);
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────

  describe('refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await db.transaction((trx) =>
        createUser(trx, {
          email: 'refresh-user@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );
      const tokens = await service.login({
        email: 'refresh-user@example.com',
        password: 'Password123!',
      });
      refreshToken = tokens.refreshToken;
    });

    it('returns a new token pair', async () => {
      const newTokens = await service.refresh({ refreshToken });

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.refreshToken).not.toBe(refreshToken);
    });

    it('revokes the old refresh token JTI', async () => {
      const oldPayload = verifyToken(refreshToken);
      await service.refresh({ refreshToken });

      const revoked = await redis.get(`jti:revoked:${oldPayload.jti}`);
      expect(revoked).not.toBeNull();
    });

    it('throws when refresh token is revoked', async () => {
      const payload = verifyToken(refreshToken);
      await redis.set(`jti:revoked:${payload.jti}`, '1', 'EX', 60);

      await expect(service.refresh({ refreshToken })).rejects.toThrow(/revoked|invalid|expired/i);
    });

    it('throws when refresh token is invalid', async () => {
      await expect(
        service.refresh({ refreshToken: 'invalid.token.here' })
      ).rejects.toThrow(/invalid|expired/i);
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the access token JTI', async () => {
      await db.transaction((trx) =>
        createUser(trx, {
          email: 'logout-user@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );
      const tokens = await service.login({
        email: 'logout-user@example.com',
        password: 'Password123!',
      });

      const payload = verifyToken(tokens.accessToken);
      await service.logout({ accessToken: tokens.accessToken });

      const revoked = await redis.get(`jti:revoked:${payload.jti}`);
      expect(revoked).not.toBeNull();
    });

    it('does not throw for an already-expired or invalid token', async () => {
      await expect(
        service.logout({ accessToken: 'invalid.token.here' })
      ).resolves.not.toThrow();
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('stores a reset token in Redis for valid email', async () => {
      const user = await db.transaction((trx) =>
        createUser(trx, {
          email: 'forgot-user@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );

      await service.forgotPassword({ email: 'forgot-user@example.com' });

      const keys = await redis.keys('pwd:reset:*');
      expect(keys.length).toBe(1);
      const storedUserId = await redis.get(keys[0]);
      expect(storedUserId).toBe(user.id);
    });

    it('does not throw for non-existent email (prevent user enumeration)', async () => {
      await expect(
        service.forgotPassword({ email: 'nobody@example.com' })
      ).resolves.not.toThrow();
    });

    it('does not store a Redis token for non-existent email', async () => {
      await service.forgotPassword({ email: 'ghost@example.com' });
      const keys = await redis.keys('pwd:reset:*');
      expect(keys.length).toBe(0);
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('updates the password when token is valid', async () => {
      const user = await db.transaction((trx) =>
        createUser(trx, {
          email: 'reset-user@example.com',
          passwordHash: 'hashed:OldPassword123!',
          role: 'owner',
          tenantId,
        })
      );

      const resetToken = crypto.randomBytes(32).toString('hex');
      await redis.set(`pwd:reset:${resetToken}`, user.id, 'EX', 3600);

      await service.resetPassword({ token: resetToken, password: 'NewPassword456!' });

      const updated = await db.transaction((trx) => findUserById(trx, user.id));
      expect(updated!.password_hash).toBe('hashed:NewPassword456!');
    });

    it('consumes the reset token after use', async () => {
      const user = await db.transaction((trx) =>
        createUser(trx, {
          email: 'reset-consume@example.com',
          passwordHash: 'hashed:OldPassword123!',
          role: 'owner',
          tenantId,
        })
      );

      const resetToken = crypto.randomBytes(32).toString('hex');
      await redis.set(`pwd:reset:${resetToken}`, user.id, 'EX', 3600);

      await service.resetPassword({ token: resetToken, password: 'NewPassword456!' });

      const remaining = await redis.get(`pwd:reset:${resetToken}`);
      expect(remaining).toBeNull();
    });

    it('throws for invalid or expired token', async () => {
      await expect(
        service.resetPassword({ token: 'nonexistent-token', password: 'NewPassword456!' })
      ).rejects.toThrow(/invalid|expired|not.*found/i);
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks the user email as verified when token is valid', async () => {
      const user = await db.transaction((trx) =>
        createUser(trx, {
          email: 'verify-email-user@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );

      const verifyTok = crypto.randomBytes(32).toString('hex');
      await redis.set(`email:verify:${verifyTok}`, user.id, 'EX', 86400);

      await service.verifyEmail({ token: verifyTok });

      const updated = await db.transaction((trx) => findUserById(trx, user.id));
      expect(updated!.email_verified_at).not.toBeNull();
    });

    it('consumes the verify token after use', async () => {
      const user = await db.transaction((trx) =>
        createUser(trx, {
          email: 'verify-consume@example.com',
          passwordHash: 'hashed:Password123!',
          role: 'owner',
          tenantId,
        })
      );

      const verifyTok = crypto.randomBytes(32).toString('hex');
      await redis.set(`email:verify:${verifyTok}`, user.id, 'EX', 86400);

      await service.verifyEmail({ token: verifyTok });

      const remaining = await redis.get(`email:verify:${verifyTok}`);
      expect(remaining).toBeNull();
    });

    it('throws for invalid or expired token', async () => {
      await expect(
        service.verifyEmail({ token: 'bad-token' })
      ).rejects.toThrow(/invalid|expired|not.*found/i);
    });
  });
});
