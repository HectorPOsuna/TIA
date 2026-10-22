import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_POLICY,
  createAiNodeState,
  decideAiAction,
  type AiNodeView,
  type AiPolicy,
} from '../src/domain/aiControl.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import type { AiActionPayload, SimEventMap } from '../src/engine/events.js';
import { InferenceController } from '../src/infra/ai/inferenceController.js';
import { LogStore } from '../src/infra/logger.js';

const policy: AiPolicy = {
  ...DEFAULT_AI_POLICY,
  cooldownMs: 100,
  confirmations: 2,
  loadStep: 0.1,
  loadMin: 0.05,
  loadMax: 0.8,
  targetStep: 0.5,
  targetMargin: 1.5,
};

const makeNode = (overrides: Partial<AiNodeView> = {}): AiNodeView => ({
  id: 'node-1',
  type: 'worker',
  status: 'active',
  currentTemp: 32,
  targetTemp: 30,
  workload: 0.3,
  fanActive: false,
  fanUntilMs: 0,
  queueSize: 0,
  queueCapacity: 50,
  processingType: null,
  ...overrides,
});

const prediction = (predictedTemp: number, at = 1000) => ({
  predictedTemp,
  actualTemp: 31,
  at,
});

describe('política de control IA', () => {
  it('exige dos predicciones calientes antes de actuar', () => {
    const node = makeNode();
    const state = createAiNodeState(node);
    expect(decideAiAction(node, prediction(35), state, policy, 1000).action).toBeNull();
    expect(decideAiAction(node, prediction(35), state, policy, 1100).action).toBe('fan_on');
  });

  it('respeta el cooldown tras aplicar una acción', () => {
    const node = makeNode();
    const state = createAiNodeState(node);
    decideAiAction(node, prediction(35), state, policy, 1000);
    expect(decideAiAction(node, prediction(35), state, policy, 1100).action).toBe('fan_on');
    state.lastActionAt = 1100;
    expect(decideAiAction(node, prediction(35), state, policy, 1150).action).toBeNull();
  });

  it('con el ventilador encendido reduce la carga', () => {
    const node = makeNode({ fanActive: true, fanUntilMs: 5000 });
    const state = createAiNodeState(node);
    state.aiFanUntilMs = 5000;
    state.hotStreak = 5;
    state.lastActionAt = 0;
    const decision = decideAiAction(node, prediction(35), state, policy, 1000);
    expect(decision.action).toBe('set_workload');
    expect(decision.params?.value).toBeCloseTo(0.2);
  });

  it('en frío apaga solo el ventilador que encendió la IA', () => {
    const node = makeNode({ fanActive: true, fanUntilMs: 5000 });
    const state = createAiNodeState(node);
    state.aiFanUntilMs = 5000;
    state.coldStreak = 5;
    expect(decideAiAction(node, prediction(25), state, policy, 1000).action).toBe('fan_off');

    const manual = makeNode({ fanActive: true, fanUntilMs: 9000 });
    const manualState = createAiNodeState(manual);
    manualState.aiFanUntilMs = 5000;
    manualState.coldStreak = 5;
    manualState.lastActionAt = 0;
    expect(decideAiAction(manual, prediction(25), manualState, policy, 1000).action).not.toBe(
      'fan_off',
    );
  });

  it('en frío sube la carga y luego el objetivo', () => {
    const node = makeNode({ workload: 0.5 });
    const state = createAiNodeState(node);
    state.coldStreak = 5;
    state.lastActionAt = 0;
    const load = decideAiAction(node, prediction(25), state, policy, 1000);
    expect(load.action).toBe('set_workload');
    expect(load.params?.value).toBeCloseTo(0.6);

    const maxed = makeNode({ workload: 0.8 });
    const maxedState = createAiNodeState(maxed);
    maxedState.coldStreak = 5;
    maxedState.lastActionAt = 0;
    const target = decideAiAction(maxed, prediction(25), maxedState, policy, 1000);
    expect(target.action).toBe('target_offset');
    expect(target.params?.offset).toBeCloseTo(0.5);
  });

  it('restaura el offset cuando vuelve a banda', () => {
    const node = makeNode();
    const state = createAiNodeState(node);
    state.targetOffset = -1;
    state.lastActionAt = 0;
    const decision = decideAiAction(node, prediction(30.2), state, policy, 1000);
    expect(decision.action).toBe('target_offset');
    expect(decision.params?.offset).toBeCloseTo(-0.5);
  });

  it('solo apaga por emergencia si está permitido y la tendencia persiste', () => {
    const node = makeNode();
    const state = createAiNodeState(node);
    state.hotStreak = 1;
    state.lastActionAt = 0;
    expect(
      decideAiAction(node, prediction(50), state, { ...policy, allowShutdown: true }, 1000).action,
    ).toBe('fan_on');

    state.hotStreak = 4;
    state.lastActionAt = 0;
    expect(
      decideAiAction(
        node,
        prediction(50),
        state,
        { ...policy, allowShutdown: true, allowFan: false, allowLoad: false, allowTasks: false, allowTarget: false },
        1000,
      ).action,
    ).toBe('shutdown');
  });

  it('no controla el nodo general ni nodos en error', () => {
    const general = makeNode({ type: 'general' });
    const error = makeNode({ status: 'error' });
    const state = createAiNodeState(general);
    state.hotStreak = 5;
    expect(decideAiAction(general, prediction(50), state, policy, 1000).action).toBeNull();
    expect(decideAiAction(error, prediction(50), state, policy, 1000).action).toBeNull();
  });

  it('reactiva el nodo si se deshabilita el apagado de emergencia', () => {
    const node = makeNode({ status: 'inactive', currentTemp: 34 });
    const state = createAiNodeState(node);
    state.aiShutdown = true;
    state.shutdownAt = 1000;
    state.lastActionAt = 0;
    const decision = decideAiAction(
      node,
      prediction(34),
      state,
      { ...policy, allowShutdown: false, minDowntimeMs: 1000 },
      5000,
    );
    expect(decision.action).toBe('startup');
  });

  it('reactiva un nodo que apagó la IA cuando ya está frío', () => {
    const node = makeNode({ status: 'inactive', currentTemp: 22 });
    const state = createAiNodeState(node);
    state.aiShutdown = true;
    state.shutdownAt = 1000;
    state.lastActionAt = 0;
    const decision = decideAiAction(
      node,
      prediction(22),
      state,
      { ...policy, minDowntimeMs: 1000, restartDelta: 2, allowShutdown: true },
      5000,
    );
    expect(decision.action).toBe('startup');
  });
});

describe('controlador de inferencia', () => {
  it('aplica una acción y emite ai:action', () => {
    const system = new SystemSimulation({
      initialNodes: 1,
      initialTemp: 32,
      targetTemp: 30,
      ambientTemp: 20,
      queueCapacity: 10,
      stackCapacity: 10,
      maxConsecutiveFailures: 5,
      poolCapacity: 10,
    });
    const bus = new EventBus<SimEventMap>();
    const logs = new LogStore(50);
    const controller = new InferenceController(system, bus, logs, {
      enabled: true,
      policy: { ...policy, allowFan: true },
    });
    controller.start();
    const actions: AiActionPayload[] = [];
    bus.on('ai:action', (payload) => actions.push(payload));
    const node = system.workers[0];
    const payload = {
      nodeId: node.id,
      predictedTemp: 36,
      actualTemp: 32,
      horizonMs: 15_000,
      modelVersion: 'test',
      latencyMs: 1,
      at: Date.now(),
    };
    bus.emit('inference:completed', payload);
    bus.emit('inference:completed', payload);
    expect(node.fanActive).toBe(true);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('fan_on');
    expect(controller.status().stats.actions).toBe(1);
  });

  it('pausa si detecta un cambio manual de carga antes de actuar', () => {
    const system = new SystemSimulation({
      initialNodes: 1,
      initialTemp: 32,
      targetTemp: 30,
      ambientTemp: 20,
      queueCapacity: 10,
      stackCapacity: 10,
      maxConsecutiveFailures: 5,
      poolCapacity: 10,
    });
    const bus = new EventBus<SimEventMap>();
    const controller = new InferenceController(system, bus, new LogStore(50), {
      enabled: true,
      policy: { ...policy, allowFan: true },
    });
    controller.start();
    const node = system.workers[0];
    node.workload = 0.6;
    bus.emit('inference:completed', {
      nodeId: node.id,
      predictedTemp: 36,
      actualTemp: 32,
      horizonMs: 15_000,
      modelVersion: 'test',
      latencyMs: 1,
      at: Date.now(),
    });
    expect(node.fanActive).toBe(false);
    expect(controller.status().nodes[0].manualPauseUntil).toBeGreaterThan(Date.now());
  });

  it('libera ventilador, offset y apagado al desactivarse', () => {
    const build = () => {
      const system = new SystemSimulation({
        initialNodes: 1,
        initialTemp: 36,
        targetTemp: 30,
        ambientTemp: 20,
        queueCapacity: 10,
        stackCapacity: 10,
        maxConsecutiveFailures: 5,
        poolCapacity: 10,
      });
      const bus = new EventBus<SimEventMap>();
      const controller = new InferenceController(system, bus, new LogStore(50), {
        enabled: true,
        policy: {
          ...policy,
          confirmations: 1,
          emergencyDelta: 1,
          allowFan: false,
          allowLoad: false,
          allowTarget: false,
          allowTasks: false,
          allowShutdown: false,
        },
      });
      controller.start();
      return { system, bus, controller, node: system.workers[0] };
    };
    const payload = (nodeId: string, predictedTemp: number) => ({
      nodeId,
      predictedTemp,
      actualTemp: 36,
      horizonMs: 15_000,
      modelVersion: 'test',
      latencyMs: 1,
      at: Date.now(),
    });

    const fan = build();
    fan.controller.updatePolicy({ allowFan: true });
    fan.bus.emit('inference:completed', payload(fan.node.id, 36));
    expect(fan.node.fanActive).toBe(true);
    fan.controller.setEnabled(false);
    expect(fan.node.fanActive).toBe(false);

    const offset = build();
    offset.controller.updatePolicy({ allowTarget: true });
    offset.bus.emit('inference:completed', payload(offset.node.id, 36));
    expect(offset.node.aiTargetOffset).toBeLessThan(0);
    offset.controller.setEnabled(false);
    expect(offset.node.aiTargetOffset).toBe(0);

    const shutdown = build();
    shutdown.controller.updatePolicy({ allowShutdown: true });
    shutdown.bus.emit('inference:completed', payload(shutdown.node.id, 36));
    shutdown.bus.emit('inference:completed', payload(shutdown.node.id, 36));
    expect(shutdown.node.status).toBe('inactive');
    shutdown.controller.setEnabled(false);
    expect(shutdown.node.status).toBe('active');
  });

  it('no actúa si está desactivado', () => {
    const system = new SystemSimulation({
      initialNodes: 1,
      initialTemp: 32,
      targetTemp: 30,
      ambientTemp: 20,
      queueCapacity: 10,
      stackCapacity: 10,
      maxConsecutiveFailures: 5,
      poolCapacity: 10,
    });
    const bus = new EventBus<SimEventMap>();
    const controller = new InferenceController(system, bus, new LogStore(50), {
      enabled: false,
      policy,
    });
    controller.start();
    const node = system.workers[0];
    const payload = {
      nodeId: node.id,
      predictedTemp: 36,
      actualTemp: 32,
      horizonMs: 15_000,
      modelVersion: 'test',
      latencyMs: 1,
      at: Date.now(),
    };
    bus.emit('inference:completed', payload);
    bus.emit('inference:completed', payload);
    expect(node.fanActive).toBe(false);
  });
});
