import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { AppContext } from './api/context.js';
import { loadConfig } from './config.js';
import { loadDatabaseSettings } from './config/database.js';
import { RuleStore } from './domain/rules-store.js';
import { SystemSimulation } from './domain/system.js';
import type { SimEventMap } from './engine/events.js';
import { EventBus } from './engine/eventBus.js';
import { SimulationEngine } from './engine/simulationEngine.js';
import { buildHttpServer } from './infra/httpServer.js';
import { DEFAULT_AI_POLICY, type AiPolicy } from './domain/aiControl.js';
import { InferenceController } from './infra/ai/inferenceController.js';
import { InferenceService } from './infra/ai/inferenceService.js';
import { InferenceWorker } from './infra/ai/inferenceWorker.js';
import { Database } from './infra/database.js';
import { LogStore } from './infra/logger.js';
import { MemoryPersistence } from './infra/persistence.js';
import { loadRulesFromFile, saveRulesToFile } from './infra/rulesLoader.js';
import { attachSockets } from './infra/sockets.js';
import { TimeSeriesSink } from './infra/timeseriesSink.js';

const config = loadConfig();
const persistence = new MemoryPersistence();

const system = new SystemSimulation({
  initialNodes: config.INITIAL_NODES,
  initialTemp: config.INITIAL_TEMP,
  targetTemp: config.TARGET_TEMP,
  ambientTemp: config.AMBIENT_TEMP,
  queueCapacity: config.NODE_QUEUE_CAPACITY,
  stackCapacity: config.STACK_CAPACITY,
  maxConsecutiveFailures: config.MAX_CONSECUTIVE_FAILURES,
  poolCapacity: config.PENDING_POOL_CAPACITY,
});

const rules = new RuleStore(loadRulesFromFile(config.RULES_FILE));
rules.onChange = () => {
  saveRulesToFile(config.RULES_FILE, rules.list());
};
const logs = new LogStore(config.LOG_CAPACITY, config.LOG_FILE, {
  console: config.LOG_CONSOLE,
  level: config.LOG_LEVEL,
});
const bus = new EventBus<SimEventMap>();
const database = config.DB_ENABLED ? Database.open(loadDatabaseSettings(config)) : null;
const sink =
  database === null
    ? null
    : new TimeSeriesSink(
        {
          database,
          flushMs: config.DB_FLUSH_MS,
          maxBuffer: config.DB_MAX_BUFFER,
          schemaFile: config.DB_SCHEMA_FILE,
          onError: (message) => logs.add('critical', 'system', message),
        },
        bus,
      );
if (database !== null) {
  void database.ensureSchema(config.DB_SCHEMA_FILE).catch((error: unknown) => {
    logs.add(
      'critical',
      'system',
      `No se pudo inicializar el esquema BD: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}
const engine = new SimulationEngine({ system, rules, logs, bus }, config.TICK_MS, config.LOG_TELEMETRY_EVERY);

const aiPolicy: AiPolicy = {
  ...DEFAULT_AI_POLICY,
  hotDelta: config.AI_CONTROL_HOT_DELTA,
  coldDelta: config.AI_CONTROL_COLD_DELTA,
  restoreDelta: config.AI_CONTROL_RESTORE_DELTA,
  confirmations: config.AI_CONTROL_CONFIRMATIONS,
  cooldownMs: config.AI_CONTROL_COOLDOWN_MS,
  maxActionsPerMinute: config.AI_CONTROL_MAX_ACTIONS_PER_MIN,
  loadStep: config.AI_CONTROL_LOAD_STEP,
  loadMin: config.AI_CONTROL_LOAD_MIN,
  loadMax: config.AI_CONTROL_LOAD_MAX,
  targetMargin: config.AI_CONTROL_TARGET_MARGIN,
  targetStep: config.AI_CONTROL_TARGET_STEP,
  taskIntervalMs: config.AI_CONTROL_TASK_INTERVAL_MS,
  emergencyDelta: config.AI_CONTROL_EMERGENCY_DELTA,
  manualPauseMs: config.AI_CONTROL_MANUAL_PAUSE_MS,
  restartDelta: config.AI_CONTROL_RESTART_DELTA,
  minDowntimeMs: config.AI_CONTROL_MIN_DOWNTIME_MS,
  allowFan: config.AI_CONTROL_ALLOW_FAN,
  allowLoad: config.AI_CONTROL_ALLOW_LOAD,
  allowTarget: config.AI_CONTROL_ALLOW_TARGET,
  allowTasks: config.AI_CONTROL_ALLOW_TASKS,
  allowShutdown: config.AI_CONTROL_ALLOW_SHUTDOWN,
};

let inference: InferenceService | null = null;
let aiControl: InferenceController | null = null;
const inferenceWorker = config.INFERENCE_ENABLED
  ? new InferenceWorker({
      python: config.INFERENCE_PYTHON,
      timeoutMs: config.INFERENCE_TIMEOUT_MS,
      onError: (message) => logs.add('warning', 'system', message),
    })
  : null;
if (inferenceWorker !== null) {
  inference = new InferenceService(inferenceWorker, bus, {
    horizonMs: config.INFERENCE_HORIZON_MS,
    throttleMs: config.INFERENCE_THROTTLE_MS,
    minSamples: config.INFERENCE_MIN_SAMPLES,
    window: config.INFERENCE_WINDOW,
    onWarn: (message) => logs.add('warning', 'system', message),
  });
  inference.start();
  inferenceWorker.start();
  void inferenceWorker.version().then((info) => {
    if (info.version !== undefined) {
      logs.add('info', 'system', `Modelo de IA cargado (versión ${info.version})`);
    }
  });
  aiControl = new InferenceController(system, bus, logs, {
    enabled: config.AI_CONTROL_ENABLED,
    policy: aiPolicy,
  });
  aiControl.start();
  if (config.AI_CONTROL_ENABLED) {
    logs.add('warning', 'ai', 'Control automático de IA activado al arrancar');
  }
}

const ctx: AppContext = {
  system,
  rules,
  logs,
  engine,
  bus,
  inference: inference ?? undefined,
  aiControl: aiControl ?? undefined,
};

const app = buildHttpServer(ctx, config.CORS_ORIGIN, config.LOG_HTTP);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});
attachSockets(io, bus);

httpServer.listen(config.PORT, () => {
  logs.add(
    'info',
    'system',
    `Backend WAItt escuchando en http://localhost:${config.PORT} (CORS: ${config.CORS_ORIGIN})`,
  );
  logs.add(
    'info',
    'system',
    `Estado inicial: ${config.INITIAL_NODES} nodos + 1 general, ${rules.count()} reglas reactivas`,
  );
  engine.start();
});

const shutdown = async (signal: string): Promise<void> => {
  engine.stop();
  aiControl?.stop();
  inference?.stop();
  if (sink !== null) {
    await sink.close();
  }
  if (database !== null) {
    await database.close();
  }
  persistence.save(system.getSnapshot());
  logs.add('info', 'system', `Detenido por ${signal}. Snapshot guardado.`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));