import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('floors', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('menu_categories', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.jsonb('name_i18n').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('deleted_at', { useTz: true });
  });

  await knex.schema.createTable('menu_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('category_id').notNullable().references('id').inTable('menu_categories').onDelete('RESTRICT');
    t.jsonb('name_i18n').notNullable();
    t.jsonb('description_i18n').notNullable();
    t.decimal('price', 10, 2).notNullable();
    t.string('image_url');
    t.boolean('is_available').notNullable().defaultTo(true);
    t.specificType('allergens', 'text[]').defaultTo('{}');
    t.integer('prep_time_minutes');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('deleted_at', { useTz: true });
  });

  await knex.schema.createTable('customization_groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('RESTRICT');
    t.jsonb('name_i18n').notNullable();
    t.enum('type', ['radio', 'checkbox']).notNullable();
    t.boolean('is_required').notNullable().defaultTo(false);
    t.integer('min_selections').notNullable().defaultTo(0);
    t.integer('max_selections');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('deleted_at', { useTz: true });
  });

  await knex.schema.createTable('customization_options', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('customization_groups').onDelete('RESTRICT');
    t.jsonb('label_i18n').notNullable();
    t.decimal('price_modifier', 10, 2).notNullable().defaultTo(0);
    t.boolean('is_default').notNullable().defaultTo(false);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('deleted_at', { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customization_options');
  await knex.schema.dropTableIfExists('customization_groups');
  await knex.schema.dropTableIfExists('menu_items');
  await knex.schema.dropTableIfExists('menu_categories');
  await knex.schema.dropTableIfExists('floors');
}
