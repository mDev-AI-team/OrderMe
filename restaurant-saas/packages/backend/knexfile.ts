// Uses DATABASE_URL_ADMIN (superuser) for migrations — table ownership required.
// Application code uses DATABASE_URL (app_user) — RLS enforced.
import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL,
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

export default config;
