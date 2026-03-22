import { loadConfig } from '../config';
import { createLogger } from '../lib/logger';
import { createRedisClient, closeRedis } from '../lib/redis';
import { createEventBus, closeEventBus } from './bus';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const redis = createRedisClient(config.redisUrl, logger);
  await redis.connect();

  const eventBus = createEventBus(redis, logger);
  eventBus.startWorker();

  logger.info('Event worker running');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down');
    await closeEventBus();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
