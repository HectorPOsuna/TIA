import 'dotenv/config';
import { z } from 'zod';

const boolFromEnv = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

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
  LOG_FILE: z.string().optional().default('data/logs.jsonl'),
  LOG_CONSOLE: boolFromEnv(true),
  LOG_LEVEL: z.enum(['info', 'warning', 'critical']).default('info'),
  LOG_HTTP: boolFromEnv(true),
  LOG_TELEMETRY_EVERY: z.coerce.number().int().min(0).max(60_000).default(5),
  MAX_CONSECUTIVE_FAILURES: z.coerce.number().int().min(1).max(255).default(5),
  PENDING_POOL_CAPACITY: z.coerce.number().int().min(1).max(10_000).default(100),
  RULES_FILE: z.string().optional().default('data/default-rules.json'),
  DB_ENABLED: boolFromEnv(true),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  DB_NAME: z.string().min(1).default('waitt'),
  DB_USER: z.string().min(1).default('waitt'),
  DB_PASSWORD: z.string().min(1).default('waitt'),
  DB_FLUSH_MS: z.coerce.number().int().min(50).max(60_000).default(1000),
  DB_MAX_BUFFER: z.coerce.number().int().min(1).max(100_000).default(1000),
  DB_SCHEMA_FILE: z.string().optional().default('../docker/mysql/init/01-schema.sql'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}