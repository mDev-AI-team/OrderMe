import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('session_id').notNullable().references('id').inTable('table_sessions').onDelete('RESTRICT');
    t.string('customer_token').notNullable();
    t.uuid('staff_user_id').references('id').inTable('users').onDelete('SET NULL');
    t.decimal('amount', 10, 2).notNullable();
    t.enum('method', ['card', 'cash']).notNullable();
    t.enum('split_type', ['full', 'per_person', 'per_item']).notNullable();
    t.integer('split_headcount');
    t.uuid('split_group_id');
    t.string('gateway_tx_id');
    t.enum('status', ['pending', 'processing', 'completed', 'failed', 'refunded']).notNullable().defaultTo('pending');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('payment_allocations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('payment_id').notNullable().references('id').inTable('payments').onDelete('CASCADE');
    t.uuid('order_item_id').notNullable().references('id').inTable('order_items').onDelete('RESTRICT');
    t.decimal('amount', 10, 2).notNullable();
  });

  await knex.schema.createTable('refunds', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('payment_id').notNullable().references('id').inTable('payments').onDelete('RESTRICT');
    t.decimal('amount', 10, 2).notNullable();
    t.text('reason').notNullable();
    t.uuid('initiated_by').references('id').inTable('users').onDelete('SET NULL');
    t.string('gateway_refund_id');
    t.enum('status', ['pending', 'completed', 'failed']).notNullable().defaultTo('pending');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('payment_gateway_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE').unique();
    t.enum('gateway', ['stripe', 'areeba', 'tap']).notNullable();
    t.specificType('encrypted_config', 'bytea').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_gateway_configs');
  await knex.schema.dropTableIfExists('refunds');
  await knex.schema.dropTableIfExists('payment_allocations');
  await knex.schema.dropTableIfExists('payments');
}
