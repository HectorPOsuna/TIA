import { describe, expect, it } from 'vitest';
import { SimNode } from '../src/domain/node.js';

describe('tolerancia a fallos del nodo', () => {
  it('pasa a error tras el máximo de fallos consecutivos', () => {
    const node = new SimNode({
      id: 'n1',
      name: 'n1',
      type: 'worker',
      maxConsecutiveFailures: 3,
    });

    node.markFailure(1);
    node.markFailure(2);
    expect(node.status).toBe('active');

    node.markFailure(3);
    expect(node.status).toBe('error');
    expect(node.ok).toBe(false);
  });

  it('recover limpia el contador de fallos consecutivos', () => {
    const node = new SimNode({
      id: 'n1',
      name: 'n1',
      type: 'worker',
      maxConsecutiveFailures: 2,
    });
    node.markFailure(1);
    node.markFailure(2);
    expect(node.consecutiveFailures).toBe(2);

    node.recover(3);

    expect(node.consecutiveFailures).toBe(0);
    expect(node.ok).toBe(true);
  });
});
