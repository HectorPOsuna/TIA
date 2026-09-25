import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  TICK_MS: z.coerce.number().int().min(50).max(60_000).default(1000),
  INITIAL_NODES: z.coerce.number().int().min(1).max(50).default(3),
  INITIAL_TEMP: z.coerce.number().min(-60).max(150).default(25),
  TARGET_TEMP: z.coerce.number().min(-60).max(150).default(30),
  AMBIENT_TEMP: z.coerce.number().min(-60).max(150).default(20),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  NODE_QUEUE_CAPACITY: z.coerce.number().int().min(1).max(10_000).default(50),
  STACK_CAPACITY: z.coerce.number().int().min(1).max(10_000).default(20),
  LOG_CAPACITY: z.coerce.number().int().min(10).max(100_000).default(200),
  MAX_CONSECUTIVE_FAILURES: z.coerce.number().int().min(1).max(255).default(5),
  RULES_FILE: z.string().optional().default('data/default-rules.json'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}