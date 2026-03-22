import crypto from 'crypto';
import type { Knex } from 'knex';
import type Redis from 'ioredis';
import type pino from 'pino';
import type { EmailService } from '../../lib/email';
import { hashPassword, comparePassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyToken, generateJti } from '../../lib/jwt';
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from '../../lib/account-lockout';
import {
  findUserByEmail,
  createUser,
  findUserById,
  updateEmailVerified,
  updatePassword,
} from './auth.repository';
import { createTenant, isSlugAvailable } from '../tenant/tenant.repository';
import type { TokenPair } from './auth.types';

// Redis key prefixes
const REVOKED_KEY_PREFIX = 'jti:revoked:';
const EMAIL_VERIFY_PREFIX = 'email:verify:';
const PASSWORD_RESET_PREFIX = 'pwd:reset:';

// Token TTLs (seconds) — must match lib/jwt.ts values
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;       // 15 min
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const EMAIL_VERIFY_TTL_SECONDS = 24 * 3600;       // 24 hours
const PASSWORD_RESET_TTL_SECONDS = 3600;           // 1 hour

interface ServiceDeps {
  db: Knex;
  redis: Redis;
  logger: pino.Logger;
  emailService: EmailService;
}

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  slug: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RefreshInput {
  refreshToken: string;
}

interface LogoutInput {
  accessToken: string;
}

interface ForgotPasswordInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  password: string;
}

interface VerifyEmailInput {
  token: string;
}

export function createAuthService(deps: ServiceDeps) {
  const { db, redis, logger, emailService } = deps;

  async function register(input: RegisterInput): Promise<TokenPair> {
    const slugAvailable = await db.transaction((trx) =>
      isSlugAvailable(trx, input.slug)
    );
    if (!slugAvailable) {
      throw new Error('Slug is already taken — please choose a different subdomain.');
    }

    const result = await db.transaction(async (trx) => {
      const tenant = await createTenant(trx, {
        name: input.name,
        slug: input.slug,
        baseDomain: `${input.slug}.restaurant-saas.com`,
      });

      const passwordHash = await hashPassword(input.password);
      const user = await createUser(trx, {
        email: input.email,
        passwordHash,
        role: 'owner',
        tenantId: tenant.id,
      });

      return { tenant, user };
    });

    const jti = generateJti();
    const payload = {
      sub: result.user.id,
      tenant_id: result.tenant.id,
      role: result.user.role,
      jti,
    };

    const accessToken = signAccessToken(payload);
    const refreshJti = generateJti();
    const refreshToken = signRefreshToken({ ...payload, jti: refreshJti });

    // Send verification email (non-blocking — failure should not abort registration)
    const verifyTokenValue = crypto.randomBytes(32).toString('hex');
    await redis.set(
      `${EMAIL_VERIFY_PREFIX}${verifyTokenValue}`,
      result.user.id,
      'EX',
      EMAIL_VERIFY_TTL_SECONDS
    );
    emailService.sendVerificationEmail(result.user.email, verifyTokenValue).catch((err) => {
      logger.error({ err }, 'Failed to send verification email');
    });

    return { accessToken, refreshToken };
  }

  async function login(input: LoginInput): Promise<TokenPair> {
    const locked = await isAccountLocked(redis, input.email);
    if (locked) {
      throw new Error('Account is locked due to too many failed login attempts. Try again later.');
    }

    const user = await db.transaction((trx) => findUserByEmail(trx, input.email));
    if (!user) {
      // Record failed attempt even for non-existent users to prevent timing attacks
      await recordFailedAttempt(redis, input.email);
      throw new Error('Invalid credentials.');
    }

    const passwordMatches = await comparePassword(input.password, user.password_hash);
    if (!passwordMatches) {
      await recordFailedAttempt(redis, input.email);
      throw new Error('Invalid credentials.');
    }

    await clearFailedAttempts(redis, input.email);

    const jti = generateJti();
    const payload = {
      sub: user.id,
      tenant_id: user.tenant_id!,
      role: user.role,
      jti,
    };

    const accessToken = signAccessToken(payload);
    const refreshJti = generateJti();
    const refreshToken = signRefreshToken({ ...payload, jti: refreshJti });

    return { accessToken, refreshToken };
  }

  async function refresh(input: RefreshInput): Promise<TokenPair> {
    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(input.refreshToken);
    } catch {
      throw new Error('Invalid or expired refresh token.');
    }

    // Check if this refresh token's JTI is revoked
    const revoked = await redis.get(`${REVOKED_KEY_PREFIX}${payload.jti}`);
    if (revoked !== null) {
      throw new Error('Refresh token has been revoked.');
    }

    // Revoke the old refresh token JTI
    await redis.set(
      `${REVOKED_KEY_PREFIX}${payload.jti}`,
      '1',
      'EX',
      REFRESH_TOKEN_TTL_SECONDS
    );

    // Issue a new token pair
    const newJti = generateJti();
    const newPayload = {
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      role: payload.role,
      jti: newJti,
    };
    const accessToken = signAccessToken(newPayload);
    const newRefreshJti = generateJti();
    const refreshToken = signRefreshToken({ ...newPayload, jti: newRefreshJti });

    return { accessToken, refreshToken };
  }

  async function logout(input: LogoutInput): Promise<void> {
    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(input.accessToken);
    } catch {
      // Already invalid — nothing to revoke
      return;
    }

    await redis.set(
      `${REVOKED_KEY_PREFIX}${payload.jti}`,
      '1',
      'EX',
      ACCESS_TOKEN_TTL_SECONDS
    );
  }

  async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await db.transaction((trx) => findUserByEmail(trx, input.email));
    if (!user) {
      // Silently return to prevent user enumeration
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await redis.set(
      `${PASSWORD_RESET_PREFIX}${resetToken}`,
      user.id,
      'EX',
      PASSWORD_RESET_TTL_SECONDS
    );

    emailService.sendPasswordResetEmail(user.email, resetToken).catch((err) => {
      logger.error({ err }, 'Failed to send password reset email');
    });
  }

  async function resetPassword(input: ResetPasswordInput): Promise<void> {
    const userId = await redis.get(`${PASSWORD_RESET_PREFIX}${input.token}`);
    if (!userId) {
      throw new Error('Invalid or expired password reset token.');
    }

    const newPasswordHash = await hashPassword(input.password);
    await db.transaction((trx) => updatePassword(trx, userId, newPasswordHash));

    // Consume the token
    await redis.del(`${PASSWORD_RESET_PREFIX}${input.token}`);
  }

  async function verifyEmail(input: VerifyEmailInput): Promise<void> {
    const userId = await redis.get(`${EMAIL_VERIFY_PREFIX}${input.token}`);
    if (!userId) {
      throw new Error('Invalid or expired email verification token.');
    }

    await db.transaction((trx) => updateEmailVerified(trx, userId));

    // Consume the token
    await redis.del(`${EMAIL_VERIFY_PREFIX}${input.token}`);
  }

  return { register, login, refresh, logout, forgotPassword, resetPassword, verifyEmail };
}
