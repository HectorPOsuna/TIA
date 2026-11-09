import { describe, expect, it } from 'vitest';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { LogStore } from '../src/infra/logger.js';

const TICK_BUDGET_MS = 500;
const TICKS = 1000;

const seed = (initialNodes: number) => ({
  initialNodes,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 50,
  stackCapacity: 20,
  maxConsecutiveFailures: 5,
  poolCapacity: 100,
});

function buildEngine(initialNodes: number, events?: EventEngine) {
  const system = new SystemSimulation(seed(initialNodes));
  system.running = false;
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000);
  return { engine, system, bus, logs };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

describe('pruebas de estrés', () => {
  it.each([10, 50, 100, 200])(
    'mantiene el tick bajo presupuesto con %i nodos',
    (initialNodes) => {
      const { engine } = buildEngine(initialNodes);
      const durations: number[] = [];

      for (let i = 0; i < TICKS; i += 1) {
        const startedAt = performance.now();
        engine.stepOnce();
        durations.push(performance.now() - startedAt);
      }

      const p95 = percentile(durations, 0.95);
      expect(p95).toBeLessThan(TICK_BUDGET_MS);
    },
    120_000,
  );

  it('mantiene acotada la cola local bajo saturación', () => {
    const system = new SystemSimulation({ ...seed(1), queueCapacity: 10 });
    const node = system.workers[0];
    let accepted = 0;

    for (let i = 0; i < 100; i += 1) {
      const result = node.enqueueTask({
        type: 'custom',
        priority: 3,
        computeDemand: 1,
        durationSecs: 1,
      });
      if (result.task !== null) {
        accepted += 1;
      }
    }

    expect(accepted).toBe(10);
    expect(node.queueSize).toBe(10);
  });

  it('mantiene acotado el pool global bajo saturación', () => {
    const system = new SystemSimulation({ ...seed(1), poolCapacity: 10 });
    let accepted = 0;

    for (let i = 0; i < 100; i += 1) {
      const task = system.submitPending({
        type: 'custom',
        priority: 3,
        computeDemand: 1,
        durationSecs: 1,
      });
      if (task !== null) {
        accepted += 1;
      }
    }

    expect(accepted).toBe(10);
    expect(system.pendingSnapshot().size).toBe(10);
  });

  it('soporta una ráfaga de eventos sin romper el tick', () => {
    let clock = 1_700_000_000_000;
    const system = new SystemSimulation(seed(10));
    system.running = false;
    const rules = new RuleStore([]);
    const logs = new LogStore(100);
    const bus = new EventBus<SimEventMap>();
    const triggered: unknown[] = [];
    bus.on('event:triggered', (payload) => triggered.push(payload));
    const events = new EventEngine(system, bus, logs, {
      enabled: true,
      intervalMs: 1000,
      probabilities: {
        task_arrival: 1,
        thermal_spike: 1,
        node_failure: 1,
        node_recovery: 1,
        fan_failure: 1,
        workload_surge: 1,
        synthetic_alert: 1,
      },
      rng: () => 0,
      now: () => clock,
      recentLimit: 50,
    });
    const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000);

    for (let i = 0; i < 500; i += 1) {
      clock += 1000;
      engine.stepOnce();
    }

    expect(triggered.length).toBeGreaterThan(0);
    expect(triggered.length).toBeLessThanOrEqual(500 * 7);
  });
});
