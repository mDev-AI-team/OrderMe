import type { Knex } from 'knex';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'owner' | 'manager' | 'staff' | 'super_admin';
  tenant_id: string | null;
  language_pref: 'en' | 'ar' | 'fr';
  email_verified_at: Date | null;
  created_at: Date;
}

interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: 'owner' | 'manager' | 'staff' | 'super_admin';
  tenantId: string;
  languagePref?: 'en' | 'ar' | 'fr';
}

export async function findUserByEmail(trx: Knex.Transaction, email: string): Promise<User | null> {
  const row = await trx<User>('users').where({ email }).first();
  return row ?? null;
}

export async function findUserById(trx: Knex.Transaction, userId: string): Promise<User | null> {
  const row = await trx<User>('users').where({ id: userId }).first();
  return row ?? null;
}

export async function createUser(trx: Knex.Transaction, input: CreateUserInput): Promise<User> {
  const [user] = await trx<User>('users')
    .insert({
      email: input.email,
      password_hash: input.passwordHash,
      role: input.role,
      tenant_id: input.tenantId,
      language_pref: input.languagePref ?? 'en',
    })
    .returning('*');
  return user;
}

export async function updateEmailVerified(trx: Knex.Transaction, userId: string): Promise<void> {
  await trx('users').where({ id: userId }).update({ email_verified_at: trx.fn.now() });
}

export async function updatePassword(
  trx: Knex.Transaction,
  userId: string,
  newPasswordHash: string
): Promise<void> {
  await trx('users').where({ id: userId }).update({ password_hash: newPasswordHash });
}
