import { z } from 'zod';

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr'] as const;
const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_REGEX, 'Slug must be 3–30 lowercase alphanumeric characters or hyphens'),
  baseDomain: z.string().min(3).max(253),
  logoUrl: z.string().url().optional(),
  defaultLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
  supportedLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().min(1).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  baseDomain: z.string().min(3).max(253).optional(),
  defaultLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
  supportedLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().min(1).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export const checkSlugSchema = z.object({
  slug: z.string().regex(SLUG_REGEX, 'Slug must be 3–30 lowercase alphanumeric characters or hyphens'),
  excludeTenantId: z.string().uuid().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;
