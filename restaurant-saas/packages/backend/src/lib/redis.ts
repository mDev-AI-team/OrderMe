import Redis from 'ioredis';
import type pino from 'pino';

let client: Redis | null = null;

export function createRedisClient(url: string, logger: pino.Logger): Redis {
  if (client) return client;

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!client) {
    throw new Error('Redis client not initialized — call createRedisClient first');
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
