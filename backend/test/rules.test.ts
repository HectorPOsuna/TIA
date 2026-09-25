import { describe, expect, it } from 'vitest';
import { evaluateRule, matchTargetNodes, metricValue } from '../src/domain/rules.js';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import type { Rule } from '../src/domain/types.js';

const seed = {
  initialNodes: 3,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
};

function makeRule(partial: Partial<Rule>): Rule {
  return {
    id: 'rule-1',
    name: 'Regla de prueba',
    enabled: true,
    cooldownMs: 0,
    subject: 'any',
    metric: 'temperature',
    op: '>',
    value: 50,
    action: 'fan_on',
    triggerCount: 0,
    ...partial,
  };
}

describe('evaluación de reglas reactivas', () => {
  it('dispara cuando un nodo supera el umbral de temperatura', () => {
    const system = new SystemSimulation(seed);
    system.getNode('node-1')!.currentTemp = 60;

    const rule = makeRule({ subject: 'any', metric: 'temperature', op: '>', value: 55 });
    const { triggered, nodes } = evaluateRule(rule, system);
    expect(triggered).toBe(true);
    expect(nodes.map((n) => n.id)).toContain('node-1');
  });

  it('no dispara si ningún nodo cumple la condición', () => {
    const system = new SystemSimulation(seed);
    const rule = makeRule({ subject: 'any', metric: 'temperature', op: '>', value: 100 });
    const { triggered } = evaluateRule(rule, system);
    expect(triggered).toBe(false);
  });

  it('solo tiene en cuenta el nodo indicado cuando subject=node', () => {
    const system = new SystemSimulation(seed);
    system.getNode('node-2')!.currentTemp = 80;

    const rule = makeRule({
      subject: 'node',
      nodeId: 'node-1',
      metric: 'temperature',
      op: '>',
      value: 60,
    });
    const { triggered, nodes } = evaluateRule(rule, system);
    expect(triggered).toBe(false);
    expect(nodes).toHaveLength(0);

    const rule2 = makeRule({
      subject: 'node',
      nodeId: 'node-2',
      metric: 'temperature',
      op: '>',
      value: 60,
    });
    const res2 = evaluateRule(rule2, system);
    expect(res2.triggered).toBe(true);
    expect(res2.nodes[0].id).toBe('node-2');
  });

  it('subject=all exige que todos los nodos cumplan', () => {
    const system = new SystemSimulation(seed);
    system.workers.forEach((n) => (n.currentTemp = 70));
    const rule = makeRule({ subject: 'all', metric: 'temperature', op: '>', value: 60 });
    const { triggered, nodes } = evaluateRule(rule, system);
    expect(triggered).toBe(true);
    expect(nodes).toHaveLength(3);
  });

  it('evaluación contra el nodo general con subject=system', () => {
    const system = new SystemSimulation(seed);
    system.generalNode.currentTemp = 35;
    const { triggered, nodes } = evaluateRule(
      makeRule({ subject: 'system', metric: 'temperature', op: '>', value: 33 }),
      system,
    );
    expect(triggered).toBe(true);
    expect(nodes[0].id).toBe('node-general');
  });

  it('expone métricas numéricas comparables', () => {
    const system = new SystemSimulation(seed);
    const node = system.getNode('node-1')!;
    expect(metricValue(node, 'status')).toBe(0);
    node.status = 'error';
    expect(metricValue(node, 'status')).toBe(2);
  });
});

describe('RuleStore', () => {
  it('añade, actualiza y elimina reglas', () => {
    const store = new RuleStore();
    const created = store.add({ name: 'Nueva', enabled: true, cooldownMs: 1000, subject: 'any', metric: 'temperature', op: '>', value: 40, action: 'fan_on' });
    expect(created.id).toBeTruthy();
    expect(store.get(created.id)?.name).toBe('Nueva');

    const updated = store.update(created.id, { enabled: false });
    expect(updated?.enabled).toBe(false);

    expect(store.remove(created.id)).toBe(true);
    expect(store.count()).toBe(0);
  });
});

describe('matchTargetNodes', () => {
  it('resuelve subject any/all a workers y system al nodo general', () => {
    const system = new SystemSimulation({ ...seed, initialNodes: 2 });
    expect(matchTargetNodes({ subject: 'any' }, system)).toHaveLength(2);
    expect(matchTargetNodes({ subject: 'all' }, system)).toHaveLength(2);
    expect(matchTargetNodes({ subject: 'system' }, system).map((n) => n.id)).toEqual(['node-general']);
    expect(
      matchTargetNodes({ subject: 'node', nodeId: 'node-1' }, system).map((n) => n.id),
    ).toEqual(['node-1']);
  });
});