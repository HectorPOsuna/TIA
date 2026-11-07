import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRulesFromFile } from '../src/infra/rulesLoader.js';
import type { RuleInput } from '../src/domain/types.js';

const dirs: string[] = [];

function tempFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'waitt-rules-'));
  dirs.push(dir);
  const file = join(dir, 'rules.json');
  writeFileSync(file, content);
  return file;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

const sampleInput: RuleInput = {
  name: 'Temp alta',
  enabled: true,
  cooldownMs: 1000,
  subject: 'any',
  metric: 'temperature',
  op: '>',
  value: 55,
  action: 'fan_on',
  actionParams: { minutes: 2 },
};

describe('loader de reglas (RULES_FILE)', () => {
  it('carga las reglas válidas del archivo', () => {
    const file = tempFile(JSON.stringify([sampleInput]));

    const loaded = loadRulesFromFile(file);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Temp alta');
    expect(loaded[0].actionParams).toEqual({ minutes: 2 });
  });

  it('ignora las entradas inválidas', () => {
    const file = tempFile(JSON.stringify([sampleInput, { name: 'Sin acción' }, null]));

    const loaded = loadRulesFromFile(file);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Temp alta');
  });

  it('devuelve una lista vacía si el archivo no existe', () => {
    expect(loadRulesFromFile(join(tmpdir(), 'waitt-rules-inexistente', 'rules.json'))).toEqual([]);
  });

  it('devuelve una lista vacía si el JSON no es válido', () => {
    const file = tempFile('{no es json');

    expect(loadRulesFromFile(file)).toEqual([]);
  });
});
