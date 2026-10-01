import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Rule, RuleInput } from '../domain/types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRuleInput = (value: unknown): value is RuleInput => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.name === 'string' &&
    typeof value.metric === 'string' &&
    typeof value.op === 'string' &&
    typeof value.value === 'number' &&
    typeof value.action === 'string'
  );
};

export function loadRulesFromFile(filePath: string): RuleInput[] {
  const path = resolve(process.cwd(), filePath);
  if (!existsSync(path)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRuleInput);
  } catch {
    return [];
  }
}

const toRuleInput = ({ id, lastTriggeredAt, triggerCount, ...input }: Rule): RuleInput => input;

export function saveRulesToFile(filePath: string, rules: Rule[]): boolean {
  try {
    const path = resolve(process.cwd(), filePath);
    mkdirSync(dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(rules.map(toRuleInput), null, 2)}\n`);
    renameSync(tmpPath, path);
    return true;
  } catch {
    console.error('[rules] no se pudo persistir reglas en', filePath);
    return false;
  }
}