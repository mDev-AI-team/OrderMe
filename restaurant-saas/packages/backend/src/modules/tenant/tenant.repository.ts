import type { Knex } from 'knex';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  slug_changed_at: Date | null;
  logo_url: string | null;
  base_domain: string;
  default_language: 'en' | 'ar' | 'fr';
  supported_languages: string[];
  currency: string;
  timezone: string;
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  onboarding_step: number | null;
  onboarding_completed_at: Date | null;
  created_at: Date;
}

interface CreateTenantInput {
  id?: string;
  name: string;
  slug: string;
  baseDomain: string;
  logoUrl?: string;
  defaultLanguage?: 'en' | 'ar' | 'fr';
  supportedLanguages?: string[];
  currency?: string;
  timezone?: string;
}

interface UpdateTenantInput {
  name?: string;
  logoUrl?: string;
  baseDomain?: string;
  defaultLanguage?: 'en' | 'ar' | 'fr';
  supportedLanguages?: string[];
  currency?: string;
  timezone?: string;
  onboardingStep?: number;
  onboardingCompletedAt?: Date;
}

const SLUG_COOLDOWN_DAYS = 30;

export async function findBySlug(trx: Knex.Transaction, slug: string): Promise<Tenant | null> {
  const row = await trx<Tenant>('tenants').where({ slug }).first();
  return row ?? null;
}

export async function findTenantById(trx: Knex.Transaction, id: string): Promise<Tenant | null> {
  const row = await trx<Tenant>('tenants').where({ id }).first();
  return row ?? null;
}

export async function isSlugAvailable(
  trx: Knex.Transaction,
  slug: string,
  excludeTenantId?: string
): Promise<boolean> {
  const query = trx<Tenant>('tenants').where({ slug });
  if (excludeTenantId) {
    query.whereNot({ id: excludeTenantId });
  }
  const row = await query.first();
  return row == null;
}

export async function createTenant(
  trx: Knex.Transaction,
  input: CreateTenantInput
): Promise<Tenant> {
  const insert: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    base_domain: input.baseDomain,
    default_language: input.defaultLanguage ?? 'en',
    supported_languages: JSON.stringify(input.supportedLanguages ?? ['en']),
    currency: input.currency ?? 'USD',
    timezone: input.timezone ?? 'UTC',
    status: 'pending',
    onboarding_step: 1,
  };
  if (input.id) insert.id = input.id;
  if (input.logoUrl) insert.logo_url = input.logoUrl;

  const [tenant] = await trx<Tenant>('tenants').insert(insert).returning('*');
  return tenant;
}

export async function updateTenant(
  trx: Knex.Transaction,
  tenantId: string,
  input: UpdateTenantInput
): Promise<Tenant> {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.logoUrl !== undefined) update.logo_url = input.logoUrl;
  if (input.baseDomain !== undefined) update.base_domain = input.baseDomain;
  if (input.defaultLanguage !== undefined) update.default_language = input.defaultLanguage;
  if (input.supportedLanguages !== undefined)
    update.supported_languages = JSON.stringify(input.supportedLanguages);
  if (input.currency !== undefined) update.currency = input.currency;
  if (input.timezone !== undefined) update.timezone = input.timezone;
  if (input.onboardingStep !== undefined) update.onboarding_step = input.onboardingStep;
  if (input.onboardingCompletedAt !== undefined)
    update.onboarding_completed_at = input.onboardingCompletedAt;

  const [tenant] = await trx<Tenant>('tenants')
    .where({ id: tenantId })
    .update(update)
    .returning('*');
  return tenant;
}

export async function updateSlug(
  trx: Knex.Transaction,
  tenantId: string,
  newSlug: string
): Promise<Tenant> {
  const current = await trx<Tenant>('tenants').where({ id: tenantId }).first();
  if (!current) throw new Error(`Tenant ${tenantId} not found`);

  if (current.slug_changed_at) {
    const daysSinceChange =
      (Date.now() - new Date(current.slug_changed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceChange < SLUG_COOLDOWN_DAYS) {
      throw new Error(
        `Slug can only be changed once every ${SLUG_COOLDOWN_DAYS} days. ` +
          `Please wait ${Math.ceil(SLUG_COOLDOWN_DAYS - daysSinceChange)} more day(s).`
      );
    }
  }

  const [tenant] = await trx<Tenant>('tenants')
    .where({ id: tenantId })
    .update({ slug: newSlug, slug_changed_at: trx.fn.now() })
    .returning('*');
  return tenant;
}

export async function updateOnboardingStep(
  trx: Knex.Transaction,
  tenantId: string,
  step: number
): Promise<Tenant> {
  const [tenant] = await trx<Tenant>('tenants')
    .where({ id: tenantId })
    .update({ onboarding_step: step })
    .returning('*');
  return tenant;
}

export async function activateTenant(trx: Knex.Transaction, tenantId: string): Promise<Tenant> {
  const [tenant] = await trx<Tenant>('tenants')
    .where({ id: tenantId })
    .update({
      status: 'active',
      onboarding_step: null,
      onboarding_completed_at: trx.fn.now(),
    })
    .returning('*');
  return tenant;
}
