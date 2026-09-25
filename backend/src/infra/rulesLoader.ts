import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RuleInput } from '../domain/types.js';

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