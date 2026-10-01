import { describe, expect, it } from 'vitest';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine, type EngineDeps } from '../src/engine/simulationEngine.js';
import { LogStore } from '../src/infra/logger.js';

const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 20,
};

function buildEngine(telemetryLogEvery = 0): { engine: SimulationEngine; logs: LogStore } {
  const system = new SystemSimulation(seed);
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const deps: EngineDeps = { system, rules, logs, bus };
  return { engine: new SimulationEngine(deps, 1000, telemetryLogEvery), logs };
}

function advanceSteps(engine: SimulationEngine, steps: number): void {
  const stepper = engine as unknown as { step: (dt: number) => void };
  for (let i = 0; i < steps; i += 1) {
    stepper.step(1000);
  }
}

describe('SimulationEngine telemetría', () => {
  it('registra una línea cada N ticks con temps y media', () => {
    const { engine, logs } = buildEngine(2);
    advanceSteps(engine, 4);

    const telemetry = logs.list().filter((e) => e.message.startsWith('Telemetría'));
    expect(telemetry).toHaveLength(2);
    expect(telemetry[0].message).toContain('node-general');
    expect(telemetry[0].message).toContain('node-1');
    expect(telemetry[0].message).toContain('media');
  });

  it('no registra telemetría cuando telemetryLogEvery es 0', () => {
    const { engine, logs } = buildEngine(0);
    advanceSteps(engine, 4);

    expect(logs.all().some((e) => e.message.startsWith('Telemetría'))).toBe(false);
  });
});