import { describe, expect, it } from 'vitest';
import { EVENT_CATALOG, EVENT_IDS, applyEvent } from '../src/domain/events.js';
import { SystemSimulation } from '../src/domain/system.js';

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
