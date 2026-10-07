import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPool, type Pool } from 'mysql2/promise';
import type { DatabasePoolSettings } from '../config/database.js';

export type QueryParams = unknown[] | Record<string, unknown>;

export interface InsertResult {
  affectedRows: number;
  insertId?: number;
}

export interface DbSession {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  execute<T = unknown>(sql: string, params?: QueryParams): Promise<T>;
}

export interface DbDriverConnection extends DbSession {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface DbDriver {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  getConnection(): Promise<DbDriverConnection>;
  end(): Promise<void>;
}

export type DatabaseRow = Record<string, unknown>;

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function sanitizeIdentifier(name: string): string {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`Identificador de base de datos no válido: ${name}`);
  }
  return name;
}

function expandNamed(sql: string, params: QueryParams): { sql: string; values: unknown[] } {
  if (Array.isArray(params)) {
    return { sql, values: params };
  }
  const missing: string[] = [];
  const values: unknown[] = [];
  const expanded = sql.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (placeholder, name: string) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      values.push(params[name]);
      return '?';
    }
    missing.push(name);
    return placeholder;
  });
  if (missing.length > 0) {
    throw new Error(`Faltan los parámetros nombrados: ${missing.join(', ')}`);
  }
  return { sql: expanded, values };
}

export class Database {
  private schemaReady = false;

  private constructor(private readonly driver: DbDriver) {}

  static open(settings: DatabasePoolSettings): Database {
    const pool: Pool = createPool(settings);
    const driver: DbDriver = {
      query: (sql, params) => pool.query(sql, params as any),
      execute: (sql, params) => pool.execute(sql, params as any),
      getConnection: async () => {
        const connection = await pool.getConnection();
        return {
          query: async <S = unknown>(sql: string, params: unknown[] = []) =>
            (await connection.query(sql, params as any)) as S,
          execute: async <S = unknown>(sql: string, params: unknown[] = []) =>
            (await connection.execute(sql, params as any)) as S,
          beginTransaction: () => connection.beginTransaction(),
          commit: () => connection.commit(),
          rollback: () => connection.rollback(),
          release: async () => {
            connection.release();
          },
        };
      },
      end: () => pool.end(),
    };
    return new Database(driver);
  }

  static forDriver(driver: DbDriver): Database {
    return new Database(driver);
  }

  get ready(): boolean {
    return this.schemaReady;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
    return (await this.driver.query(sql, params)) as T;
  }

  async execute<T = unknown>(sql: string, params: QueryParams = []): Promise<T> {
    const { sql: expanded, values } = expandNamed(sql, params);
    return (await this.driver.execute(expanded, values)) as T;
  }

  async insert(table: string, row: DatabaseRow): Promise<InsertResult> {
    return this.insertMany(table, [row]);
  }

  async insertMany(table: string, rows: DatabaseRow[]): Promise<InsertResult> {
    if (rows.length === 0) {
      return { affectedRows: 0 };
    }
    const tableName = sanitizeIdentifier(table);
    const columns = Object.keys(rows[0]).map(sanitizeIdentifier);
    const tuples = Array.from({ length: rows.length }, () => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const sql = `INSERT INTO \`${tableName}\` (\`${columns.join('\`, \`')}\`) VALUES ${tuples}`;
    const values = rows.flatMap((row) => columns.map((column) => row[column]));
    return (await this.execute<InsertResult>(sql, values)) as InsertResult;
  }

  async transaction<T>(work: (session: DbSession) => Promise<T>): Promise<T> {
    const connection = await this.driver.getConnection();
    try {
      await connection.beginTransaction();
      const session: DbSession = {
        query: async <S = unknown>(sql: string, params: unknown[] = []) =>
          (await connection.query(sql, params)) as S,
        execute: async <S = unknown>(sql: string, params: QueryParams = []) => {
          const { sql: expanded, values } = expandNamed(sql, params);
          return (await connection.execute(expanded, values)) as S;
        },
      };
      const result = await work(session);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      await connection.release();
    }
  }

  async ensureSchema(schemaFile: string | null): Promise<void> {
    if (this.schemaReady) {
      return;
    }
    if (schemaFile === null) {
      this.schemaReady = true;
      return;
    }
    const sql = readFileSync(resolve(process.cwd(), schemaFile), 'utf8');
    await this.driver.query(sql);
    this.schemaReady = true;
  }

  async close(): Promise<void> {
    await this.driver.end();
  }
}