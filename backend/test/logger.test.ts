import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LogStore } from '../src/infra/logger.js';

const dirs: string[] = [];

function tempLogFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'waitt-log-'));
  dirs.push(dir);
  return join(dir, 'logs.jsonl');
}

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe('LogStore persistente', () => {
  it('añade una línea JSON por entrada', () => {
    const file = tempLogFile();
    const store = new LogStore(200, file);
    store.add('info', 'system', 'uno');
    store.add('warning', 'task', 'dos', 'node-1', { taskId: 'task-1' });

    const lines = readLines(file);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ message: 'uno' });
    expect(JSON.parse(lines[1])).toMatchObject({ message: 'dos', nodeId: 'node-1' });
  });

  it('reescribe el archivo cuando el buffer alcanza la capacidad', () => {
    const file = tempLogFile();
    const store = new LogStore(3, file);
    for (let i = 1; i <= 6; i += 1) {
      store.add('info', 'system', `msg-${i}`);
    }

    expect(store.size).toBe(3);
    const lines = readLines(file);
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).message).toBe('msg-4');
    expect(JSON.parse(lines[2]).message).toBe('msg-6');
  });

  it('restaura el buffer desde el archivo al arrancar', () => {
    const file = tempLogFile();
    const first = new LogStore(200, file);
    first.add('info', 'system', 'a');
    first.add('info', 'system', 'b');

    const restored = new LogStore(200, file);
    expect(restored.size).toBe(2);
    expect(restored.all().map((e) => e.message)).toEqual(['a', 'b']);

    restored.add('info', 'system', 'c');
    expect(readLines(file)).toHaveLength(3);
  });

  it('ignora líneas corruptas al restaurar', () => {
    const file = tempLogFile();
    writeFileSync(file, 'no es json\n{"ts": "raro"}\n');

    const store = new LogStore(10, file);
    expect(store.size).toBe(0);
    store.add('info', 'system', 'ok');
    const lines = readLines(file);
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2]).message).toBe('ok');
  });

  it('clear vacía también el archivo persistido', () => {
    const file = tempLogFile();
    const store = new LogStore(10, file);
    store.add('warning', 'alert', 'x');

    store.clear();
    expect(store.size).toBe(0);
    expect(readLines(file)).toHaveLength(0);
  });
});