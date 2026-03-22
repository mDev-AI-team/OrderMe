import {
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  LOCKOUT_THRESHOLD,
} from '../../src/lib/account-lockout';

function makeRedisMock() {
  const store: Record<string, { value: string; expiresAt: number | null }> = {};

  const get = (key: string): Promise<string | null> => {
    const entry = store[key];
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      delete store[key];
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  };

  const incr = async (key: string): Promise<number> => {
    const entry = store[key];
    if (!entry || (entry.expiresAt !== null && Date.now() > entry.expiresAt)) {
      store[key] = { value: '1', expiresAt: null };
      return 1;
    }
    const next = parseInt(entry.value, 10) + 1;
    store[key].value = String(next);
    return next;
  };

  const set = (key: string, value: string, ...args: any[]): Promise<'OK'> => {
    let expiresAt: number | null = null;
    // Handle SET key value EX seconds
    for (let i = 0; i < args.length - 1; i++) {
      if (String(args[i]).toUpperCase() === 'EX') {
        expiresAt = Date.now() + Number(args[i + 1]) * 1000;
      }
    }
    store[key] = { value, expiresAt };
    return Promise.resolve('OK');
  };

  const del = (...keys: string[]): Promise<number> => {
    let count = 0;
    for (const k of keys) {
      if (store[k]) { delete store[k]; count++; }
    }
    return Promise.resolve(count);
  };

  const reset = () => { for (const k of Object.keys(store)) delete store[k]; };

  return { get, incr, set, del, reset, _store: store };
}

describe('isAccountLocked', () => {
  it('returns false for an account with no failed attempts', async () => {
    const redis = makeRedisMock();
    const locked = await isAccountLocked(redis as any, 'user@example.com');
    expect(locked).toBe(false);
  });

  it('returns true when the account lockout key exists', async () => {
    const redis = makeRedisMock();
    await redis.set('lockout:locked:user@example.com', '1', 'EX', 900);
    const locked = await isAccountLocked(redis as any, 'user@example.com');
    expect(locked).toBe(true);
  });
});

describe('recordFailedAttempt', () => {
  it('returns the incremented attempt count', async () => {
    const redis = makeRedisMock();
    const count = await recordFailedAttempt(redis as any, 'user@example.com');
    expect(count).toBe(1);
  });

  it('accumulates consecutive failures', async () => {
    const redis = makeRedisMock();
    for (let i = 1; i <= 5; i++) {
      const count = await recordFailedAttempt(redis as any, 'repeat@example.com');
      expect(count).toBe(i);
    }
  });

  it(`locks the account after ${LOCKOUT_THRESHOLD} failures`, async () => {
    const redis = makeRedisMock();
    const email = 'lockme@example.com';

    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await recordFailedAttempt(redis as any, email);
    }

    const locked = await isAccountLocked(redis as any, email);
    expect(locked).toBe(true);
  });

  it('does not lock the account before threshold is reached', async () => {
    const redis = makeRedisMock();
    const email = 'notyet@example.com';

    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) {
      await recordFailedAttempt(redis as any, email);
    }

    const locked = await isAccountLocked(redis as any, email);
    expect(locked).toBe(false);
  });
});

describe('clearFailedAttempts', () => {
  it('resets the failure count', async () => {
    const redis = makeRedisMock();
    const email = 'clear@example.com';

    await recordFailedAttempt(redis as any, email);
    await recordFailedAttempt(redis as any, email);
    await clearFailedAttempts(redis as any, email);

    // Attempt count key should be gone; next incr should return 1
    const count = await recordFailedAttempt(redis as any, email);
    expect(count).toBe(1);
  });

  it('removes the lockout key', async () => {
    const redis = makeRedisMock();
    const email = 'unlock@example.com';

    await redis.set('lockout:locked:' + email, '1', 'EX', 900);
    expect(await isAccountLocked(redis as any, email)).toBe(true);

    await clearFailedAttempts(redis as any, email);
    expect(await isAccountLocked(redis as any, email)).toBe(false);
  });
});
