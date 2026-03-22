import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tables', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('floor_id').references('id').inTable('floors').onDelete('SET NULL');
    t.string('label').notNullable();
    t.integer('capacity').notNullable();
    t.enum('shape', ['round', 'square', 'rect', 'L', 'bar']).notNullable().defaultTo('square');
    t.float('width').notNullable().defaultTo(1);
    t.float('height').notNullable().defaultTo(1);
    t.float('rotation').notNullable().defaultTo(0);
    t.float('position_x').notNullable().defaultTo(0);
    t.float('position_y').notNullable().defaultTo(0);
    t.string('qr_code_token').notNullable().unique();
    t.timestamp('qr_code_regenerated_at', { useTz: true });
    t.boolean('is_active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('table_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('table_id').notNullable().references('id').inTable('tables').onDelete('RESTRICT');
    t.enum('status', ['open', 'closed']).notNullable().defaultTo('open');
    t.decimal('expected_total', 10, 2).notNullable().defaultTo(0);
    t.timestamp('opened_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('closed_at', { useTz: true });
    t.uuid('closed_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('session_id').notNullable().references('id').inTable('table_sessions').onDelete('RESTRICT');
    t.string('customer_token').notNullable();
    t.uuid('placed_by').references('id').inTable('users').onDelete('SET NULL');
    t.enum('status', ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']).notNullable().defaultTo('pending');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('order_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('RESTRICT');
    t.integer('quantity').notNullable().defaultTo(1);
    t.decimal('unit_price', 10, 2).notNullable();
    t.decimal('snapshot_total', 10, 2).notNullable();
    t.string('notes');
    t.enum('status', ['pending', 'preparing', 'ready', 'served', 'cancelled']).notNullable().defaultTo('pending');
  });

  await knex.schema.createTable('order_item_customizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('order_item_id').notNullable().references('id').inTable('order_items').onDelete('CASCADE');
    t.uuid('option_id').notNullable().references('id').inTable('customization_options').onDelete('RESTRICT');
    t.decimal('price_modifier', 10, 2).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_item_customizations');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('table_sessions');
  await knex.schema.dropTableIfExists('tables');
}
