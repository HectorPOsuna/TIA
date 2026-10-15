import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeDto, SystemSnapshotDto } from '../src/domain/types.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { InferencePayload, SimEventMap } from '../src/engine/events.js';
import { Database } from '../src/infra/database.js';
import type { InferenceWorker } from '../src/infra/ai/inferenceWorker.js';
import { InferenceService } from '../src/infra/ai/inferenceService.js';
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
    stats: { failures: 0, consecutiveFailures: 0, maxConsecutiveFailures: 5, ok: true },
    queue: { list: [], size: 0, capacity: 50, remaining: 50, processing: null },
    stack: { list: [], size: 0, capacity: 20 },
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SystemSnapshotDto> = {}): SystemSnapshotDto {
  return {
    ts: 1_700_000_000_000,
    running: true,
    targetTemp: 30,
    ambientTemp: 20,
    general: makeNode({ id: 'node-general', type: 'general', name: 'General' }),
    workers: [makeNode()],
    summary: { totalWorkers: 1, activeWorkers: 1, inactiveWorkers: 0, errorWorkers: 0, averageTemp: 26.5 },
    pendingQueue: { list: [], size: 0, capacity: 100, remaining: 100 },
    ...overrides,
  };
}

function makeFakeWorker(): {
  worker: InferenceWorker;
  predict: ReturnType<typeof vi.fn>;
  version: ReturnType<typeof vi.fn>;
} {
  const predict = vi.fn(async () => ({
    ok: true,
    predictedTemp: 27.8,
    modelVersion: 'sha-test',
    latencyMs: 4,
    featuresHash: 'deadbeef',
  }));
  const version = vi.fn(async () => ({ version: 'sha-test', meta: { horizon_ms: 15000 } }));
  const worker = { predict, version, stop: vi.fn(), start: vi.fn() } as unknown as InferenceWorker;
  return { worker, predict, version };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(async () => {
  while (sinks.length > 0) {
    const sink = sinks.pop() as TimeSeriesSink;
    await sink.close();
  }
});

describe('InferenceService', () => {
  it('infiere automáticamente al alcanzar la ventana mínima y emite inference:completed', async () => {
    const bus = new EventBus<SimEventMap>();
    const { worker, predict } = makeFakeWorker();
    const received: InferencePayload[] = [];
    bus.on('inference:completed', (payload) => received.push(payload));

    const service = new InferenceService(worker, bus, {
      horizonMs: 15000,
      throttleMs: 0,
      minSamples: 2,
      window: 5,
    });
    service.start();

    bus.emit('state:update', makeSnapshot());
    expect(predict).not.toHaveBeenCalled();
    bus.emit('state:update', makeSnapshot());
    await settle();

    expect(predict).toHaveBeenCalled();
    expect(received).toHaveLength(2);
    const worker1 = received.find((r) => r.nodeId === 'node-1');
    expect(worker1).toMatchObject({
      nodeId: 'node-1',
      predictedTemp: 27.8,
      actualTemp: 26.5,
      horizonMs: 15000,
      modelVersion: 'sha-test',
      latencyMs: 4,
      featuresHash: 'deadbeef',
    });
    service.stop();
  });

  it('respeta el throttle entre inferencias del mismo nodo', async () => {
    const bus = new EventBus<SimEventMap>();
    const { worker, predict } = makeFakeWorker();
    const service = new InferenceService(worker, bus, {
      horizonMs: 15000,
      throttleMs: 60_000,
      minSamples: 1,
      window: 5,
    });
    service.start();

    bus.emit('state:update', makeSnapshot());
    await settle();
    bus.emit('state:update', makeSnapshot());
    await settle();

    expect(predict).toHaveBeenCalledTimes(2);
    const calls = predict.mock.calls as Array<Array<{ nodeId: string }>>;
    const nodeIds = new Set(calls.map((c) => c[0].nodeId));
    expect(nodeIds.size).toBe(2);
    service.stop();
  });

  it('predictNow devuelve la predicción bajo demanda', async () => {
    const bus = new EventBus<SimEventMap>();
    const { worker } = makeFakeWorker();
    const service = new InferenceService(worker, bus, {
      horizonMs: 15000,
      throttleMs: 0,
      minSamples: 1,
      window: 5,
    });
    service.start();
    bus.emit('state:update', makeSnapshot());
    await settle();

    expect(service.hasWindow('node-1')).toBe(true);
    const outcome = await service.predictNow('node-1');
    expect(outcome.ok).toBe(true);
    service.stop();
  });
});

describe('TimeSeriesSink inferencias', () => {
  it('persiste inference:completed en inferences y events', async () => {
    const bus = new EventBus<SimEventMap>();
    const driver = new RecorderDriver();
    const sink = new TimeSeriesSink(
      { database: Database.forDriver(driver), flushMs: 10, maxBuffer: 10, schemaFile: null },
      bus,
    );
    sinks.push(sink);

    bus.emit('inference:completed', {
      nodeId: 'node-1',
      predictedTemp: 27.75,
      actualTemp: 26.5,
      horizonMs: 15000,
      modelVersion: 'sha-test',
      latencyMs: 3,
      featuresHash: 'abc123',
      at: 1_700_000_000_500,
    });
    await settle();

    const inferences = driver.calls.filter((call) => call.sql.startsWith('INSERT INTO `inferences`'));
    expect(inferences).toHaveLength(1);
    const params = inferences[0].params as unknown[];
    expect(params).toHaveLength(9);
    expect(params.slice(0, 8)).toEqual([
      1_700_000_000_500,
      'node-1',
      27.75,
      26.5,
      15000,
      'sha-test',
      3,
      'abc123',
    ]);

    const events = driver.calls.filter((call) => call.sql.startsWith('INSERT INTO `events`'));
    expect(events).toHaveLength(1);
    const eventParams = events[0].params as unknown[];
    expect(eventParams[2]).toBe('inference');
    expect(eventParams[3]).toBe('inference');
  });
});
