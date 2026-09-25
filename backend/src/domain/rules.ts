import { STATUS_CODE } from './types.js';
import type {
  Rule,
  RuleMetric,
  RuleOperator,
  RuleSubject,
} from './types.js';
import type { SimNode } from './node.js';
import type { SystemSimulation } from './system.js';

export function metricValue(node: SimNode, metric: RuleMetric): number {
  switch (metric) {
    case 'temperature':
      return node.currentTemp;
    case 'temperatureDelta':
      return node.currentTemp - node.targetTemp;
    case 'workload':
      return node.workload;
    case 'status':
      return STATUS_CODE[node.status];
    case 'queueLength':
      return node.queueSize;
    case 'stackLength':
      return node.stackSize;
    default:
      return 0;
  }
}

export function compareValues(a: number, op: RuleOperator, b: number): boolean {
  switch (op) {
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    default:
      return false;
  }
}

export function matchTargetNodes(rule: Pick<Rule, 'subject' | 'nodeId'>, system: SystemSimulation): SimNode[] {
  const { subject, nodeId } = rule;
  switch (subject) {
    case 'system':
      return [system.generalNode];
    case 'node': {
      const node = nodeId === undefined ? undefined : system.getNode(nodeId);
      return node === undefined ? [] : [node];
    }
    case 'all':
    case 'any':
      return system.workers;
    default:
      return [];
  }
}

export function evaluateRule(rule: Rule, system: SystemSimulation): { triggered: boolean; nodes: SimNode[] } {
  const candidates = matchTargetNodes(rule, system);
  if (candidates.length === 0) {
    return { triggered: false, nodes: [] };
  }

  const matched = candidates.filter((n) =>
    compareValues(metricValue(n, rule.metric), rule.op, rule.value),
  );

  if (rule.subject === 'all') {
    return { triggered: matched.length === candidates.length, nodes: matched };
  }

  return { triggered: matched.length > 0, nodes: matched };
}

export function ruleSubjectNeedsNode(subject: RuleSubject): boolean {
  return subject === 'node';
}