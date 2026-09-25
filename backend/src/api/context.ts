import type { EventBus } from '../engine/eventBus.js';
import type { SimEventMap } from '../engine/events.js';
import type { SimulationEngine } from '../engine/simulationEngine.js';
import type { RuleStore } from '../domain/rules-store.js';
import type { SystemSimulation } from '../domain/system.js';
import type { LogStore } from '../infra/logger.js';

export interface AppContext {
  system: SystemSimulation;
  rules: RuleStore;
  logs: LogStore;
  engine: SimulationEngine;
  bus: EventBus<SimEventMap>;
}