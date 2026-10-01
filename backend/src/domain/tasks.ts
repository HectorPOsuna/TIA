import { createId } from './ids.js';
import type { Task, TaskType } from './types.js';
import {
  COMPUTE_DEMAND_MAX,
  COMPUTE_DEMAND_MIN,
  DURATION_SECS_MAX,
  DURATION_SECS_MIN,
  TASK_PRIORITY_MAX,
  TASK_PRIORITY_MIN,
} from './types.js';

export interface TaskOptions {
  type: TaskType;
  priority?: number;
  computeDemand?: number;
  durationSecs?: number;
  enqueuedAt?: number;
  payload?: Record<string, unknown>;
  description?: string;
}

export const DEFAULT_TASK_PRIORITY = 3;
export const DEFAULT_COMPUTE_DEMAND = 1;
export const DEFAULT_DURATION_SECS = 5;

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export class PriorityTaskQueue {
  private readonly tasks: Task[] = [];
  private readonly capacityValue: number;

  constructor(capacity: number) {
    this.capacityValue = capacity;
  }

  get capacity(): number {
    return this.capacityValue;
  }

  get size(): number {
    return this.tasks.length;
  }

  get remaining(): number {
    return this.capacityValue - this.tasks.length;
  }

  isFull(): boolean {
    return this.tasks.length >= this.capacityValue;
  }

  enqueue(options: TaskOptions): Task | null {
    if (this.isFull()) {
      return null;
    }
    const task: Task = {
      id: createId('task'),
      type: options.type,
      priority: clampInt(options.priority ?? DEFAULT_TASK_PRIORITY, TASK_PRIORITY_MIN, TASK_PRIORITY_MAX),
      computeDemand: clampInt(
        options.computeDemand ?? DEFAULT_COMPUTE_DEMAND,
        COMPUTE_DEMAND_MIN,
        COMPUTE_DEMAND_MAX,
      ),
      durationSecs: clampInt(
        options.durationSecs ?? DEFAULT_DURATION_SECS,
        DURATION_SECS_MIN,
        DURATION_SECS_MAX,
      ),
      status: 'pending',
      enqueuedAt: options.enqueuedAt ?? Date.now(),
    };
    if (options.payload !== undefined) {
      task.payload = options.payload;
    }
    if (options.description !== undefined) {
      task.description = options.description;
    }
    const index = this.tasks.findIndex((t) =>
      t.priority > task.priority || (t.priority === task.priority && t.enqueuedAt < task.enqueuedAt),
    );
    if (index === -1) {
      this.tasks.push(task);
    } else {
      this.tasks.splice(index, 0, task);
    }
    return task;
  }

  peek(): Task | null {
    const task = this.tasks[this.tasks.length - 1];
    return task === undefined ? null : { ...task };
  }

  poll(): Task | null {
    return this.tasks.pop() ?? null;
  }

  startProcessing(): Task | null {
    const task = this.poll();
    if (task === null) {
      return null;
    }
    task.status = 'processing';
    task.startedAt = Date.now();
    return task;
  }

  complete(task: Task, now: number): Task {
    task.status = 'completed';
    task.completedAt = now;
    return task;
  }

  clear(): Task[] {
    return this.tasks.splice(0, this.tasks.length);
  }

  toArray(): Task[] {
    return [...this.tasks].reverse().map((t) => ({ ...t }));
  }
}