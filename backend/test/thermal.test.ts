import { describe, expect, it } from 'vitest';
import { SimNode } from '../src/domain/node.js';
import { DEFAULT_THERMAL_PARAMS, thermalStep } from '../src/domain/thermal.js';

const params = DEFAULT_THERMAL_PARAMS;

describe('modelo térmico', () => {
  it('converge hacia la temperatura objetivo', () => {
    let temp = 25;
    const target = 30;
    const dt = 1000;
    for (let i = 0; i < 300; i += 1) {
      temp = thermalStep(temp, target, 20, 0.1, true, false, dt, params);
    }
    expect(temp).toBeGreaterThan(30.05);
    expect(temp).toBeLessThan(30.5);
  });

  it('la carga de trabajo eleva el punto de equilibrio por encima del objetivo', () => {
    let temp = 30;
    const target = 30;
    for (let i = 0; i < 600; i += 1) {
      temp = thermalStep(temp, target, 20, 1, true, false, 1000, params);
    }
    expect(temp).toBeGreaterThan(31);
  });

  it('el ventilador acelera la disipación hacia la temperatura ambiente', () => {
    const dt = 5000;
    const sinFan = thermalStep(80, 20, 20, 0, true, false, dt, params);
    const conFan = thermalStep(80, 20, 20, 0, true, true, dt, params);
    expect(conFan).toBeLessThan(sinFan);
  });

  it('un nodo inactivo mantiene su temperatura sin variación', () => {
    const next = thermalStep(45.5, 30, 20, 0.5, false, false, 10_000, params);
    expect(next).toBe(45.5);
  });

  it('la demanda de cómputo de la tarea en curso eleva más la temperatura', () => {
    const conDemanda = new SimNode({ id: 'n1', name: 'n1', type: 'worker' });
    const sinDemanda = new SimNode({ id: 'n2', name: 'n2', type: 'worker' });
    conDemanda.workload = 0.1;
    sinDemanda.workload = 0.1;
    conDemanda.enqueueTask({ type: 'custom', priority: 3, computeDemand: 5, durationSecs: 2 });
    conDemanda.startNextTask();

    for (let i = 0; i < 300; i += 1) {
      conDemanda.thermalStep(1000);
      sinDemanda.thermalStep(1000);
    }
    expect(conDemanda.currentTemp).toBeGreaterThan(sinDemanda.currentTemp);
  });

  it('la demanda de cómputo no sube la temperatura si el nodo está parado', () => {
    const parado = new SimNode({ id: 'n3', name: 'n3', type: 'worker', status: 'inactive' });
    parado.workload = 0.1;
    for (let i = 0; i < 100; i += 1) {
      parado.thermalStep(1000);
    }
    expect(parado.currentTemp).toBe(25);
  });
});