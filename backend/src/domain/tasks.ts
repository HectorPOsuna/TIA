import { createId } from './ids.js';
import type { Task, TaskType } from './types.js';

export interface TaskOptions {
  type: TaskType;
  estimatedDurationMs?: number;
  payload?: Record<string, unknown>;
  description?: string;
}

export const DEFAULT_TASK_DURATION_MS = 5000;

export class TaskQueue {
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
      status: 'pending',
      enqueuedAt: Date.now(),
      estimatedDurationMs: options.estimatedDurationMs ?? DEFAULT_TASK_DURATION_MS,
    };
    if (options.payload !== undefined) {
      task.payload = options.payload;
    }
    if (options.description !== undefined) {
      task.description = options.description;
    }
    this.tasks.push(task);
    return task;
  }

  startProcessing(): Task | null {
    const task = this.tasks.shift() ?? null;
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
    return this.tasks.map((t) => ({ ...t }));
  }
}