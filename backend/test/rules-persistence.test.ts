import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RuleStore } from '../src/domain/rules-store.js';
import { loadRulesFromFile, saveRulesToFile } from '../src/infra/rulesLoader.js';
import type { RuleInput } from '../src/domain/types.js';

const dirs: string[] = [];

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'waitt-rules-'));
  dirs.push(dir);
  return join(dir, 'rules.json');
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

describe('persistencia de reglas (RULES_FILE)', () => {
  it('escribe las reglas al mutar y limpia los campos runtime', () => {
    const file = tempFile();
    const store = new RuleStore([]);
    store.onChange = () => {
      saveRulesToFile(file, store.list());
    };
    store.add(sampleInput);
    store.add({ ...sampleInput, name: 'Otra', action: 'send_alert' });

    const raw = readFileSync(file, 'utf8');
    expect(raw).not.toContain('"id"');
    expect(raw).not.toContain('triggerCount');

    const loaded = loadRulesFromFile(file);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('Temp alta');
    expect(loaded[0]).not.toHaveProperty('id');
  });

  it('persiste updates y removes', () => {
    const file = tempFile();
    const store = new RuleStore([]);
    store.onChange = () => {
      saveRulesToFile(file, store.list());
    };
    const { id } = store.add(sampleInput);

    store.update(id, { value: 80 });
    let loaded = loadRulesFromFile(file);
    expect(loaded[0].value).toBe(80);

    store.remove(id);
    loaded = loadRulesFromFile(file);
    expect(loaded).toEqual([]);
  });

  it('crea el directorio si no existe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'waitt-rules-'));
    dirs.push(dir);
    const nested = join(dir, 'sub', 'nested', 'rules.json');

    const ok = saveRulesToFile(nested, []);
    expect(ok).toBe(true);
    expect(existsSync(nested)).toBe(true);
    expect(loadRulesFromFile(nested)).toEqual([]);
  });

  it('deja un archivo legible sin temporales colgando', () => {
    const file = tempFile();
    const store = new RuleStore([sampleInput]);

    saveRulesToFile(file, store.list());
    expect(readFileSync(file, 'utf8')).toContain('"Temp alta"');
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});