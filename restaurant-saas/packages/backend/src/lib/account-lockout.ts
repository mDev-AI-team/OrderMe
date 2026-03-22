import type Redis from 'ioredis';

export const LOCKOUT_THRESHOLD = 10;
const ATTEMPTS_KEY_PREFIX = 'lockout:attempts:';
const LOCKED_KEY_PREFIX = 'lockout:locked:';
const ATTEMPTS_TTL_SECONDS = 3600; // 1 hour window for counting attempts
const LOCKOUT_TTL_SECONDS = 1800;  // 30-minute lockout

function attemptsKey(identifier: string): string {
  return `${ATTEMPTS_KEY_PREFIX}${identifier}`;
}

function lockedKey(identifier: string): string {
  return `${LOCKED_KEY_PREFIX}${identifier}`;
}

export async function isAccountLocked(redis: Redis, identifier: string): Promise<boolean> {
  const val = await redis.get(lockedKey(identifier));
  return val !== null;
}

export async function recordFailedAttempt(redis: Redis, identifier: string): Promise<number> {
  const key = attemptsKey(identifier);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.set(key, String(count), 'EX', ATTEMPTS_TTL_SECONDS);
  }
  if (count >= LOCKOUT_THRESHOLD) {
    await redis.set(lockedKey(identifier), '1', 'EX', LOCKOUT_TTL_SECONDS);
  }
  return count;
}

export async function clearFailedAttempts(redis: Redis, identifier: string): Promise<void> {
  await redis.del(attemptsKey(identifier), lockedKey(identifier));
}
