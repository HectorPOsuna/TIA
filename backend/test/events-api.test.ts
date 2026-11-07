import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { buildHttpServer } from '../src/infra/httpServer.js';
import { LogStore } from '../src/infra/logger.js';

const servers: Server[] = [];

const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 10,
};

async function start() {
  const system = new SystemSimulation(seed);
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const events = new EventEngine(system, bus, logs, {
    enabled: false,
    intervalMs: 5000,
    probabilities: {},
  });
  const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000, 0);
  const app = buildHttpServer({ system, rules, logs, engine, bus, events }, 'http://localhost:5173', false);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, system, events };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe('API de eventos', () => {
  it('GET devuelve catálogo y generador', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/api/events`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      generator: { enabled: boolean; intervalMs: number };
      events: unknown[];
    };
    expect(body.generator.enabled).toBe(false);
    expect(body.events).toHaveLength(7);
  });

  it('rechaza configuración inválida', async () => {
    const { base } = await start();
    const patch = await fetch(`${base}/api/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalMs: 10 }),
    });
    expect(patch.status).toBe(400);
    const probability = await fetch(`${base}/api/events/task_arrival`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probability: 1.5 }),
    });
    expect(probability.status).toBe(400);
  });

  it('devuelve 404 para evento o nodo inexistente y 400 para el general', async () => {
    const { base } = await start();
    const unknown = await fetch(`${base}/api/events/no-existe/trigger`, { method: 'POST' });
    expect(unknown.status).toBe(404);
    const node = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-99' }),
    });
    expect(node.status).toBe(404);
    const general = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-general' }),
    });
    expect(general.status).toBe(400);
  });

  it('dispara manualmente aunque el generador esté apagado', async () => {
    const { base, system } = await start();
    const res = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-1', params: { magnitude: 4 } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      event: { eventId: string; source: string; applied: boolean };
    };
    expect(body.event).toMatchObject({
      eventId: 'thermal_spike',
      source: 'manual',
      applied: true,
    });
    expect(system.getNode('node-1')?.currentTemp).toBe(29);
  });

  it('task_arrival manual encola en el pool', async () => {
    const { base, system } = await start();
    const res = await fetch(`${base}/api/events/task_arrival/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: { count: 2 } }),
    });
    expect(res.status).toBe(200);
    expect(system.pendingPool.size).toBe(2);
  });

  it('permite activar el generador y ajustar un evento', async () => {
    const { base } = await start();
    const generator = await fetch(`${base}/api/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, intervalMs: 2000 }),
    });
    expect(generator.status).toBe(200);
    const generatorBody = (await generator.json()) as {
      generator: { enabled: boolean; intervalMs: number };
    };
    expect(generatorBody.generator).toEqual({ enabled: true, intervalMs: 2000 });
    const event = await fetch(`${base}/api/events/thermal_spike`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probability: 0.5, cooldownMs: 100 }),
    });
    expect(event.status).toBe(200);
    const eventBody = (await event.json()) as {
      event: { probability: number; cooldownMs: number };
    };
    expect(eventBody.event).toMatchObject({ probability: 0.5, cooldownMs: 100 });
  });
});
