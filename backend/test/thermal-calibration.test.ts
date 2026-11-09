import { describe, expect, it } from 'vitest';
import { SimNode } from '../src/domain/node.js';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { thermalStep } from '../src/domain/thermal.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { LogStore } from '../src/infra/logger.js';

const DT_MS = 1000;

function simulate(node: SimNode, seconds: number): void {
  for (let i = 0; i < seconds; i += 1) {
    node.thermalStep(DT_MS);
  }
}

function near(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('calibración del modelo térmico', () => {
  it('un nodo inactivo converge al ambiente con la constante de 60 s', () => {
    let temp = 40;
    let previous = temp;
    for (let i = 0; i < 240; i += 1) {
      temp = thermalStep(temp, 30, 20, 0, false, false, DT_MS);
      expect(temp).toBeLessThanOrEqual(previous);
      previous = temp;
    }
    near(temp, 20 + 20 * Math.exp(-4), 0.05);
  });

  it('un nodo activo sin carga converge al equilibrio 29.62 °C', () => {
    const node = new SimNode({
      id: 'n1',
      name: 'n1',
      type: 'worker',
      initialTemp: 25,
      targetTemp: 30,
      ambientTemp: 20,
      workload: 0,
    });
    simulate(node, 600);
    near(node.currentTemp, 29.615, 0.05);
  });

  it('un nodo activo con carga 0.3 converge al equilibrio 31.63 °C', () => {
    const node = new SimNode({
      id: 'n1',
      name: 'n1',
      type: 'worker',
      initialTemp: 25,
      targetTemp: 30,
      ambientTemp: 20,
      workload: 0.3,
    });
    simulate(node, 600);
    near(node.currentTemp, 31.635, 0.05);
  });

  it('la inercia tarda 20 s en recorrer el 63 % del salto', () => {
    const node = new SimNode({
      id: 'n1',
      name: 'n1',
      type: 'worker',
      initialTemp: 25,
      targetTemp: 30,
      ambientTemp: 20,
      workload: 0,
    });
    simulate(node, 20);
    near(node.currentTemp, 28.16, 0.3);
  });

  it('el ventilador baja el equilibrio al menos 0.5 °C', () => {
    const sinFan = new SimNode({ id: 'a', name: 'a', type: 'worker', workload: 0.3 });
    const conFan = new SimNode({ id: 'b', name: 'b', type: 'worker', workload: 0.3 });
    conFan.fanActive = true;
    simulate(sinFan, 600);
    simulate(conFan, 600);
    expect(sinFan.currentTemp - conFan.currentTemp).toBeGreaterThanOrEqual(0.5);
    near(sinFan.currentTemp - conFan.currentTemp, 0.83, 0.1);
  });

  it('la demanda de cómputo 5 sube el equilibrio unos 6.7 °C', () => {
    const base = new SimNode({ id: 'a', name: 'a', type: 'worker', workload: 0.1 });
    const conTarea = new SimNode({ id: 'b', name: 'b', type: 'worker', workload: 0.1 });
    conTarea.enqueueTask({ type: 'custom', priority: 3, computeDemand: 5, durationSecs: 10 });
    conTarea.startNextTask();
    simulate(base, 600);
    simulate(conTarea, 600);
    near(conTarea.currentTemp - base.currentTemp, 6.73, 0.2);
  });

  it('una tarea cooldown baja el equilibrio unos 6.7 °C', () => {
    const base = new SimNode({ id: 'a', name: 'a', type: 'worker', workload: 0.1 });
    const conCooldown = new SimNode({ id: 'b', name: 'b', type: 'worker', workload: 0.1 });
    conCooldown.enqueueTask({ type: 'cooldown', priority: 3, computeDemand: 5, durationSecs: 10 });
    conCooldown.startNextTask();
    simulate(base, 600);
    simulate(conCooldown, 600);
    near(base.currentTemp - conCooldown.currentTemp, 6.73, 0.2);
  });

  it('10 000 ticks no producen NaN ni valores fuera de rango', () => {
    const node = new SimNode({ id: 'n1', name: 'n1', type: 'worker', workload: 0.3 });
    simulate(node, 10_000);
    expect(Number.isFinite(node.currentTemp)).toBe(true);
    expect(node.currentTemp).toBeGreaterThanOrEqual(-60);
    expect(node.currentTemp).toBeLessThanOrEqual(150);
  });

  it('el motor completo alcanza el equilibrio calibrado con carga por defecto', () => {
    const system = new SystemSimulation({
      initialNodes: 1,
      initialTemp: 25,
      targetTemp: 30,
      ambientTemp: 20,
      queueCapacity: 10,
      stackCapacity: 10,
      maxConsecutiveFailures: 5,
      poolCapacity: 10,
    });
    system.running = false;
    const rules = new RuleStore([]);
    const logs = new LogStore(100);
    const bus = new EventBus<SimEventMap>();
    const engine = new SimulationEngine({ system, rules, logs, bus }, 1000);

    for (let i = 0; i < 600; i += 1) {
      engine.stepOnce();
    }

    near(system.workers[0].currentTemp, 31.635, 0.1);
  });
});
