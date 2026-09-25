import { createId } from './ids.js';
import type { Rule, RuleInput } from './types.js';

export class RuleStore {
  private readonly rules = new Map<string, Rule>();

  constructor(initial: RuleInput[] = []) {
    for (const input of initial) {
      this.add(input);
    }
  }

  list(): Rule[] {
    return [...this.rules.values()];
  }

  enabledList(): Rule[] {
    return this.list().filter((r) => r.enabled);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  count(): number {
    return this.rules.size;
  }

  add(input: RuleInput): Rule {
    const rule: Rule = {
      ...input,
      id: createId('rule'),
      triggerCount: 0,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  update(id: string, patch: Partial<RuleInput>): Rule | undefined {
    const current = this.rules.get(id);
    if (current === undefined) {
      return undefined;
    }
    const updated: Rule = { ...current, ...patch, id: current.id };
    this.rules.set(id, updated);
    return updated;
  }

  remove(id: string): boolean {
    return this.rules.delete(id);
  }

  resetTriggerCounters(): void {
    for (const rule of this.rules.values()) {
      rule.lastTriggeredAt = undefined;
      rule.triggerCount = 0;
    }
  }
}