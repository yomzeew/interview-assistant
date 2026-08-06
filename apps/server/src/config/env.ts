import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  EXTENSION_ORIGIN: z.string().default('chrome-extension://your-extension-id'),
  PUBLIC_SERVER_URL: z.string().url().default('http://localhost:4000'),
  PUBLIC_WEBSOCKET_URL: z.string().default('ws://localhost:4000/ws'),

  TRANSCRIPTION_PROVIDER: z.enum(['mock', 'openai', 'groq', 'assemblyai']).default('mock'),
  TRANSCRIPTION_API_KEY: z.string().default(''),
  ASSEMBLYAI_API_KEY: z.string().default(''),

  TRANSLATION_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  TRANSLATION_API_KEY: z.string().default(''),

  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AI_PROVIDER: z.enum(['claude', 'groq']).default('groq'),
  GROQ_API_KEY: z.string().default(''),

  SESSION_TOKEN_SECRET: z.string().min(16).default('dev-secret-change-in-production-!!'),
  SESSION_TOKEN_TTL_SECONDS: z.coerce.number().default(300),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
