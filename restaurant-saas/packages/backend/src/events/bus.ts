import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import type pino from 'pino';
import type { EventNameValue, BaseEventPayload } from '@restaurant-saas/shared';
import { QUEUES, MAX_CAUSATION_DEPTH } from './queues';

type EventHandler = (payload: BaseEventPayload) => Promise<void>;

let eventQueue: Queue | null = null;
let eventWorker: Worker | null = null;
const handlers = new Map<string, EventHandler[]>();

export function createEventBus(redis: Redis, logger: pino.Logger) {
  const connection = { host: redis.options.host, port: redis.options.port };

  eventQueue = new Queue(QUEUES.EVENTS, { connection });

  return {
    async publish(event: EventNameValue, payload: BaseEventPayload): Promise<void> {
      if (!eventQueue) throw new Error('Event bus not initialized');

      const depth = (payload.causation_id.match(/->/g) || []).length;
      if (depth >= MAX_CAUSATION_DEPTH) {
        logger.warn({ event, causation_id: payload.causation_id }, 'Event chain exceeded max depth, dropping');
        return;
      }

      await eventQueue.add(event, payload, {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });

      logger.info({ event, tenant_id: payload.tenant_id }, 'Event published');
    },

    on(event: EventNameValue, handler: EventHandler): void {
      const existing = handlers.get(event) || [];
      handlers.set(event, [...existing, handler]);
    },

    startWorker(): void {
      if (eventWorker) return;

      eventWorker = new Worker(
        QUEUES.EVENTS,
        async (job: Job) => {
          const event = job.name as EventNameValue;
          const payload = job.data as BaseEventPayload;
          const eventHandlers = handlers.get(event) || [];

          for (const handler of eventHandlers) {
            try {
              await handler(payload);
            } catch (err) {
              logger.error({ err, event, job_id: job.id }, 'Event handler failed');
              throw err;
            }
          }
        },
        { connection, concurrency: 5 },
      );

      eventWorker.on('failed', (job, err) => {
        logger.error({ err, job_id: job?.id, event: job?.name }, 'Event processing failed');
      });

      logger.info('Event bus worker started');
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

export async function closeEventBus(): Promise<void> {
  if (eventWorker) {
    await eventWorker.close();
    eventWorker = null;
  }
  if (eventQueue) {
    await eventQueue.close();
    eventQueue = null;
  }
}
