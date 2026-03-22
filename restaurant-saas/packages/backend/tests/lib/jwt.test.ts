jest.mock('../../src/config', () => ({
  loadConfig: () => ({
    jwtSecret: 'test-secret-at-least-16-chars!!',
  }),
}));

import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyToken, generateJti } from '../../src/lib/jwt';
import type { JwtPayload } from '../../src/modules/auth/auth.types';

const TEST_SECRET = 'test-secret-at-least-16-chars!!';

const samplePayload: JwtPayload = {
  sub: 'user-123',
  tenant_id: 'tenant-456',
  role: 'owner',
  jti: 'jti-789',
};

describe('generateJti', () => {
  it('returns a UUID v4 string', () => {
    const jti = generateJti();
    expect(jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns a unique value on each call', () => {
    expect(generateJti()).not.toBe(generateJti());
  });
});

describe('signAccessToken', () => {
  it('returns a JWT string with three dot-separated parts', () => {
    const token = signAccessToken(samplePayload);
    expect(token.split('.')).toHaveLength(3);
  });

  it('includes sub, tenant_id, role, jti claims', () => {
    const token = signAccessToken(samplePayload);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.sub).toBe(samplePayload.sub);
    expect(decoded.tenant_id).toBe(samplePayload.tenant_id);
    expect(decoded.role).toBe(samplePayload.role);
    expect(decoded.jti).toBe(samplePayload.jti);
  });

  it('expires in exactly 15 minutes (900 seconds)', () => {
    const token = signAccessToken(samplePayload);
    const decoded = jwt.decode(token) as Record<string, number>;
    expect(decoded.exp - decoded.iat).toBe(900);
  });
});

describe('signRefreshToken', () => {
  it('returns a JWT string with three dot-separated parts', () => {
    const token = signRefreshToken(samplePayload);
    expect(token.split('.')).toHaveLength(3);
  });

  it('expires in exactly 7 days (604800 seconds)', () => {
    const token = signRefreshToken(samplePayload);
    const decoded = jwt.decode(token) as Record<string, number>;
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });
});

describe('verifyToken', () => {
  it('returns decoded payload for a valid access token', () => {
    const token = signAccessToken(samplePayload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(samplePayload.sub);
    expect(decoded.tenant_id).toBe(samplePayload.tenant_id);
    expect(decoded.role).toBe(samplePayload.role);
    expect(decoded.jti).toBe(samplePayload.jti);
  });

  it('returns decoded payload for a valid refresh token', () => {
    const token = signRefreshToken(samplePayload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(samplePayload.sub);
  });

  it('throws for an expired token', () => {
    const expired = jwt.sign(samplePayload, TEST_SECRET, { expiresIn: -1 });
    expect(() => verifyToken(expired)).toThrow();
  });

  it('throws for a malformed token', () => {
    expect(() => verifyToken('not.a.jwt')).toThrow();
  });

  it('throws for a token signed with a different secret', () => {
    const foreign = jwt.sign(samplePayload, 'completely-different-secret-here');
    expect(() => verifyToken(foreign)).toThrow();
  });
});
