import { createTestDb, insertTestTenant } from '../../helpers';
import type { Knex as KnexType } from 'knex';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateEmailVerified,
  updatePassword,
} from '../../../src/modules/auth/auth.repository';

// These tests hit the real database (admin connection bypasses RLS)
describe('auth.repository', () => {
  let db: KnexType;
  let tenantId: string;

  beforeAll(async () => {
    db = createTestDb();
    const tenant = await insertTestTenant(db);
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db('tenants').where({ id: tenantId }).delete();
    await db.destroy();
  });

  afterEach(async () => {
    // Clean up users inserted during each test
    await db('users').where({ tenant_id: tenantId }).delete();
  });

  async function withAdminTrx<T>(cb: (trx: KnexType.Transaction) => Promise<T>): Promise<T> {
    return db.transaction(cb);
  }

  describe('createUser', () => {
    it('inserts a user and returns the created row', async () => {
      const user = await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'owner@example.com',
          passwordHash: 'hashed',
          role: 'owner',
          tenantId,
          languagePref: 'en',
        })
      );

      expect(user.id).toBeDefined();
      expect(user.email).toBe('owner@example.com');
      expect(user.role).toBe('owner');
      expect(user.tenant_id).toBe(tenantId);
      expect(user.language_pref).toBe('en');
      expect(user.email_verified_at).toBeNull();
    });

    it('returns user with a UUID id', async () => {
      const user = await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'uuid-test@example.com',
          passwordHash: 'hashed',
          role: 'staff',
          tenantId,
          languagePref: 'en',
        })
      );
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('findUserByEmail', () => {
    it('returns the user when email matches', async () => {
      await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'find-by-email@example.com',
          passwordHash: 'hashed',
          role: 'owner',
          tenantId,
          languagePref: 'en',
        })
      );

      const found = await withAdminTrx((trx) =>
        findUserByEmail(trx, 'find-by-email@example.com')
      );
      expect(found).not.toBeNull();
      expect(found!.email).toBe('find-by-email@example.com');
    });

    it('returns null when email does not exist', async () => {
      const found = await withAdminTrx((trx) =>
        findUserByEmail(trx, 'nonexistent@example.com')
      );
      expect(found).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns the user when id matches', async () => {
      const created = await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'find-by-id@example.com',
          passwordHash: 'hashed',
          role: 'owner',
          tenantId,
          languagePref: 'en',
        })
      );

      const found = await withAdminTrx((trx) => findUserById(trx, created.id));
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null when id does not exist', async () => {
      const found = await withAdminTrx((trx) =>
        findUserById(trx, '00000000-0000-0000-0000-000000000000')
      );
      expect(found).toBeNull();
    });
  });

  describe('updateEmailVerified', () => {
    it('sets email_verified_at to a timestamp', async () => {
      const user = await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'verify@example.com',
          passwordHash: 'hashed',
          role: 'owner',
          tenantId,
          languagePref: 'en',
        })
      );

      expect(user.email_verified_at).toBeNull();

      await withAdminTrx((trx) => updateEmailVerified(trx, user.id));

      const updated = await withAdminTrx((trx) => findUserById(trx, user.id));
      expect(updated!.email_verified_at).not.toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('updates the password_hash for the user', async () => {
      const user = await withAdminTrx((trx) =>
        createUser(trx, {
          email: 'pwreset@example.com',
          passwordHash: 'old-hash',
          role: 'owner',
          tenantId,
          languagePref: 'en',
        })
      );

      await withAdminTrx((trx) => updatePassword(trx, user.id, 'new-hash'));

      const updated = await withAdminTrx((trx) => findUserById(trx, user.id));
      expect(updated!.password_hash).toBe('new-hash');
    });
  });
});
