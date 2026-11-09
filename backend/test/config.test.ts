import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('configuración de simulación', () => {
  it('acepta 200 nodos iniciales para pruebas de estrés', () => {
    const config = loadConfig({ INITIAL_NODES: '200' });

    expect(config.INITIAL_NODES).toBe(200);
  });

  it('rechaza más de 200 nodos iniciales', () => {
    expect(() => loadConfig({ INITIAL_NODES: '201' })).toThrow();
  });
});
