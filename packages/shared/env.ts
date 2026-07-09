import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().optional().default('3001'),
  DATABASE_PATH: z.string().optional().default('./local.db'),
  GEMINI_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional().default('supersecret-minimum-32-characters'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
