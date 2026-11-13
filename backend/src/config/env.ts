import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
