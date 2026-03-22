import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name').notNullable();
    t.string('slug', 30).notNullable().unique();
    t.timestamp('slug_changed_at', { useTz: true });
    t.string('logo_url');
    t.string('base_domain').notNullable();
    t.enum('default_language', ['en', 'ar', 'fr']).notNullable().defaultTo('en');
    t.jsonb('supported_languages').notNullable().defaultTo(JSON.stringify(['en']));
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.string('timezone').notNullable().defaultTo('UTC');
    t.enum('status', ['pending', 'active', 'suspended', 'cancelled']).notNullable().defaultTo('pending');
    t.integer('onboarding_step');
    t.timestamp('onboarding_completed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.enum('plan', ['basic', 'pro', 'enterprise']).notNullable().defaultTo('basic');
    t.decimal('base_price', 10, 2).notNullable();
    t.decimal('tx_fee_percent', 5, 4).notNullable();
    t.enum('status', ['trial', 'active', 'past_due', 'cancelled']).notNullable().defaultTo('trial');
    t.timestamp('trial_ends_at', { useTz: true });
    t.timestamp('current_period_start', { useTz: true }).notNullable();
    t.timestamp('current_period_end', { useTz: true }).notNullable();
    t.string('external_subscription_id');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.enum('role', ['owner', 'manager', 'staff', 'super_admin']).notNullable();
    t.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    t.enum('language_pref', ['en', 'ar', 'fr']).notNullable().defaultTo('en');
    t.timestamp('email_verified_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('tenants');
}
