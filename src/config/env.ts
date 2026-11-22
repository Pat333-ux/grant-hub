import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  OUTBOUND_WEBHOOK_URL: z.string().url().default('https://example.com/webhooks/grant-events'),
  OUTBOUND_WEBHOOK_SECRET: z.string().min(32),
  GRANT_PROVIDER_WEBHOOK_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
