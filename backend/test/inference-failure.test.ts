import { describe, expect, it, vi } from 'vitest';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { SimEventMap } from '../src/engine/events.js';
import { InferenceService } from '../src/infra/ai/inferenceService.js';
import type { InferenceWorker } from '../src/infra/ai/inferenceWorker.js';

const seed = {
  initialNodes: 1,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 10,
};

function rejectingWorker(message: string): InferenceWorker {
  return {
    predict: () => Promise.reject(new Error(message)),
    version: async () => ({}),
    stop: () => undefined,
    start: () => undefined,
    running: false,
  } as unknown as InferenceWorker;
}

function buildService(worker: InferenceWorker, onWarn?: (message: string) => void) {
  const bus = new EventBus<SimEventMap>();
  const service = new InferenceService(worker, bus, {
    horizonMs: 1000,
    throttleMs: 0,
    minSamples: 1,
    window: 10,
    onWarn,
  });
  return { service, bus };
}

describe('fallos del worker de inferencia', () => {
  it('devuelve un resultado fallido cuando el worker rechaza', async () => {
    const { service } = buildService(rejectingWorker('worker exited'));

    const outcome = await service.predictNow('node-1');

    expect(outcome).toEqual({ ok: false, error: 'worker exited' });
  });

  it('avisa y no emite inference:completed cuando el worker muere', async () => {
    const warnings: string[] = [];
    const { service, bus } = buildService(rejectingWorker('worker exited'), (message) =>
      warnings.push(message),
    );
    const completed = vi.fn();
    bus.on('inference:completed', completed);
    service.start();
    const snapshot = new SystemSimulation(seed).getSnapshot();

    bus.emit('state:update', snapshot);

    await vi.waitFor(() => {
      expect(warnings).toHaveLength(2);
    });
    expect(warnings.every((warning) => warning.includes('worker exited'))).toBe(true);
    expect(completed).not.toHaveBeenCalled();
  });

  it('devuelve fallo de timeout sin emitir inference:completed', async () => {
    const worker = {
      predict: async () => ({ ok: false, error: 'timeout' }),
      version: async () => ({}),
      stop: () => undefined,
      start: () => undefined,
      running: false,
    } as unknown as InferenceWorker;
    const { service } = buildService(worker);

    const outcome = await service.predictNow('node-1');

    expect(outcome).toEqual({ ok: false, error: 'timeout' });
  });
});
