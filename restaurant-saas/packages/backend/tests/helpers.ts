import Knex from 'knex';
import type { Knex as KnexType } from 'knex';
import Redis from 'ioredis';
import pino from 'pino';
import * as dotenv from 'dotenv';
import * as path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export function createTestDb(): KnexType {
  return Knex({
    client: 'pg',
    connection: process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL,
    pool: { min: 1, max: 5 },
  });
}

export function createTestAppDb(): KnexType {
  // Uses app_user connection — RLS enforced (NOT table owner)
  return Knex({
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 1, max: 5 },
  });
}

export function createTestRedis(): Redis {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}

export function createTestLogger(): pino.Logger {
  return pino({ level: 'silent' });
}

export async function insertTestTenant(db: KnexType, overrides: Record<string, any> = {}) {
  const defaults = {
    id: crypto.randomUUID(),
    name: 'Test Restaurant',
    slug: `test-${Date.now()}`,
    base_domain: 'example.com',
    default_language: 'en',
    supported_languages: JSON.stringify(['en']),
    currency: 'USD',
    timezone: 'UTC',
    status: 'active',
  };
  const tenant = { ...defaults, ...overrides };
  await db('tenants').insert(tenant);
  return tenant;
}
