import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPool, type Pool } from 'mysql2/promise';
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

export type QueryExecutor = (sql: string, params?: unknown[]) => Promise<unknown>;

export interface TimeSeriesSinkOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  flushMs: number;
  maxBuffer: number;
  schemaFile: string | null;
  executor?: QueryExecutor;
  onError?: (message: string) => void;
}

const TELEMETRY_SQL =
  'INSERT INTO telemetry (ts, node_id, node_type, current_temp, target_temp, ambient_temp, workload, status, fan_active, queue_length, stack_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

const EVENTS_SQL =
  'INSERT INTO events (ts, node_id, kind, type, label, message, meta) VALUES (?, ?, ?, ?, ?, ?, ?)';

function buildBulk(baseSql: string, rowCount: number): string {
  const header = baseSql.slice(0, baseSql.indexOf('VALUES')).trimEnd();
  const placeholders = baseSql.slice(baseSql.indexOf('VALUES') + 'VALUES'.length).trim();
  const values = Array.from({ length: rowCount }, () => placeholders).join(', ');
  return `${header} VALUES ${values}`;
}

export class TimeSeriesSink {
  private readonly pool: Pool | null;
  private readonly executor: QueryExecutor;
  private readonly telemetryRows: unknown[][] = [];
  private readonly eventRows: unknown[][] = [];
  private schemaReady: boolean;
  private closed = false;
  private flushing = false;
  private timer: NodeJS.Timeout | null;
  private lastErrorAt = 0;

  constructor(
    private readonly options: TimeSeriesSinkOptions,
    bus: EventBus<SimEventMap>,
  ) {
    const pool =
      options.executor === undefined
        ? createPool({
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            connectionLimit: 5,
            multipleStatements: true,
            connectTimeout: 3000,
          })
        : null;
    this.pool = pool;
    this.executor =
      options.executor ?? ((sql: string, params?: unknown[]) => (pool as Pool).query(sql, params));
    this.schemaReady = options.schemaFile === null;
    this.timer = setInterval(() => void this.flush(), options.flushMs);
    this.subscribe(bus);
    void this.ensureSchema();
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
    if (this.pool !== null) {
      await this.pool.end();
    }
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
    this.telemetryRows.push([
      node.updatedAt,
      node.id,
      node.type,
      node.currentTemp,
      node.targetTemp,
      node.ambientTemp,
      node.workload,
      STATUS_CODE[node.status],
      node.fanActive ? 1 : 0,
      node.queue.size,
      node.stack.size,
    ]);
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
    this.eventRows.push([
      ts,
      nodeId ?? null,
      kind,
      type,
      label,
      message,
      meta === null ? null : JSON.stringify(meta),
    ]);
    this.considerFlush();
  }

  private considerFlush(): void {
    if (this.pendingRows >= this.options.maxBuffer) {
      void this.flush();
    }
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady || this.closed) {
      return;
    }
    try {
      const sql = readFileSync(resolve(process.cwd(), this.options.schemaFile as string), 'utf8');
      await this.executor(sql);
      this.schemaReady = true;
    } catch (error) {
      this.reportError(
        `No se pudo inicializar el esquema BD: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async flush(): Promise<void> {
    await this.ensureSchema();
    if (!this.schemaReady || this.flushing) {
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
        await this.executor(buildBulk(TELEMETRY_SQL, telemetry.length), telemetry.flat());
      }
      if (events.length > 0) {
        await this.executor(buildBulk(EVENTS_SQL, events.length), events.flat());
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