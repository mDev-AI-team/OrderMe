import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { createRedisClient, closeRedis } from './lib/redis';
import { createDatabase, closeDatabase } from './db/knex';
import { createApp } from './app';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const db = createDatabase(config.databaseUrl, logger);
  const redis = createRedisClient(config.redisUrl, logger);

  await redis.connect();
  logger.info('Redis connected');

  const app = createApp({ db, redis, logger });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
