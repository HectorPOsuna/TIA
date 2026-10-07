import type { DbDriver, DbDriverConnection, InsertResult } from '../src/infra/database.js';

export interface RecordedCall {
  sql: string;
  params: unknown[];
}

export class RecorderDriver implements DbDriver {
  readonly calls: RecordedCall[] = [];
  executeError: Error | null = null;
  result: InsertResult = { affectedRows: 1, insertId: 1 };
  ended = false;
  lastConnection: RecorderConnection | null = null;

  async query(sql: string, params: unknown[] = []): Promise<unknown> {
    this.calls.push({ sql, params });
    return [];
  }

  async execute(sql: string, params: unknown[] = []): Promise<unknown> {
    if (this.executeError !== null) {
      throw this.executeError;
    }
    this.calls.push({ sql, params });
    return this.result;
  }

  async getConnection(): Promise<RecorderConnection> {
    this.lastConnection = new RecorderConnection(this);
    return this.lastConnection;
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

export class RecorderConnection implements DbDriverConnection {
  began = false;
  committed = false;
  rolledBack = false;
  released = false;

  constructor(private readonly driver: RecorderDriver) {}

  async query(sql: string, params: unknown[] = []): Promise<unknown> {
    this.driver.calls.push({ sql, params });
    return [];
  }

  async execute(sql: string, params: unknown[] = []): Promise<unknown> {
    if (this.driver.executeError !== null) {
      throw this.driver.executeError;
    }
    this.driver.calls.push({ sql, params });
    return this.driver.result;
  }

  beginTransaction(): Promise<void> {
    this.began = true;
    return Promise.resolve();
  }

  commit(): Promise<void> {
    this.committed = true;
    return Promise.resolve();
  }

  rollback(): Promise<void> {
    this.rolledBack = true;
    return Promise.resolve();
  }

  release(): Promise<void> {
    this.released = true;
    return Promise.resolve();
  }
}