import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(1),
  META_APP_ID: z.string().default('saas_platform_meta_app_id'),
  META_APP_SECRET: z.string().default('saas_platform_meta_app_secret'),
  WEBHOOK_VERIFY_TOKEN: z.string().default('wa_verify_token_123456'),
  CRON_SECRET: z.string().default('wa_cron_secret_789012'),
  FRONTEND_ORIGIN: z.string().default('https://wa-frontend.onrender.com'),
  DATABASE_URL: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);

