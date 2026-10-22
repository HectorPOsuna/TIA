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
  INFERENCE_ENABLED: boolFromEnv(true),
  INFERENCE_HORIZON_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  INFERENCE_THROTTLE_MS: z.coerce.number().int().min(100).max(60_000).default(500),
  INFERENCE_TIMEOUT_MS: z.coerce.number().int().min(50).max(60_000).default(2000),
  INFERENCE_MIN_SAMPLES: z.coerce.number().int().min(2).max(100).default(9),
  INFERENCE_WINDOW: z.coerce.number().int().min(5).max(500).default(25),
  INFERENCE_PYTHON: z.string().optional().default('ml/.venv/Scripts/python.exe'),
  AI_CONTROL_ENABLED: boolFromEnv(false),
  AI_CONTROL_HOT_DELTA: z.coerce.number().min(0.1).max(20).default(1.5),
  AI_CONTROL_COLD_DELTA: z.coerce.number().min(0.1).max(20).default(1.5),
  AI_CONTROL_RESTORE_DELTA: z.coerce.number().min(0).max(20).default(0.5),
  AI_CONTROL_CONFIRMATIONS: z.coerce.number().int().min(1).max(20).default(2),
  AI_CONTROL_COOLDOWN_MS: z.coerce.number().int().min(100).max(300_000).default(5000),
  AI_CONTROL_MAX_ACTIONS_PER_MIN: z.coerce.number().int().min(1).max(600).default(20),
  AI_CONTROL_LOAD_STEP: z.coerce.number().min(0.01).max(1).default(0.1),
  AI_CONTROL_LOAD_MIN: z.coerce.number().min(0).max(1).default(0.05),
  AI_CONTROL_LOAD_MAX: z.coerce.number().min(0).max(1).default(0.8),
  AI_CONTROL_TARGET_MARGIN: z.coerce.number().min(0).max(1.5).default(1.5),
  AI_CONTROL_TARGET_STEP: z.coerce.number().min(0.1).max(5).default(0.5),
  AI_CONTROL_TASK_INTERVAL_MS: z.coerce.number().int().min(1000).max(300_000).default(15_000),
  AI_CONTROL_EMERGENCY_DELTA: z.coerce.number().min(1).max(50).default(10),
  AI_CONTROL_MANUAL_PAUSE_MS: z.coerce.number().int().min(0).max(600_000).default(30_000),
  AI_CONTROL_RESTART_DELTA: z.coerce.number().min(0).max(20).default(2),
  AI_CONTROL_MIN_DOWNTIME_MS: z.coerce.number().int().min(0).max(600_000).default(30_000),
  AI_CONTROL_ALLOW_FAN: boolFromEnv(true),
  AI_CONTROL_ALLOW_LOAD: boolFromEnv(true),
  AI_CONTROL_ALLOW_TARGET: boolFromEnv(true),
  AI_CONTROL_ALLOW_TASKS: boolFromEnv(true),
  AI_CONTROL_ALLOW_SHUTDOWN: boolFromEnv(false),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}