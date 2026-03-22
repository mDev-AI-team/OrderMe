import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_ADMIN: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  GATEWAY_ENCRYPTION_KEY: z.string().min(32),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RESEND_API_KEY: z.string().optional(),
});

export interface AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databaseUrlAdmin: string | undefined;
  readonly redisUrl: string;
  readonly jwtSecret: string;
  readonly gatewayEncryptionKey: string;
  readonly logLevel: string;
  readonly resendApiKey: string | undefined;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return Object.freeze({
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlAdmin: parsed.DATABASE_URL_ADMIN,
    redisUrl: parsed.REDIS_URL,
    jwtSecret: parsed.JWT_SECRET,
    gatewayEncryptionKey: parsed.GATEWAY_ENCRYPTION_KEY,
    logLevel: parsed.LOG_LEVEL,
    resendApiKey: parsed.RESEND_API_KEY,
  });
}
