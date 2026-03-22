import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE INDEX idx_table_sessions_tenant_table_status ON table_sessions (tenant_id, table_id, status)');
  await knex.raw('CREATE INDEX idx_table_sessions_tenant_opened ON table_sessions (tenant_id, opened_at)');
  await knex.raw('CREATE INDEX idx_orders_tenant_session ON orders (tenant_id, session_id)');
  await knex.raw('CREATE INDEX idx_orders_tenant_customer ON orders (tenant_id, customer_token)');
  await knex.raw('CREATE INDEX idx_orders_tenant_created ON orders (tenant_id, created_at)');
  await knex.raw('CREATE INDEX idx_order_items_tenant_order ON order_items (tenant_id, order_id)');
  await knex.raw('CREATE INDEX idx_order_items_tenant_menu_item ON order_items (tenant_id, menu_item_id)');
  await knex.raw('CREATE INDEX idx_order_items_tenant_status ON order_items (tenant_id, status)');
  await knex.raw('CREATE INDEX idx_payments_tenant_session ON payments (tenant_id, session_id)');
  await knex.raw('CREATE INDEX idx_payments_tenant_status ON payments (tenant_id, status)');
  await knex.raw('CREATE INDEX idx_payment_alloc_tenant_order_item ON payment_allocations (tenant_id, order_item_id)');
  await knex.raw('CREATE INDEX idx_menu_items_tenant_category ON menu_items (tenant_id, category_id)');
  await knex.raw('CREATE INDEX idx_menu_items_available ON menu_items (tenant_id, is_available) WHERE deleted_at IS NULL');
  await knex.raw('CREATE INDEX idx_menu_items_name_gin ON menu_items USING GIN (name_i18n)');
  await knex.raw(`CREATE INDEX idx_menu_items_name_en ON menu_items ((name_i18n->>'en'))`);
  await knex.raw(`CREATE INDEX idx_menu_items_name_ar ON menu_items ((name_i18n->>'ar'))`);
  await knex.raw(`CREATE INDEX idx_menu_items_name_fr ON menu_items ((name_i18n->>'fr'))`);
  await knex.raw('CREATE INDEX idx_cust_groups_tenant_item ON customization_groups (tenant_id, menu_item_id)');
  await knex.raw('CREATE INDEX idx_cust_options_tenant_group ON customization_options (tenant_id, group_id)');
  await knex.raw('CREATE INDEX idx_oic_tenant_order_item ON order_item_customizations (tenant_id, order_item_id)');
}

export async function down(knex: Knex): Promise<void> {
  const indexes = [
    'idx_table_sessions_tenant_table_status', 'idx_table_sessions_tenant_opened',
    'idx_orders_tenant_session', 'idx_orders_tenant_customer', 'idx_orders_tenant_created',
    'idx_order_items_tenant_order', 'idx_order_items_tenant_menu_item', 'idx_order_items_tenant_status',
    'idx_payments_tenant_session', 'idx_payments_tenant_status',
    'idx_payment_alloc_tenant_order_item',
    'idx_menu_items_tenant_category', 'idx_menu_items_available', 'idx_menu_items_name_gin',
    'idx_menu_items_name_en', 'idx_menu_items_name_ar', 'idx_menu_items_name_fr',
    'idx_cust_groups_tenant_item', 'idx_cust_options_tenant_group',
    'idx_oic_tenant_order_item',
  ];
  for (const idx of indexes) {
    await knex.raw(`DROP INDEX IF EXISTS ${idx}`);
  }
}
