import type { Knex } from 'knex';

const TENANT_SCOPED_TABLES = [
  'floors',
  'menu_categories',
  'menu_items',
  'customization_groups',
  'customization_options',
  'tables',
  'table_sessions',
  'orders',
  'order_items',
  'order_item_customizations',
  'payments',
  'payment_allocations',
  'refunds',
  'payment_gateway_configs',
  'notification_configs',
];

export async function up(knex: Knex): Promise<void> {
  const [{ current_database }] = await knex.raw('SELECT current_database()').then((r: any) => r.rows);
  await knex.raw(`ALTER DATABASE "${current_database}" SET "app.current_tenant_id" = '00000000-0000-0000-0000-000000000000'`);

  for (const table of TENANT_SCOPED_TABLES) {
    await knex.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    await knex.raw(`
      CREATE POLICY tenant_isolation_${table} ON "${table}"
      USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);
  }

  await knex.raw('ALTER TABLE "users" ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE "users" FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation_users ON "users"
    USING (
      tenant_id = current_setting('app.current_tenant_id')::uuid
      OR role = 'super_admin'
    )
    WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id')::uuid
      OR role = 'super_admin'
    )
  `);

  const allTables = [...TENANT_SCOPED_TABLES, 'users', 'tenants', 'subscriptions'];
  for (const table of allTables) {
    await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO app_user`);
  }
  await knex.raw('GRANT USAGE ON SCHEMA public TO app_user');
}

export async function down(knex: Knex): Promise<void> {
  for (const table of [...TENANT_SCOPED_TABLES, 'users']) {
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation_${table} ON "${table}"`);
    await knex.raw(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  }
}
