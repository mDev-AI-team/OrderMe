import pino from 'pino';

export function createLogger(level: string = 'info'): pino.Logger {
  return pino({
    level,
    redact: {
      paths: ['gateway_tx_id', 'req.headers.authorization', 'password', 'password_hash'],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
