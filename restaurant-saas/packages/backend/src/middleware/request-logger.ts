import pinoHttp from 'pino-http';
import type pino from 'pino';
import crypto from 'crypto';

export function createRequestLogger(logger: pino.Logger) {
  return pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    customProps(req) {
      return {
        tenant_id: (req as any).tenantContext?.tenantId ?? 'none',
      };
    },
  });
}
