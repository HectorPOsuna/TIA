import type { NodeDto, TaskDto } from '../domain/types.js';
import { STATUS_CODE } from '../domain/types.js';
import type { EventBus } from '../engine/eventBus.js';
import type {
  AlertPayload,
  RuleTriggeredPayload,
  SimEventMap,
  TaskEventPayload,
  TaskPendingPayload,
} from '../engine/events.js';
import type { Database, DatabaseRow } from './database.js';

export interface TimeSeriesSinkOptions {
  database: Database;
  flushMs: number;
  maxBuffer: number;
  schemaFile: string | null;
  onError?: (message: string) => void;
}

export class TimeSeriesSink {
  private readonly telemetryRows: DatabaseRow[] = [];
  private readonly eventRows: DatabaseRow[] = [];
  private closed = false;
  private flushing = false;
  private timer: NodeJS.Timeout | null;
  private lastErrorAt = 0;

  constructor(
    private readonly options: TimeSeriesSinkOptions,
    bus: EventBus<SimEventMap>,
  ) {
    this.timer = setInterval(() => void this.flush(), options.flushMs);
    this.subscribe(bus);
  }

  get pendingRows(): number {
    return this.telemetryRows.length + this.eventRows.length;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  private subscribe(bus: EventBus<SimEventMap>): void {
    bus.on('node:updated', ({ node }: { node: NodeDto }) => {
      if (!this.closed) {
        this.pushTelemetry(node);
      }
    });
    bus.on('rule:triggered', (payload: RuleTriggeredPayload) => {
      this.pushEvent(
        payload.at,
        payload.nodeId,
        'rule',
        'rule',
        payload.rule.action,
        payload.rule.name,
        {
          ruleId: payload.rule.id,
          metric: payload.rule.metric,
          op: payload.rule.op,
          value: payload.rule.value,
        },
      );
    });
    bus.on('task:queued', (payload: TaskEventPayload) => {
      this.pushTask('encolada', payload.nodeId, payload.task);
    });
    bus.on('task:completed', (payload: TaskEventPayload) => {
      this.pushTask('completada', payload.nodeId, payload.task);
    });
    bus.on('task:pending', (payload: TaskPendingPayload) => {
      this.pushTask('en pool pendiente', undefined, payload.task);
    });
    bus.on('alert', (payload: AlertPayload) => {
      this.pushEvent(payload.at, payload.nodeId, 'alert', 'alert', payload.level, payload.message, null);
    });
  }

  private pushTelemetry(node: NodeDto): void {
    this.telemetryRows.push({
      ts: node.updatedAt,
      node_id: node.id,
      node_type: node.type,
      current_temp: node.currentTemp,
      target_temp: node.targetTemp,
      ambient_temp: node.ambientTemp,
      workload: node.workload,
      status: STATUS_CODE[node.status],
      fan_active: node.fanActive ? 1 : 0,
      queue_length: node.queue.size,
      stack_size: node.stack.size,
    });
    this.considerFlush();
  }

  private pushTask(label: string, nodeId: string | undefined, task: TaskDto): void {
    const ts = task.completedAt ?? task.startedAt ?? task.enqueuedAt;
    this.pushEvent(ts, nodeId, 'task', 'task', task.type, `Tarea ${label} (${task.type})`, {
      taskId: task.id,
      priority: task.priority,
      status: task.status,
    });
  }

  private pushEvent(
    ts: number,
    nodeId: string | undefined,
    kind: string,
    type: 'rule' | 'task' | 'alert',
    label: string,
    message: string,
    meta: Record<string, unknown> | null,
  ): void {
    this.eventRows.push({
      ts,
      node_id: nodeId ?? null,
      kind,
      type,
      label,
      message,
      meta: meta === null ? null : JSON.stringify(meta),
    });
    this.considerFlush();
  }

  private considerFlush(): void {
    if (this.pendingRows >= this.options.maxBuffer) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    try {
      await this.options.database.ensureSchema(this.options.schemaFile);
    } catch (error) {
      this.reportError(
        `No se pudo inicializar el esquema BD: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    const telemetry = this.telemetryRows.splice(0, this.telemetryRows.length);
    const events = this.eventRows.splice(0, this.eventRows.length);
    if (telemetry.length === 0 && events.length === 0) {
      return;
    }
    this.flushing = true;
    try {
      if (telemetry.length > 0) {
        await this.options.database.insertMany('telemetry', telemetry);
      }
      if (events.length > 0) {
        await this.options.database.insertMany('events', events);
      }
    } catch (error) {
      this.reportError(
        `Error escribiendo en la BD: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.flushing = false;
    }
  }

  private reportError(message: string): void {
    if (this.options.onError === undefined) {
      return;
    }
    const now = Date.now();
    if (now - this.lastErrorAt > 5000) {
      this.lastErrorAt = now;
      this.options.onError(message);
    }
  }
}