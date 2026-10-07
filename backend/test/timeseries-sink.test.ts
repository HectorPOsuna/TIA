import { afterEach, describe, expect, it } from 'vitest';
import type { NodeDto, TaskDto } from '../src/domain/types.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { SimEventMap } from '../src/engine/events.js';
import { Database } from '../src/infra/database.js';
import { TimeSeriesSink } from '../src/infra/timeseriesSink.js';
import { RecorderDriver } from './dbDriver.js';

const sinks: TimeSeriesSink[] = [];

function makeNode(overrides: Partial<NodeDto> = {}): NodeDto {
  return {
    id: 'node-1',
    name: 'Servidor 1',
    type: 'worker',
    status: 'active',
    currentTemp: 26.5,
    targetTemp: 30,
    ambientTemp: 20,
    workload: 0.3,
    fanActive: false,
    fanUntilMs: 0,
    stats: {
      failures: 0,
      consecutiveFailures: 0,
      maxConsecutiveFailures: 5,
      ok: true,
    },
    queue: { list: [], size: 0, capacity: 50, remaining: 50, processing: [] },
    stack: { list: [], size: 0, capacity: 20 },
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 'task-1',
    type: 'cooldown',
    priority: 4,
    computeDemand: 2,
    durationSecs: 5,
    status: 'pending',
    enqueuedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeSink(
  bus: EventBus<SimEventMap>,
  options: { maxBuffer?: number; onError?: () => void } = {},
  driver: RecorderDriver = new RecorderDriver(),
): { sink: TimeSeriesSink; driver: RecorderDriver } {
  const database = Database.forDriver(driver);
  const sink = new TimeSeriesSink(
    {
      database,
      flushMs: 10,
      maxBuffer: options.maxBuffer ?? 10,
      schemaFile: null,
      onError: options.onError,
    },
    bus,
  );
  sinks.push(sink);
  return { sink, driver };
}

async function flushSettle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

afterEach(async () => {
  while (sinks.length > 0) {
    const sink = sinks.pop() as TimeSeriesSink;
    await sink.close();
  }
});

describe('TimeSeriesSink telemetría', () => {
  it('mapea node:updated a filas de telemetry', async () => {
    const bus = new EventBus<SimEventMap>();
    const { driver } = makeSink(bus);

    const fanNode = makeNode({
      fanActive: true,
      queue: { list: [], size: 3, capacity: 50, remaining: 47, processing: [] },
      stack: { list: [], size: 2, capacity: 20 },
    });
    bus.emit('node:updated', { nodeId: fanNode.id, node: fanNode });
    bus.emit('node:updated', { nodeId: makeNode().id, node: makeNode() });
    await flushSettle();

    expect(driver.calls).toHaveLength(1);
    expect(driver.calls[0].sql).toMatch(/^INSERT INTO `telemetry`/);
    expect(driver.calls[0].sql).not.toContain('VALUES VALUES');
    expect(driver.calls[0].sql).toContain(
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const params = driver.calls[0].params as unknown[];
    expect(params).toHaveLength(2 * 11);
    expect(params.slice(0, 11)).toEqual([
      1_700_000_000_000,
      'node-1',
      'worker',
      26.5,
      30,
      20,
      0.3,
      0,
      1,
      3,
      2,
    ]);
  });
});

describe('TimeSeriesSink eventos', () => {
  it('mapea alert, rule:triggered y tareas a filas de events', async () => {
    const bus = new EventBus<SimEventMap>();
    const { driver } = makeSink(bus, { maxBuffer: 2 });

    bus.emit('alert', {
      level: 'critical',
      message: 'Temperatura crítica',
      nodeId: 'node-2',
      at: 1_700_000_000_001,
    });
    bus.emit('rule:triggered', {
      rule: {
        id: 'rule-1',
        name: 'Alto térmico',
        enabled: true,
        cooldownMs: 60_000,
        subject: 'node',
        nodeId: 'node-2',
        metric: 'temperature',
        op: '>',
        value: 40,
        action: 'send_alert',
        triggerCount: 1,
      },
      nodeId: 'node-2',
      at: 1_700_000_000_002,
    });
    bus.emit('task:pending', { task: makeTask() });
    await flushSettle();

    const events = driver.calls.filter((call) => call.sql.startsWith('INSERT INTO `events`'));
    expect(events).toHaveLength(1);
    const params = events[0].params as unknown[];
    expect(params).toHaveLength(3 * 7);
    expect(params.slice(0, 7)).toEqual([
      1_700_000_000_001,
      'node-2',
      'alert',
      'alert',
      'critical',
      'Temperatura crítica',
      null,
    ]);
    expect(params.slice(7, 14)[3]).toBe('rule');
    expect(params.slice(14, 21)[2]).toBe('task');
    expect(JSON.parse(params[20] as string)).toMatchObject({ taskId: 'task-1' });
  });
});

describe('TimeSeriesSink errores', () => {
  it('no lanza cuando la base de datos falla', async () => {
    const bus = new EventBus<SimEventMap>();
    let reported = 0;
    const driver = new RecorderDriver();
    driver.executeError = new Error('conexión rechazada');
    const { sink } = makeSink(
      bus,
      {
        maxBuffer: 1,
        onError: () => {
          reported += 1;
        },
      },
      driver,
    );

    bus.emit('node:updated', { nodeId: 'node-1', node: makeNode() });
    await flushSettle();

    expect(reported).toBeGreaterThan(0);
    expect(sink.pendingRows).toBe(0);
  });
});