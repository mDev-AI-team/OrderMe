export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionPlan = 'basic' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';
export type UserRole = 'owner' | 'manager' | 'staff' | 'super_admin';
export type SupportedLanguage = 'en' | 'ar' | 'fr';

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly slug_changed_at: string | null;
  readonly logo_url: string | null;
  readonly base_domain: string;
  readonly default_language: SupportedLanguage;
  readonly supported_languages: readonly SupportedLanguage[];
  readonly currency: string;
  readonly timezone: string;
  readonly status: TenantStatus;
  readonly onboarding_step: number | null;
  readonly onboarding_completed_at: string | null;
  readonly created_at: string;
}

export interface TenantContext {
  readonly tenantId: string;
  readonly slug: string;
  readonly status: TenantStatus;
}
