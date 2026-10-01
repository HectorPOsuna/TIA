import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LogEntry, LogLevel, LogType } from '../domain/types.js';

export interface LogFilters {
  level?: LogLevel[];
  type?: LogType;
  nodeId?: string;
  since?: number;
  limit?: number;
}

const isLogEntry = (value: unknown): value is LogEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.ts === 'number' &&
    typeof entry.level === 'string' &&
    typeof entry.type === 'string' &&
    typeof entry.message === 'string'
  );
};

function readPersistedLog(filePath: string, limit: number): LogEntry[] {
  try {
    const lines = readFileSync(resolve(process.cwd(), filePath), 'utf8').split(/\r?\n/);
    const entries: LogEntry[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (isLogEntry(parsed)) {
          entries.push(parsed);
        }
      } catch {
        
      }
    }
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

export class LogStore {
  private readonly entries: LogEntry[] = [];
  private readonly filePath: string | null;

  constructor(
    private readonly capacity: number,
    filePath?: string,
  ) {
    this.filePath = filePath === undefined || filePath === '' ? null : filePath;
    if (this.filePath !== null) {
      this.entries.push(...readPersistedLog(this.filePath, this.capacity));
    }
  }

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
    const overflow = this.entries.length - this.capacity;
    if (overflow > 0) {
      this.entries.splice(0, overflow);
    }
    this.persist(overflow > 0);
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
    this.persist(true);
  }

  all(): LogEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  private persist(rewrite: boolean): void {
    if (this.filePath === null) {
      return;
    }
    try {
      if (rewrite) {
        this.rewriteFile();
      } else {
        this.ensureDir();
        const last = this.entries[this.entries.length - 1];
        if (last !== undefined) {
          appendFileSync(
            resolve(process.cwd(), this.filePath),
            `${JSON.stringify(last)}\n`,
          );
        }
      }
    } catch {
        
    }
  }

  private rewriteFile(): void {
    this.ensureDir();
    const resolved = resolve(process.cwd(), this.filePath as string);
    const tmpPath = `${resolved}.tmp`;
    const content = this.entries.map((e) => JSON.stringify(e)).join('\n');
    writeFileSync(tmpPath, content.length > 0 ? `${content}\n` : '');
    renameSync(tmpPath, resolved);
  }

  private ensureDir(): void {
    mkdirSync(dirname(resolve(process.cwd(), this.filePath as string)), { recursive: true });
  }
}