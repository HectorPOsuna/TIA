import { describe, expect, it } from 'vitest';
import { runAction } from '../src/domain/actions.js';
import { SystemSimulation } from '../src/domain/system.js';

const seed = {
  initialNodes: 1,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 1,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 20,
};

const logger = { log: () => undefined };

describe('resultado de acciones simuladas', () => {
  it('marca como aplicada una acción que cambia el nodo', () => {
    const system = new SystemSimulation(seed);
    const node = system.getNode('node-1')!;

    const result = runAction('fan_on', { minutes: 1 }, node, logger);

    expect(result).toMatchObject({ applied: true });
    expect(node.fanActive).toBe(true);
  });

  it('marca como no aplicada una tarea rechazada por cola llena', () => {
    const system = new SystemSimulation(seed);
    const node = system.generalNode;

    expect(runAction('enqueue_task', { durationSecs: 1 }, node, logger)).toMatchObject({
      applied: true,
    });
    expect(runAction('enqueue_task', { durationSecs: 1 }, node, logger)).toMatchObject({
      applied: false,
      reason: 'cola llena',
    });
  });

  it('marca como no aplicada una acción desconocida', () => {
    const system = new SystemSimulation(seed);
    const node = system.getNode('node-1')!;

    expect(runAction('accion_inexistente', undefined, node, logger)).toMatchObject({
      applied: false,
      reason: 'acción desconocida',
    });
  });
});
