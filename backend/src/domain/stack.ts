import type { StackEntry, StackEntryKind } from './types.js';

export class EventStack {
  private readonly entries: StackEntry[] = [];
  private readonly capacityValue: number;

  constructor(capacity: number) {
    this.capacityValue = capacity;
  }

  get capacity(): number {
    return this.capacityValue;
  }

  get size(): number {
    return this.entries.length;
  }

  push(kind: StackEntryKind, label: string, detail?: string, meta?: Record<string, unknown>): void {
    const entry: StackEntry = { ts: Date.now(), kind, label };
    if (detail !== undefined) {
      entry.detail = detail;
    }
    if (meta !== undefined && Object.keys(meta).length > 0) {
      entry.meta = meta;
    }
    this.entries.unshift(entry);
    if (this.entries.length > this.capacityValue) {
      this.entries.length = this.capacityValue;
    }
  }

  peek(): StackEntry | undefined {
    return this.entries[0];
  }

  clear(): void {
    this.entries.length = 0;
  }

  toArray(): StackEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
}