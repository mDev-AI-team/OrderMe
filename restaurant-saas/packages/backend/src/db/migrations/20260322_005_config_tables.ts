import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notification_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE').unique();
    t.boolean('kds_enabled').notNullable().defaultTo(true);
    t.boolean('printer_enabled').notNullable().defaultTo(false);
    t.jsonb('printer_config');
    t.boolean('alert_sound_enabled').notNullable().defaultTo(true);
    t.boolean('dashboard_alerts_enabled').notNullable().defaultTo(true);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notification_configs');
}
