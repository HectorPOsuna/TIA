import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { AppContext } from './api/context.js';
import { loadConfig } from './config.js';
import { RuleStore } from './domain/rules-store.js';
import { SystemSimulation } from './domain/system.js';
import type { SimEventMap } from './engine/events.js';
import { EventBus } from './engine/eventBus.js';
import { SimulationEngine } from './engine/simulationEngine.js';
import { buildHttpServer } from './infra/httpServer.js';
import { LogStore } from './infra/logger.js';
import { MemoryPersistence } from './infra/persistence.js';
import { loadRulesFromFile } from './infra/rulesLoader.js';
import { attachSockets } from './infra/sockets.js';

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
});

const rules = new RuleStore(loadRulesFromFile(config.RULES_FILE));
const logs = new LogStore(config.LOG_CAPACITY);
const bus = new EventBus<SimEventMap>();
const engine = new SimulationEngine({ system, rules, logs, bus }, config.TICK_MS);

const ctx: AppContext = { system, rules, logs, engine, bus };

const app = buildHttpServer(ctx, config.CORS_ORIGIN);
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

const shutdown = (signal: string): void => {
  engine.stop();
  persistence.save(system.getSnapshot());
  logs.add('info', 'system', `Detenido por ${signal}. Snapshot guardado.`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));