import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import type { RuleInput } from '../src/domain/types.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { RuleTriggeredPayload, SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { LogStore } from '../src/infra/logger.js';

const seed = (initialNodes = 1) => ({
  initialNodes,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 50,
  stackCapacity: 20,
  maxConsecutiveFailures: 5,
  poolCapacity: 100,
});

function rule(overrides: Partial<RuleInput>): RuleInput {
  return {
    name: 'regla',
    enabled: true,
    cooldownMs: 0,
    subject: 'any',
    metric: 'temperature',
    op: '>',
    value: 20,
    action: 'fan_on',
    ...overrides,
  };
}

function buildEngine(rules: RuleInput[], system = new SystemSimulation(seed())) {
  system.running = false;
  const store = new RuleStore(rules);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const triggered: RuleTriggeredPayload[] = [];
  bus.on('rule:triggered', (payload) => triggered.push(payload));
  const engine = new SimulationEngine({ system, rules: store, logs, bus }, 1000);
  return { engine, system, store, triggered };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('reglas en conflicto', () => {
  it('aplica el orden de evaluación de forma determinista', () => {
    const { engine, system, store } = buildEngine([
      rule({ name: 'encender', action: 'fan_on' }),
      rule({ name: 'apagar', action: 'fan_off' }),
    ]);

    for (let i = 0; i < 500; i += 1) {
      engine.stepOnce();
    }

    expect(system.workers[0].fanActive).toBe(false);
    expect(store.list().map((r) => r.triggerCount)).toEqual([500, 500]);
    expect(Number.isFinite(system.workers[0].currentTemp)).toBe(true);
  });

  it('respeta el cooldown entre disparos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { engine, store } = buildEngine([
      rule({ name: 'ventilar', action: 'fan_on', cooldownMs: 5000 }),
    ]);

    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(1000);
      engine.stepOnce();
    }

    expect(store.list()[0].triggerCount).toBe(4);
  });

  it('no desborda el pool cuando dos reglas encolan tareas', () => {
    const system = new SystemSimulation({ ...seed(), poolCapacity: 5 });
    system.workers[0].status = 'inactive';
    const { engine, triggered } = buildEngine(
      [
        rule({ name: 'tarea A', action: 'enqueue_task' }),
        rule({ name: 'tarea B', action: 'enqueue_task' }),
      ],
      system,
    );

    for (let i = 0; i < 100; i += 1) {
      engine.stepOnce();
    }

    expect(system.pendingSnapshot().size).toBeLessThanOrEqual(5);
    expect(triggered.some((event) => event.applied === false)).toBe(true);
  });
});
