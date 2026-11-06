import { EVENT_CATALOG, applyEvent } from '../domain/events.js';
import type { EventCategory, EventId, EventOutcome, EventRequest } from '../domain/events.js';
import type { SystemSimulation } from '../domain/system.js';
import type { LogStore } from '../infra/logger.js';
import type { EventBus } from './eventBus.js';
import type { AlertPayload, EventTriggeredPayload, SimEventMap } from './events.js';

export interface EventEngineOptions {
  enabled: boolean;
  intervalMs: number;
  probabilities?: Partial<Record<EventId, number>>;
  rng?: () => number;
  now?: () => number;
  recentLimit?: number;
}

export interface EventRuntimeState {
  id: EventId;
  name: string;
  category: EventCategory;
  description: string;
  enabled: boolean;
  probability: number;
  cooldownMs: number;
  defaultParams: Record<string, unknown>;
  lastTriggeredAt?: number;
  triggerCount: number;
}

export interface EventEngineState {
  generator: { enabled: boolean; intervalMs: number };
  events: EventRuntimeState[];
  recent: EventTriggeredPayload[];
}

export interface GeneratorPatch {
  enabled?: boolean;
  intervalMs?: number;
}

export interface EventPatch {
  enabled?: boolean;
  probability?: number;
  cooldownMs?: number;
}

const DEFAULT_RECENT_LIMIT = 50;

export class EventEngine {
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly recentLimit: number;
  private readonly events: EventRuntimeState[];
  private readonly recentValue: EventTriggeredPayload[] = [];
  private generatorValue: { enabled: boolean; intervalMs: number };
  private accumulatorMs = 0;

  constructor(
    private readonly system: SystemSimulation,
    private readonly bus: EventBus<SimEventMap>,
    private readonly logs: LogStore,
    options: EventEngineOptions,
  ) {
    this.rng = options.rng ?? Math.random;
    this.now = options.now ?? Date.now;
    this.recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;
    this.generatorValue = { enabled: options.enabled, intervalMs: options.intervalMs };
    this.events = EVENT_CATALOG.map((definition) => ({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      enabled: true,
      probability: options.probabilities?.[definition.id] ?? definition.defaultProbability,
      cooldownMs: definition.defaultCooldownMs,
      defaultParams: { ...definition.defaultParams },
      triggerCount: 0,
    }));
  }

  get state(): EventEngineState {
    return {
      generator: { ...this.generatorValue },
      events: this.events.map((event) => ({ ...event, defaultParams: { ...event.defaultParams } })),
      recent: this.recentValue.map((payload) => ({
        ...payload,
        ...(payload.taskIds === undefined ? {} : { taskIds: [...payload.taskIds] }),
        ...(payload.params === undefined ? {} : { params: { ...payload.params } }),
      })),
    };
  }

  step(dtMs: number): void {
    if (!this.generatorValue.enabled) {
      return;
    }
    this.accumulatorMs += dtMs;
    if (this.accumulatorMs < this.generatorValue.intervalMs) {
      return;
    }
    this.accumulatorMs -= this.generatorValue.intervalMs;
    this.evaluate();
  }

  trigger(id: EventId, request?: EventRequest, source: 'auto' | 'manual' = 'manual'): EventTriggeredPayload {
    const definition = EVENT_CATALOG.find((event) => event.id === id);
    const runtime = this.events.find((event) => event.id === id);
    if (definition === undefined || runtime === undefined) {
      throw new Error(`evento desconocido: ${id}`);
    }
    const at = this.now();
    let outcome: EventOutcome;
    try {
      outcome = applyEvent(id, { system: this.system, now: at, rng: this.rng, request });
    } catch (error) {
      outcome = {
        applied: false,
        message: `error aplicando evento: ${error instanceof Error ? error.message : String(error)}`,
        params: request?.params,
      };
    }

    runtime.lastTriggeredAt = at;
    runtime.triggerCount += 1;

    const payload: EventTriggeredPayload = {
      eventId: id,
      name: definition.name,
      category: definition.category,
      source,
      applied: outcome.applied,
      message: outcome.message,
      at,
    };
    if (outcome.nodeId !== undefined) {
      payload.nodeId = outcome.nodeId;
    }
    if (outcome.taskIds !== undefined) {
      payload.taskIds = outcome.taskIds;
    }
    if (outcome.params !== undefined) {
      payload.params = outcome.params;
    }

    this.recentValue.unshift(payload);
    if (this.recentValue.length > this.recentLimit) {
      this.recentValue.length = this.recentLimit;
    }

    this.bus.emit('event:triggered', payload);
    this.emitTaskEvents(id, outcome, request);
    this.emitAlert(id, outcome, at);

    const level =
      id === 'synthetic_alert' && outcome.applied
        ? 'critical'
        : outcome.applied
          ? 'info'
          : 'warning';
    this.logs.add(level, 'event', `Evento "${definition.name}" (${source}): ${outcome.message}`, outcome.nodeId, {
      eventId: id,
      source,
      applied: outcome.applied,
      taskIds: outcome.taskIds,
      params: outcome.params,
    });

    return payload;
  }

  patchGenerator(patch: GeneratorPatch): { enabled: boolean; intervalMs: number } {
    if (patch.enabled !== undefined) {
      this.generatorValue.enabled = patch.enabled;
    }
    if (patch.intervalMs !== undefined) {
      this.generatorValue.intervalMs = patch.intervalMs;
    }
    return { ...this.generatorValue };
  }

  patchEvent(id: EventId, patch: EventPatch): EventRuntimeState | null {
    const runtime = this.events.find((event) => event.id === id);
    if (runtime === undefined) {
      return null;
    }
    if (patch.enabled !== undefined) {
      runtime.enabled = patch.enabled;
    }
    if (patch.probability !== undefined) {
      runtime.probability = patch.probability;
    }
    if (patch.cooldownMs !== undefined) {
      runtime.cooldownMs = patch.cooldownMs;
    }
    return { ...runtime, defaultParams: { ...runtime.defaultParams } };
  }

  resetRuntime(): void {
    for (const event of this.events) {
      delete event.lastTriggeredAt;
      event.triggerCount = 0;
    }
    this.accumulatorMs = 0;
    this.recentValue.length = 0;
  }

  private evaluate(): void {
    const now = this.now();
    for (const event of this.events) {
      if (!event.enabled) {
        continue;
      }
      if (event.lastTriggeredAt !== undefined && now - event.lastTriggeredAt < event.cooldownMs) {
        continue;
      }
      if (this.rng() >= event.probability) {
        continue;
      }
      this.trigger(event.id, undefined, 'auto');
    }
  }

  private emitTaskEvents(id: EventId, outcome: EventOutcome, request: EventRequest | undefined): void {
    if (id !== 'task_arrival' || outcome.tasks === undefined) {
      return;
    }
    if (request?.nodeId !== undefined && outcome.nodeId !== undefined) {
      for (const task of outcome.tasks) {
        this.bus.emit('task:queued', { nodeId: outcome.nodeId, task });
      }
      return;
    }
    for (const task of outcome.tasks) {
      this.bus.emit('task:pending', { task });
    }
  }

  private emitAlert(id: EventId, outcome: EventOutcome, at: number): void {
    if (id !== 'synthetic_alert' || !outcome.applied) {
      return;
    }
    const params = outcome.params ?? {};
    const level = params.level === 'warning' ? 'warning' : 'critical';
    const message = typeof params.message === 'string' ? params.message : outcome.message;
    const alert: AlertPayload = { level, message, at };
    if (outcome.nodeId !== undefined) {
      alert.nodeId = outcome.nodeId;
    }
    this.bus.emit('alert', alert);
  }
}
