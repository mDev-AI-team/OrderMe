import Knex from 'knex';
import type { Knex as KnexType } from 'knex';
import { getTenantContext } from '../lib/async-context';
import type pino from 'pino';

let db: KnexType | null = null;

export function createDatabase(databaseUrl: string, logger: pino.Logger): KnexType {
  if (db) return db;

  db = Knex({
    client: 'pg',
    connection: databaseUrl,
    pool: {
      min: 2,
      max: 20,
    },
    log: {
      warn(msg: string) { logger.warn(msg); },
      error(msg: string) { logger.error(msg); },
      deprecate(msg: string) { logger.warn(msg); },
      debug(msg: string) { logger.debug(msg); },
    },
  });

  return db;
}

export function getDatabase(): KnexType {
  if (!db) {
    throw new Error('Database not initialized — call createDatabase first');
  }
  return db;
}

/**
 * Execute a callback within a transaction that has tenant context set.
 * Uses SET LOCAL so the setting is automatically reset when the transaction ends.
 */
export async function withTenantTransaction<T>(
  callback: (trx: KnexType.Transaction) => Promise<T>
): Promise<T> {
  const tenant = getTenantContext();
  const database = getDatabase();

  return database.transaction(async (trx) => {
    await trx.raw("SET LOCAL app.current_tenant_id = ?", [tenant.tenantId]);
    return callback(trx);
  });
}

// NOTE: All tenant-scoped DB access MUST go through withTenantTransaction.
// SET LOCAL is transaction-scoped and is a no-op outside a transaction.
// There is intentionally no "setTenantOnConnection" helper — it would bypass RLS silently.

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
