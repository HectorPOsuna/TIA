import type { NodeDto } from '../../domain/types.js';
import { STATUS_CODE } from '../../domain/types.js';
import type { EventBus } from '../../engine/eventBus.js';
import type { InferencePayload, SimEventMap } from '../../engine/events.js';
import { InferenceWorker } from './inferenceWorker.js';

export interface InferenceServiceOptions {
  horizonMs: number;
  throttleMs: number;
  minSamples: number;
  window: number;
  onWarn?: (message: string) => void;
}

interface Sample {
  ts: number;
  currentTemp: number;
  targetTemp: number;
  ambientTemp: number;
  workload: number;
  taskHeat: number;
  status: number;
  fanActive: number;
  queueLength: number;
  stackSize: number;
}

function toSample(node: NodeDto): Sample {
  return {
    ts: node.updatedAt,
    currentTemp: node.currentTemp,
    targetTemp: node.targetTemp + node.aiTargetOffset,
    ambientTemp: node.ambientTemp,
    workload: node.workload,
    taskHeat: node.taskHeat,
    status: STATUS_CODE[node.status],
    fanActive: node.fanActive ? 1 : 0,
    queueLength: node.queue.size,
    stackSize: node.stack.size,
  };
}

export type InferenceOutcome = (InferencePayload & { ok: true }) | { ok: false; error: string };

export class InferenceService {
  private readonly windows = new Map<string, Sample[]>();
  private readonly lastRun = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly worker: InferenceWorker,
    private readonly bus: EventBus<SimEventMap>,
    private readonly opts: InferenceServiceOptions,
  ) {}

  start(): void {
    this.bus.on('state:update', (snapshot) => {
      const now = Date.now();
      for (const node of [snapshot.general, ...snapshot.workers]) {
        this.push(node);
        this.maybeRun(node.id, now);
      }
    });
  }

  stop(): void {
    this.worker.stop();
  }

  version(): Promise<{ version?: string; meta?: Record<string, unknown> }> {
    return this.worker.version();
  }

  hasWindow(nodeId: string): boolean {
    const buf = this.windows.get(nodeId);
    return buf !== undefined && buf.length >= this.opts.minSamples;
  }

  predictNow(nodeId: string, horizonMs?: number): Promise<InferenceOutcome> {
    const buf = this.windows.get(nodeId) ?? [];
    return this.request(nodeId, buf, horizonMs);
  }

  private push(node: NodeDto): void {
    const buf = this.windows.get(node.id) ?? [];
    buf.push(toSample(node));
    if (buf.length > this.opts.window) {
      buf.splice(0, buf.length - this.opts.window);
    }
    this.windows.set(node.id, buf);
  }

  private maybeRun(nodeId: string, now: number): void {
    const buf = this.windows.get(nodeId);
    if (buf === undefined || buf.length < this.opts.minSamples) {
      return;
    }
    if (this.inFlight.has(nodeId)) {
      return;
    }
    const last = this.lastRun.get(nodeId) ?? 0;
    if (now - last < this.opts.throttleMs) {
      return;
    }
    this.lastRun.set(nodeId, now);
    this.inFlight.add(nodeId);
    void this.run(nodeId, buf).finally(() => this.inFlight.delete(nodeId));
  }

  private async run(nodeId: string, samples: Sample[]): Promise<void> {
    const outcome = await this.request(nodeId, samples, undefined);
    if (!outcome.ok) {
      if (this.opts.onWarn !== undefined) {
        this.opts.onWarn(`Inferencia fallida (${nodeId}): ${outcome.error}`);
      }
      return;
    }
    this.bus.emit('inference:completed', outcome);
  }

  private async request(
    nodeId: string,
    samples: Sample[],
    horizonMs?: number,
  ): Promise<InferenceOutcome> {
    const horizon = horizonMs ?? this.opts.horizonMs;
    const resp = await this.worker.predict({
      nodeId,
      samples: samples.map((s) => ({
        ts: s.ts,
        currentTemp: s.currentTemp,
        targetTemp: s.targetTemp,
        ambientTemp: s.ambientTemp,
        workload: s.workload,
        status: s.status,
        fanActive: s.fanActive,
        queueLength: s.queueLength,
        stackSize: s.stackSize,
      })),
      horizonMs: horizon,
    });
    if (!resp.ok || resp.predictedTemp === undefined) {
      return { ok: false, error: resp.error ?? 'sin predicción' };
    }
    const actualTemp = samples.length > 0 ? samples[samples.length - 1].currentTemp : Number.NaN;
    return {
      ok: true,
      nodeId,
      predictedTemp: resp.predictedTemp,
      actualTemp,
      horizonMs: horizon,
      modelVersion: resp.modelVersion ?? 'unknown',
      latencyMs: resp.latencyMs ?? 0,
      featuresHash: resp.featuresHash,
      at: Date.now(),
    };
  }
}
