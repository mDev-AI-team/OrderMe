import { createTestDb } from '../../helpers';
import type { Knex as KnexType } from 'knex';
import crypto from 'crypto';
import {
  findBySlug,
  findTenantById,
  isSlugAvailable,
  createTenant,
  updateTenant,
  updateOnboardingStep,
  updateSlug,
  activateTenant,
} from '../../../src/modules/tenant/tenant.repository';

describe('tenant.repository', () => {
  let db: KnexType;
  let createdTenantIds: string[] = [];

  beforeAll(async () => {
    db = createTestDb();
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await db('tenants').whereIn('id', createdTenantIds).delete();
    }
    await db.destroy();
  });

  async function withTrx<T>(cb: (trx: KnexType.Transaction) => Promise<T>): Promise<T> {
    return db.transaction(cb);
  }

  async function makeSlug() {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  async function seedTenant(overrides: Record<string, unknown> = {}) {
    const id = crypto.randomUUID();
    const slug = await makeSlug();
    const tenant = await withTrx((trx) =>
      createTenant(trx, {
        name: 'Seed Restaurant',
        slug,
        baseDomain: 'seed.example.com',
        ...overrides,
        id,
      })
    );
    createdTenantIds.push(id);
    return tenant;
  }

  describe('createTenant', () => {
    it('inserts a tenant and returns the row', async () => {
      const id = crypto.randomUUID();
      const slug = await makeSlug();
      const tenant = await withTrx((trx) =>
        createTenant(trx, { id, name: 'My Restaurant', slug, baseDomain: 'myrest.com' })
      );
      createdTenantIds.push(id);

      expect(tenant.id).toBe(id);
      expect(tenant.name).toBe('My Restaurant');
      expect(tenant.slug).toBe(slug);
      expect(tenant.base_domain).toBe('myrest.com');
      expect(tenant.status).toBe('pending');
      expect(tenant.default_language).toBe('en');
    });

    it('sets onboarding_step to 1 for new tenants', async () => {
      const tenant = await seedTenant();
      expect(tenant.onboarding_step).toBe(1);
    });

    it('returns a UUID id', async () => {
      const tenant = await seedTenant();
      expect(tenant.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('findBySlug', () => {
    it('returns the tenant when slug matches', async () => {
      const seeded = await seedTenant();
      const found = await withTrx((trx) => findBySlug(trx, seeded.slug));
      expect(found).not.toBeNull();
      expect(found!.id).toBe(seeded.id);
    });

    it('returns null when slug does not exist', async () => {
      const found = await withTrx((trx) => findBySlug(trx, 'nonexistent-slug-xyz'));
      expect(found).toBeNull();
    });
  });

  describe('isSlugAvailable', () => {
    it('returns true when slug does not exist', async () => {
      const available = await withTrx((trx) => isSlugAvailable(trx, 'totally-new-slug-xyz'));
      expect(available).toBe(true);
    });

    it('returns false when slug is already taken', async () => {
      const seeded = await seedTenant();
      const available = await withTrx((trx) => isSlugAvailable(trx, seeded.slug));
      expect(available).toBe(false);
    });

    it('returns true when slug is taken by the excluded tenant (self-check)', async () => {
      const seeded = await seedTenant();
      const available = await withTrx((trx) =>
        isSlugAvailable(trx, seeded.slug, seeded.id)
      );
      expect(available).toBe(true);
    });
  });

  describe('updateTenant', () => {
    it('updates allowed fields and returns the updated row', async () => {
      const seeded = await seedTenant();
      const updated = await withTrx((trx) =>
        updateTenant(trx, seeded.id, { name: 'Renamed Restaurant', currency: 'EUR' })
      );
      expect(updated.name).toBe('Renamed Restaurant');
      expect(updated.currency).toBe('EUR');
      expect(updated.id).toBe(seeded.id);
    });

    it('does not overwrite fields that are not passed', async () => {
      const seeded = await seedTenant({ name: 'Original Name' });
      const updated = await withTrx((trx) =>
        updateTenant(trx, seeded.id, { currency: 'GBP' })
      );
      expect(updated.name).toBe('Original Name');
    });
  });

  describe('updateSlug', () => {
    it('updates the slug and sets slug_changed_at', async () => {
      const seeded = await seedTenant();
      const newSlug = await makeSlug();
      const updated = await withTrx((trx) => updateSlug(trx, seeded.id, newSlug));
      expect(updated.slug).toBe(newSlug);
      expect(updated.slug_changed_at).not.toBeNull();
    });

    it('throws when slug was changed within the last 30 days', async () => {
      const seeded = await seedTenant();
      const firstSlug = await makeSlug();
      await withTrx((trx) => updateSlug(trx, seeded.id, firstSlug));

      const secondSlug = await makeSlug();
      await expect(
        withTrx((trx) => updateSlug(trx, seeded.id, secondSlug))
      ).rejects.toThrow(/30.day/i);
    });

    it('allows slug update when slug_changed_at is older than 30 days', async () => {
      const seeded = await seedTenant();
      // Manually set slug_changed_at to 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await db('tenants').where({ id: seeded.id }).update({ slug_changed_at: thirtyOneDaysAgo });

      const newSlug = await makeSlug();
      const updated = await withTrx((trx) => updateSlug(trx, seeded.id, newSlug));
      expect(updated.slug).toBe(newSlug);
    });
  });

  describe('findTenantById', () => {
    it('returns the tenant when id matches', async () => {
      const seeded = await seedTenant();
      const found = await withTrx((trx) => findTenantById(trx, seeded.id));
      expect(found).not.toBeNull();
      expect(found!.id).toBe(seeded.id);
      expect(found!.slug).toBe(seeded.slug);
    });

    it('returns null when id does not exist', async () => {
      const found = await withTrx((trx) => findTenantById(trx, crypto.randomUUID()));
      expect(found).toBeNull();
    });
  });

  describe('updateOnboardingStep', () => {
    it('updates onboarding_step and returns the row', async () => {
      const seeded = await seedTenant();
      expect(seeded.onboarding_step).toBe(1);

      const updated = await withTrx((trx) => updateOnboardingStep(trx, seeded.id, 3));
      expect(updated.onboarding_step).toBe(3);
      expect(updated.id).toBe(seeded.id);
    });

    it('does not change other fields', async () => {
      const seeded = await seedTenant({ name: 'Step Test' });
      const updated = await withTrx((trx) => updateOnboardingStep(trx, seeded.id, 2));
      expect(updated.name).toBe('Step Test');
      expect(updated.status).toBe('pending');
    });
  });

  describe('activateTenant', () => {
    it('sets status to active', async () => {
      const seeded = await seedTenant();
      expect(seeded.status).toBe('pending');

      const activated = await withTrx((trx) => activateTenant(trx, seeded.id));
      expect(activated.status).toBe('active');
    });

    it('clears onboarding_step and sets onboarding_completed_at', async () => {
      const seeded = await seedTenant();
      expect(seeded.onboarding_step).toBe(1);

      const activated = await withTrx((trx) => activateTenant(trx, seeded.id));
      expect(activated.onboarding_step).toBeNull();
      expect(activated.onboarding_completed_at).not.toBeNull();
    });

    it('returns the updated tenant row', async () => {
      const seeded = await seedTenant();
      const activated = await withTrx((trx) => activateTenant(trx, seeded.id));
      expect(activated.id).toBe(seeded.id);
      expect(activated.name).toBe(seeded.name);
    });
  });
});
