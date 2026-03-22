import { z } from 'zod';

export const slugSchema = z.string().regex(
  /^[a-z0-9-]{3,30}$/,
  'Slug must be 3-30 characters, lowercase alphanumeric and hyphens only'
);

export const supportedLanguageSchema = z.enum(['en', 'ar', 'fr']);

export const i18nSchema = z.object({
  en: z.string().min(1),
  ar: z.string().min(1),
  fr: z.string().min(1),
});

export const tenantStatusSchema = z.enum(['pending', 'active', 'suspended', 'cancelled']);
export const userRoleSchema = z.enum(['owner', 'manager', 'staff', 'super_admin']);
