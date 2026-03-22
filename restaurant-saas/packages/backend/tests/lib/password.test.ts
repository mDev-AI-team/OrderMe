import { hashPassword, comparePassword } from '../../src/lib/password';

describe('hashPassword', () => {
  it('returns a bcrypt hash', async () => {
    const hash = await hashPassword('mysecretpassword');
    expect(hash).toMatch(/^\$2b\$/);
  });

  it('produces different hashes for the same input (salted)', async () => {
    const hash1 = await hashPassword('mysecretpassword');
    const hash2 = await hashPassword('mysecretpassword');
    expect(hash1).not.toBe(hash2);
  });

  it('uses cost factor 12', async () => {
    const hash = await hashPassword('mysecretpassword');
    // bcrypt format: $2b$<cost>$...
    const cost = parseInt(hash.split('$')[2], 10);
    expect(cost).toBe(12);
  });
});

describe('comparePassword', () => {
  it('returns true when password matches the hash', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const result = await comparePassword('correct-horse-battery', hash);
    expect(result).toBe(true);
  });

  it('returns false when password does not match the hash', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const result = await comparePassword('wrong-password', hash);
    expect(result).toBe(false);
  });
});
