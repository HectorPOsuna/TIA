import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Database, type DbSession } from '../src/infra/database.js';
import { RecorderConnection, RecorderDriver } from './dbDriver.js';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('Database inserts estilo PDO', () => {
  it('insert genera INSERT preparado con bind posicional', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await db.insert('telemetry', { ts: 1_700_000_000_000, node_id: 'node-1', current_temp: 26.5 });

    expect(driver.calls).toHaveLength(1);
    expect(driver.calls[0].sql).toBe(
      'INSERT INTO `telemetry` (`ts`, `node_id`, `current_temp`) VALUES (?, ?, ?)',
    );
    expect(driver.calls[0].params).toEqual([1_700_000_000_000, 'node-1', 26.5]);
  });

  it('insertMany hace un INSERT multi-fila', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await db.insertMany('events', [{ a: 1 }, { a: 2 }]);

    expect(driver.calls[0].sql).toBe('INSERT INTO `events` (`a`) VALUES (?), (?)');
    expect(driver.calls[0].params).toEqual([1, 2]);
  });

  it('insertMany con cero filas no ejecuta nada', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await expect(db.insertMany('events', [])).resolves.toEqual({ affectedRows: 0 });
    expect(driver.calls).toHaveLength(0);
  });

  it('rechaza identificadores de tabla o columna no seguros', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await expect(db.insertMany('telemetry; DROP TABLE events', [{ a: 1 }])).rejects.toThrow();
    await expect(db.insertMany('telemetry', [{ 'current_temp"; DROP': 1 }])).rejects.toThrow();
    expect(driver.calls).toHaveLength(0);
  });
});

describe('Database execute con parámetros nombrados', () => {
  it('expande placeholders :nombre a bind posicional', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    const sql = 'SELECT * FROM events WHERE node_id = :nodeId AND kind = :kind';
    await db.execute(sql, { nodeId: 'node-2', kind: 'task' });

    expect(driver.calls[0].sql).toBe('SELECT * FROM events WHERE node_id = ? AND kind = ?');
    expect(driver.calls[0].params).toEqual(['node-2', 'task']);
  });

  it('lanza si falta un parámetro nombrado', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await expect(db.execute('SELECT * FROM events WHERE node_id = :nodeId', {})).rejects.toThrow(
      'Faltan los parámetros nombrados: nodeId',
    );
  });
});

describe('Database transaction', () => {
  it('hace BEGIN, trabajo sobre la misma conexión, COMMIT y release', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await db.transaction(async (tx: DbSession) => {
      await tx.execute('INSERT INTO events (ts) VALUES (:ts)', { ts: 42 });
    });

    const conn = driver.lastConnection as RecorderConnection;
    expect(conn.began).toBe(true);
    expect(conn.committed).toBe(true);
    expect(conn.rolledBack).toBe(false);
    expect(conn.released).toBe(true);
    expect(driver.calls.map((call) => call.sql)).toEqual(['INSERT INTO events (ts) VALUES (?)']);
    expect(driver.calls[0].params).toEqual([42]);
  });

  it('hace ROLLBACK y relanza si el trabajo falla', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await expect(
      db.transaction(async (tx: DbSession) => {
        await tx.execute('DELETE FROM events');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const conn = driver.lastConnection as RecorderConnection;
    expect(conn.began).toBe(true);
    expect(conn.committed).toBe(false);
    expect(conn.rolledBack).toBe(true);
    expect(conn.released).toBe(true);
  });
});

describe('Database ensureSchema', () => {
  it('con schemaFile null queda listo sin ejecutar nada', async () => {
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await db.ensureSchema(null);

    expect(db.ready).toBe(true);
    expect(driver.calls).toHaveLength(0);
  });

  it('ejecuta el DDL del archivo una sola vez', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'waitt-schema-'));
    tempDirs.push(dir);
    const file = join(dir, 'schema.sql');
    writeFileSync(file, 'CREATE TABLE t (id INT);', 'utf8');
    const driver = new RecorderDriver();
    const db = Database.forDriver(driver);

    await db.ensureSchema(file);
    expect(db.ready).toBe(true);
    expect(driver.calls).toHaveLength(1);
    expect(driver.calls[0].sql).toContain('CREATE TABLE t');

    await db.ensureSchema(file);
    expect(driver.calls).toHaveLength(1);
  });
});