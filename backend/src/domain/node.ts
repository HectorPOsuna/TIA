import { EventStack } from './stack.js';
import { TaskQueue } from './tasks.js';
import type { TaskOptions } from './tasks.js';
import { thermalStep, DEFAULT_THERMAL_PARAMS, type ThermalParams } from './thermal.js';
import type {
  NodeDto,
  NodeStatus,
  NodeType,
  QueueDto,
  StackEntry,
  StackEntryKind,
  StackDto,
  Task,
  TaskDto,
} from './types.js';

export interface NodeConfig {
  id: string;
  name: string;
  type: NodeType;
  initialTemp?: number;
  targetTemp?: number;
  ambientTemp?: number;
  workload?: number;
  status?: NodeStatus;
  queueCapacity?: number;
  stackCapacity?: number;
  maxConsecutiveFailures?: number;
}

const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export class SimNode {
  readonly id: string;
  name: string;
  readonly type: NodeType;
  status: NodeStatus;
  currentTemp: number;
  targetTemp: number;
  ambientTemp: number;
  workload: number;
  fanActive = false;
  fanUntilMs = 0;
  failures = 0;
  consecutiveFailures = 0;
  updatedAt: number;

  private readonly queue: TaskQueue;
  private readonly stack: EventStack;
  private readonly maxConsecutiveFailures: number;
  private currentTask: Task | null = null;

  constructor(config: NodeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.status = config.status ?? 'active';
    this.currentTemp = config.initialTemp ?? 25;
    this.targetTemp = config.targetTemp ?? 30;
    this.ambientTemp = config.ambientTemp ?? 20;
    this.workload = config.workload ?? 0.3;
    this.updatedAt = Date.now();
    this.queue = new TaskQueue(config.queueCapacity ?? 50);
    this.stack = new EventStack(config.stackCapacity ?? 20);
    this.maxConsecutiveFailures = config.maxConsecutiveFailures ?? 5;
  }

  get isGeneral(): boolean {
    return this.type === 'general';
  }

  get ok(): boolean {
    return this.consecutiveFailures < this.maxConsecutiveFailures;
  }

  get isBusy(): boolean {
    return this.currentTask !== null;
  }

  get active(): boolean {
    return this.status === 'active';
  }

  get queueSize(): number {
    return this.queue.size;
  }

  get stackSize(): number {
    return this.stack.size;
  }

  get processingTask(): Task | null {
    return this.currentTask === null ? null : { ...this.currentTask };
  }

  pushEvent(kind: StackEntryKind, label: string, detail?: string, meta?: Record<string, unknown>): void {
    this.stack.push(kind, label, detail, meta);
  }

  thermalStep(dtMs: number, params: ThermalParams = DEFAULT_THERMAL_PARAMS): void {
    if (this.active) {
      this.currentTemp = thermalStep(
        this.currentTemp,
        this.targetTemp,
        this.ambientTemp,
        this.workload,
        true,
        this.fanActive,
        dtMs,
        params,
      );
    }
  }

  expireFanIfNeeded(now: number): boolean {
    if (this.fanActive && this.fanUntilMs > 0 && now >= this.fanUntilMs) {
      this.fanActive = false;
      this.fanUntilMs = 0;
      this.pushEvent('change', `Ventilador desactivado en ${this.id}`);
      return true;
    }
    return false;
  }

  enqueueTask(options: TaskOptions): { task: Task | null; reason?: string } {
    if (this.queue.isFull()) {
      return { task: null, reason: 'cola llena' };
    }
    const task = this.queue.enqueue(options);
    if (task !== null) {
      this.pushEvent('event', `Tarea encolada (${task.type}) en ${this.id}`, task.id, {
        taskId: task.id,
      });
    }
    return { task };
  }

  clearQueue(): Task[] {
    const removed = this.queue.clear();
    this.pushEvent('event', `Cola vaciada (${removed.length} tareas) en ${this.id}`);
    return removed;
  }

  startNextTask(): Task | null {
    if (!this.active || this.currentTask !== null) {
      return null;
    }
    const task = this.queue.startProcessing();
    if (task !== null) {
      this.currentTask = task;
      this.pushEvent('task', `Tarea iniciada (${task.type}) en ${this.id}`, task.id, {
        taskId: task.id,
      });
    }
    return task;
  }

  completeCurrentTask(now: number): Task | null {
    if (this.currentTask === null) {
      return null;
    }
    const completed = this.queue.complete(this.currentTask, now);
    this.currentTask = null;
    this.pushEvent('task', `Tarea completada (${completed.type}) en ${this.id}`, completed.id, {
      taskId: completed.id,
    });
    return completed;
  }

  markFailure(now: number): void {
    this.failures += 1;
    this.consecutiveFailures += 1;
    this.updatedAt = now;
    if (!this.ok && this.status === 'active') {
      this.status = 'error';
      this.pushEvent('change', `Nodo ${this.id} en error (fallos consecutivos)`);
    }
  }

  recover(now: number): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
      this.updatedAt = now;
      this.pushEvent('change', `Nodo ${this.id} recuperado`);
    }
  }

  queueSnapshot(): QueueDto {
    const list: TaskDto[] = this.queue.toArray().map((t) => ({ ...t }));
    let processing: TaskDto | null = null;
    if (this.currentTask !== null) {
      processing = { ...this.currentTask };
    }
    return {
      list,
      size: this.queue.size,
      capacity: this.queue.capacity,
      remaining: this.queue.remaining,
      processing,
    };
  }

  stackSnapshot(): StackDto {
    return {
      list: this.stack.toArray(),
      size: this.stack.size,
      capacity: this.stack.capacity,
    };
  }

  toDto(): NodeDto {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      currentTemp: round(this.currentTemp, 2),
      targetTemp: round(this.targetTemp, 2),
      ambientTemp: round(this.ambientTemp, 2),
      workload: round(this.workload, 3),
      fanActive: this.fanActive,
      fanUntilMs: this.fanUntilMs,
      stats: {
        failures: this.failures,
        consecutiveFailures: this.consecutiveFailures,
        maxConsecutiveFailures: this.maxConsecutiveFailures,
        ok: this.ok,
      },
      queue: this.queueSnapshot(),
      stack: this.stackSnapshot(),
      updatedAt: this.updatedAt,
    };
  }

  getStackEntries(): StackEntry[] {
    return this.stack.toArray();
  }

  resetRuntime(initialTemp?: number, targetTemp?: number): void {
    this.status = 'active';
    this.currentTemp = initialTemp ?? this.currentTemp;
    if (targetTemp !== undefined) {
      this.targetTemp = targetTemp;
    }
    this.fanActive = false;
    this.fanUntilMs = 0;
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.currentTask = null;
    this.updatedAt = Date.now();
    this.queue.clear();
    this.stack.clear();
  }
}