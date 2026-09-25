import type { LogEntry, LogLevel, LogType } from '../domain/types.js';

export interface LogFilters {
  level?: LogLevel[];
  type?: LogType;
  nodeId?: string;
  since?: number;
  limit?: number;
}

export class LogStore {
  private readonly entries: LogEntry[] = [];

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.entries.length;
  }

  add(
    level: LogLevel,
    type: LogType,
    message: string,
    nodeId?: string,
    meta?: Record<string, unknown>,
  ): LogEntry {
    const entry: LogEntry = {
      ts: Date.now(),
      level,
      type,
      message,
    };
    if (nodeId !== undefined) {
      entry.nodeId = nodeId;
    }
    if (meta !== undefined && Object.keys(meta).length > 0) {
      entry.meta = meta;
    }
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    return entry;
  }

  list(filters: LogFilters = {}): LogEntry[] {
    let result = this.entries;
    if (filters.level !== undefined && filters.level.length > 0) {
      result = result.filter((e) => filters.level?.includes(e.level));
    }
    if (filters.type !== undefined) {
      result = result.filter((e) => e.type === filters.type);
    }
    if (filters.nodeId !== undefined) {
      result = result.filter((e) => e.nodeId === filters.nodeId);
    }
    if (filters.since !== undefined) {
      result = result.filter((e) => e.ts >= (filters.since as number));
    }
    if (filters.limit !== undefined && filters.limit >= 0) {
      result = result.slice(-filters.limit);
    }
    return result;
  }

  clear(): void {
    this.entries.length = 0;
  }

  all(): LogEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
}