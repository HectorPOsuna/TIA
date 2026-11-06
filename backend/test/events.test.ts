import { describe, expect, it } from 'vitest';
import { EVENT_CATALOG, EVENT_IDS, applyEvent } from '../src/domain/events.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { LogStore } from '../src/infra/logger.js';

const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 3,
};

const now = 1_700_000_000_000;
const rng = (value = 0) => () => value;
const makeSystem = (overrides: Partial<typeof seed> = {}) =>
  new SystemSimulation({ ...seed, ...overrides });

const zeroProbabilities = {
  task_arrival: 0,
  thermal_spike: 0,
  node_failure: 0,
  node_recovery: 0,
  fan_failure: 0,
  workload_surge: 0,
  synthetic_alert: 0,
};

function makeEngine(overrides: Partial<{
  enabled: boolean;
  intervalMs: number;
  probabilities: typeof zeroProbabilities;
  rng: () => number;
  now: () => number;
  recentLimit: number;
}> = {}) {
  const system = makeSystem();
  const bus = new EventBus<SimEventMap>();
  const logs = new LogStore(100);
  let clock = now;
  const engine = new EventEngine(system, bus, logs, {
    enabled: true,
    intervalMs: 1000,
    probabilities: zeroProbabilities,
    rng: rng(),
    now: () => clock,
    recentLimit: 2,
    ...overrides,
  });
  return {
    system,
    bus,
    logs,
    engine,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('catálogo de eventos', () => {
  it('define los siete eventos con valores válidos', () => {
    expect(EVENT_CATALOG.map((event) => event.id)).toEqual([...EVENT_IDS]);
    expect(EVENT_IDS).toEqual([
      'task_arrival',
      'thermal_spike',
      'node_failure',
      'node_recovery',
      'fan_failure',
      'workload_surge',
      'synthetic_alert',
    ]);
    for (const event of EVENT_CATALOG) {
      expect(event.defaultProbability).toBeGreaterThanOrEqual(0);
      expect(event.defaultProbability).toBeLessThanOrEqual(1);
      expect(event.defaultCooldownMs).toBeGreaterThanOrEqual(0);
      expect(event.defaultParams).toBeTypeOf('object');
    }
  });
});

describe('applyEvent', () => {
  it('task_arrival encola en el pool y respeta count', () => {
    const system = makeSystem();
    const outcome = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 2 } },
    });
    expect(outcome.applied).toBe(true);
    expect(outcome.taskIds).toHaveLength(2);
    expect(system.pendingPool.size).toBe(2);
  });

  it('task_arrival automático elige un count aleatorio de 1 a 3', () => {
    const system = makeSystem();
    const outcome = applyEvent('task_arrival', { system, now, rng: rng(0.9) });
    expect(outcome.applied).toBe(true);
    expect(outcome.taskIds).toHaveLength(3);
    expect(outcome.params).toMatchObject({ count: 3 });
    expect(system.pendingPool.size).toBe(3);
  });

  it('task_arrival con nodeId encola en la cola local', () => {
    const system = makeSystem();
    const outcome = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { count: 1 } },
    });
    expect(outcome.applied).toBe(true);
    expect(system.getNode('node-1')?.queueSnapshot().size).toBe(1);
    expect(system.pendingPool.size).toBe(0);
  });

  it('task_arrival parcial con pool lleno y fallo total después', () => {
    const system = makeSystem({ poolCapacity: 1 });
    const first = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 3 } },
    });
    expect(first.applied).toBe(true);
    expect(first.taskIds).toHaveLength(1);
    expect(first.message).toContain('2');
    const second = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 1 } },
    });
    expect(second.applied).toBe(false);
  });

  it('thermal_spike suma magnitud y respeta el clamp', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    const outcome = applyEvent('thermal_spike', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 6 } },
    });
    expect(outcome.applied).toBe(true);
    expect(node.currentTemp).toBe(31);
    node.currentTemp = 150;
    const clamped = applyEvent('thermal_spike', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 6 } },
    });
    expect(clamped.applied).toBe(false);
  });

  it('node_failure deja stats.ok=false sin cancelar la tarea actual', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    node.enqueueTask({ type: 'custom', durationSecs: 10 });
    node.startNextTask();
    const outcome = applyEvent('node_failure', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(outcome.applied).toBe(true);
    expect(node.status).toBe('error');
    expect(node.toDto().stats.ok).toBe(false);
    expect(node.processingTask).not.toBeNull();
  });

  it('node_failure apila un evento en la pila del nodo', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    applyEvent('node_failure', { system, now, rng: rng(), request: { nodeId: 'node-1' } });
    expect(node.getStackEntries().some((entry) => entry.kind === 'event')).toBe(true);
  });

  it('node_recovery reactiva y limpia fallos', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    applyEvent('node_failure', { system, now, rng: rng(), request: { nodeId: 'node-1' } });
    const outcome = applyEvent('node_recovery', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(outcome.applied).toBe(true);
    expect(node.status).toBe('active');
    expect(node.toDto().stats.ok).toBe(true);
    expect(node.toDto().stats.consecutiveFailures).toBe(0);
  });

  it('fan_failure apaga el ventilador y workload_surge sube la carga', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    node.fanActive = true;
    const fan = applyEvent('fan_failure', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(fan.applied).toBe(true);
    expect(node.fanActive).toBe(false);
    node.workload = 0.3;
    const load = applyEvent('workload_surge', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 0.35 } },
    });
    expect(load.applied).toBe(true);
    expect(node.workload).toBeCloseTo(0.65);
  });

  it('synthetic_alert no muta el nodo y devuelve parámetros efectivos', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    const before = node.currentTemp;
    const outcome = applyEvent('synthetic_alert', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { message: 'Prueba', level: 'warning' } },
    });
    expect(outcome.applied).toBe(true);
    expect(outcome.params).toMatchObject({ message: 'Prueba', level: 'warning' });
    expect(node.currentTemp).toBe(before);
  });

  it('sin workers elegibles o con nodo general devuelve applied=false', () => {
    const empty = makeSystem({ initialNodes: 0 });
    expect(
      applyEvent('thermal_spike', { system: empty, now, rng: rng() }).applied,
    ).toBe(false);
    const system = makeSystem();
    expect(
      applyEvent('thermal_spike', {
        system,
        now,
        rng: rng(),
        request: { nodeId: 'node-general' },
      }).applied,
    ).toBe(false);
  });
});

describe('EventEngine automático', () => {
  it('no dispara con el generador apagado', () => {
    const { engine } = makeEngine({ enabled: false, probabilities: { ...zeroProbabilities, task_arrival: 1 } });
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(0);
  });

  it('dispara por probabilidad y respeta cooldown', () => {
    const { engine, advance, system } = makeEngine({
      probabilities: { ...zeroProbabilities, task_arrival: 1 },
    });
    engine.step(1000);
    expect(system.pendingPool.size).toBeGreaterThan(0);
    expect(engine.state.recent).toHaveLength(1);
    advance(1000);
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(1);
    advance(2000);
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(2);
  });

  it('un disparo fallido consume cooldown y contador', () => {
    const { engine, system } = makeEngine({
      probabilities: { ...zeroProbabilities, task_arrival: 1 },
    });
    system.submitPending({ type: 'custom' });
    system.submitPending({ type: 'custom' });
    system.submitPending({ type: 'custom' });
    engine.step(1000);
    const runtime = engine.state.events.find((event) => event.id === 'task_arrival')!;
    expect(runtime.triggerCount).toBe(1);
    expect(engine.state.recent[0].applied).toBe(false);
  });

  it('el disparo manual salta enabled, probabilidad y cooldown', () => {
    const { engine, system } = makeEngine({
      enabled: false,
      probabilities: { ...zeroProbabilities, thermal_spike: 0 },
    });
    const payload = engine.trigger('thermal_spike', {
      nodeId: 'node-1',
      params: { magnitude: 4 },
    });
    expect(payload.applied).toBe(true);
    expect(payload.source).toBe('manual');
    expect(system.getNode('node-1')?.currentTemp).toBe(29);
  });

  it('emite alert además de event:triggered para synthetic_alert', () => {
    const { engine, bus } = makeEngine();
    const alerts: unknown[] = [];
    bus.on('alert', (payload) => alerts.push(payload));
    engine.trigger('synthetic_alert', { nodeId: 'node-1', params: { message: 'Prueba' } });
    expect(alerts).toHaveLength(1);
  });

  it('recorta el feed reciente y resetRuntime limpia contadores', () => {
    const { engine } = makeEngine();
    engine.trigger('thermal_spike', { nodeId: 'node-1' });
    engine.trigger('thermal_spike', { nodeId: 'node-2' });
    engine.trigger('thermal_spike', { nodeId: 'node-1' });
    expect(engine.state.recent).toHaveLength(2);
    engine.resetRuntime();
    expect(engine.state.recent).toHaveLength(0);
    expect(engine.state.events.every((event) => event.triggerCount === 0)).toBe(true);
  });
});

describe('EventEngine configuración', () => {
  it('permite ajustar generador y evento en caliente', () => {
    const { engine } = makeEngine();
    engine.patchGenerator({ enabled: true, intervalMs: 2000 });
    const updated = engine.patchEvent('thermal_spike', { probability: 0.5, cooldownMs: 100 });
    expect(engine.state.generator).toMatchObject({ enabled: true, intervalMs: 2000 });
    expect(updated).toMatchObject({ probability: 0.5, cooldownMs: 100 });
  });
});
