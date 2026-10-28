import { describe, expect, it } from 'vitest';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import type { RuleInput } from '../src/domain/types.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { RuleTriggeredPayload, SimEventMap } from '../src/engine/events.js';
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

function buildEngine(telemetryLogEvery = 0): {
  engine: SimulationEngine;
  logs: LogStore;
  bus: EventBus<SimEventMap>;
  rules: RuleStore;
  system: SystemSimulation;
} {
  const system = new SystemSimulation(seed);
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const deps: EngineDeps = { system, rules, logs, bus };
  return { engine: new SimulationEngine(deps, 1000, telemetryLogEvery), logs, bus, rules, system };
}

const predictionRule = (patch: Partial<RuleInput> = {}): RuleInput => ({
  name: 'Predicción caliente',
  enabled: true,
  cooldownMs: 0,
  subject: 'node',
  nodeId: 'node-1',
  metric: 'predictedDelta',
  op: '>',
  value: 1,
  action: 'fan_on',
  actionParams: { minutes: 1 },
  ...patch,
});

const prediction = (at: number, predictedTemp = 35) => ({
  nodeId: 'node-1',
  predictedTemp,
  actualTemp: 30,
  horizonMs: 15_000,
  modelVersion: 'test',
  latencyMs: 1,
  at,
});

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

describe('SimulationEngine reglas con inferencia', () => {
  it('dispara con la última inferencia y emite rule:triggered', () => {
    const { engine, bus, rules, system } = buildEngine();
    const triggered: RuleTriggeredPayload[] = [];
    bus.on('rule:triggered', (payload) => triggered.push(payload));
    rules.add(predictionRule());
    bus.emit('inference:completed', prediction(Date.now()));

    advanceSteps(engine, 1);

    expect(system.getNode('node-1')?.fanActive).toBe(true);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]).toMatchObject({
      nodeId: 'node-1',
      action: 'fan_on',
      applied: true,
    });
  });

  it('registra el resultado de una tarea enviada al pool', () => {
    const { engine, bus, rules, system } = buildEngine();
    const triggered: RuleTriggeredPayload[] = [];
    bus.on('rule:triggered', (payload) => triggered.push(payload));
    rules.add(
      predictionRule({
        subject: 'any',
        nodeId: undefined,
        metric: 'temperature',
        op: '>',
        value: 55,
        action: 'enqueue_task',
        actionParams: { taskType: 'cooldown', durationSecs: 1 },
      }),
    );
    system.getNode('node-1')!.currentTemp = 60;

    advanceSteps(engine, 1);

    expect(triggered).toHaveLength(1);
    expect(triggered[0]).toMatchObject({
      action: 'enqueue_task',
      applied: true,
    });
    expect(triggered[0].taskId).toBeTruthy();
  });

  it('ignora predicciones más viejas que el TTL', () => {
    const { engine, bus, rules, system } = buildEngine();
    const triggered: RuleTriggeredPayload[] = [];
    bus.on('rule:triggered', (payload) => triggered.push(payload));
    rules.add(predictionRule());
    bus.emit('inference:completed', prediction(Date.now() - 61_000));

    advanceSteps(engine, 1);

    expect(system.getNode('node-1')?.fanActive).toBe(false);
    expect(triggered).toHaveLength(0);
  });

  it('no dispara una comparación != sin predicción', () => {
    const { engine, bus, rules, system } = buildEngine();
    const triggered: RuleTriggeredPayload[] = [];
    bus.on('rule:triggered', (payload) => triggered.push(payload));
    rules.add(predictionRule({ metric: 'predictedTemperature', op: '!=', value: 30 }));

    advanceSteps(engine, 1);

    expect(system.getNode('node-1')?.fanActive).toBe(false);
    expect(triggered).toHaveLength(0);
  });
});