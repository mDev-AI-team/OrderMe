import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../../src/modules/auth/auth.validation';

describe('registerSchema', () => {
  const valid = { email: 'owner@example.com', password: 'secret123', name: 'My Restaurant', slug: 'my-restaurant' };

  it('accepts a valid registration payload', () => {
    expect(() => registerSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() => registerSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'short' })).toThrow();
  });

  it('rejects a name shorter than 2 characters', () => {
    expect(() => registerSchema.parse({ ...valid, name: 'X' })).toThrow();
  });

  it('rejects a slug that does not match ^[a-z0-9-]{3,30}$', () => {
    expect(() => registerSchema.parse({ ...valid, slug: 'AB' })).toThrow();          // uppercase
    expect(() => registerSchema.parse({ ...valid, slug: 'ab' })).toThrow();           // too short (< 3)
    expect(() => registerSchema.parse({ ...valid, slug: 'a'.repeat(31) })).toThrow(); // too long
    expect(() => registerSchema.parse({ ...valid, slug: 'has space' })).toThrow();    // space
    expect(() => registerSchema.parse({ ...valid, slug: 'has_underscore' })).toThrow(); // underscore
  });

  it('accepts slugs at the boundary (3 and 30 chars)', () => {
    expect(() => registerSchema.parse({ ...valid, slug: 'abc' })).not.toThrow();
    expect(() => registerSchema.parse({ ...valid, slug: 'a'.repeat(30) })).not.toThrow();
  });
});

describe('loginSchema', () => {
  const valid = { email: 'owner@example.com', password: 'anypassword' };

  it('accepts a valid login payload', () => {
    expect(() => loginSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() => loginSchema.parse({ ...valid, email: 'bad' })).toThrow();
  });

  it('rejects a missing password', () => {
    expect(() => loginSchema.parse({ email: valid.email })).toThrow();
  });
});

describe('refreshSchema', () => {
  it('accepts a non-empty refreshToken', () => {
    expect(() => refreshSchema.parse({ refreshToken: 'some.jwt.token' })).not.toThrow();
  });

  it('rejects an empty refreshToken', () => {
    expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
  });

  it('rejects a missing refreshToken', () => {
    expect(() => refreshSchema.parse({})).toThrow();
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'user@example.com' })).not.toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'not-valid' })).toThrow();
  });

  it('rejects a missing email', () => {
    expect(() => forgotPasswordSchema.parse({})).toThrow();
  });
});

describe('resetPasswordSchema', () => {
  const valid = { token: 'reset-token-abc', password: 'newpassword' };

  it('accepts a valid reset payload', () => {
    expect(() => resetPasswordSchema.parse(valid)).not.toThrow();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => resetPasswordSchema.parse({ ...valid, password: 'short' })).toThrow();
  });

  it('rejects a missing token', () => {
    expect(() => resetPasswordSchema.parse({ password: valid.password })).toThrow();
  });
});

describe('verifyEmailSchema', () => {
  it('accepts a valid token', () => {
    expect(() => verifyEmailSchema.parse({ token: 'verify-token-xyz' })).not.toThrow();
  });

  it('rejects a missing token', () => {
    expect(() => verifyEmailSchema.parse({})).toThrow();
  });

  it('rejects an empty token', () => {
    expect(() => verifyEmailSchema.parse({ token: '' })).toThrow();
  });
});
