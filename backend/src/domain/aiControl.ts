import type { NodeStatus, NodeType } from './types.js';

export type AiActionKind =
  | 'fan_on'
  | 'fan_off'
  | 'set_workload'
  | 'target_offset'
  | 'enqueue_cooldown'
  | 'enqueue_load'
  | 'shutdown'
  | 'startup';

export interface AiPolicy {
  hotDelta: number;
  coldDelta: number;
  restoreDelta: number;
  confirmations: number;
  cooldownMs: number;
  maxActionsPerMinute: number;
  loadStep: number;
  loadMin: number;
  loadMax: number;
  targetMargin: number;
  targetStep: number;
  taskIntervalMs: number;
  emergencyDelta: number;
  manualPauseMs: number;
  restartDelta: number;
  minDowntimeMs: number;
  allowFan: boolean;
  allowLoad: boolean;
  allowTarget: boolean;
  allowTasks: boolean;
  allowShutdown: boolean;
}

export const DEFAULT_AI_POLICY: AiPolicy = {
  hotDelta: 1.5,
  coldDelta: 1.5,
  restoreDelta: 0.5,
  confirmations: 2,
  cooldownMs: 5000,
  maxActionsPerMinute: 20,
  loadStep: 0.1,
  loadMin: 0.05,
  loadMax: 0.8,
  targetMargin: 1.5,
  targetStep: 0.5,
  taskIntervalMs: 15_000,
  emergencyDelta: 10,
  manualPauseMs: 30_000,
  restartDelta: 2,
  minDowntimeMs: 30_000,
  allowFan: true,
  allowLoad: true,
  allowTarget: true,
  allowTasks: true,
  allowShutdown: false,
};

export interface AiNodeState {
  baseTarget: number;
  targetOffset: number;
  hotStreak: number;
  coldStreak: number;
  neutralStreak: number;
  lastActionAt: number;
  lastAction: AiActionKind | null;
  lastTaskAt: number;
  aiFanUntilMs: number | null;
  lastWorkload: number | null;
  aiShutdown: boolean;
  shutdownAt: number;
  manualPauseUntil: number;
}

export interface AiNodeView {
  id: string;
  type: NodeType;
  status: NodeStatus;
  currentTemp: number;
  targetTemp: number;
  workload: number;
  fanActive: boolean;
  fanUntilMs: number;
  queueSize: number;
  queueCapacity: number;
  processingType: string | null;
}

export interface AiPredictionView {
  predictedTemp: number;
  actualTemp: number;
  at: number;
}

export interface AiDecision {
  action: AiActionKind | null;
  params?: Record<string, unknown>;
  reason: string;
}

export function createAiNodeState(node: AiNodeView): AiNodeState {
  return {
    baseTarget: node.targetTemp,
    targetOffset: 0,
    hotStreak: 0,
    coldStreak: 0,
    neutralStreak: 0,
    lastActionAt: 0,
    lastAction: null,
    lastTaskAt: 0,
    aiFanUntilMs: null,
    lastWorkload: node.workload,
    aiShutdown: false,
    shutdownAt: 0,
    manualPauseUntil: 0,
  };
}

const noAction = (reason: string): AiDecision => ({ action: null, reason });

const AI_OWNED_FAN = (node: AiNodeView, state: AiNodeState): boolean =>
  node.fanActive && state.aiFanUntilMs !== null && node.fanUntilMs === state.aiFanUntilMs;

const closeTo = (a: number, b: number, epsilon = 0.0001): boolean => Math.abs(a - b) <= epsilon;

export function decideAiAction(
  node: AiNodeView,
  prediction: AiPredictionView,
  state: AiNodeState,
  policy: AiPolicy,
  now: number,
): AiDecision {
  if (node.type === 'general') {
    return noAction('el servidor general es un agregado; no se controla');
  }
  if (node.status === 'error') {
    return noAction('nodo en error');
  }
  if (!Number.isFinite(prediction.predictedTemp)) {
    return noAction('predicción inválida');
  }
  if (now < state.manualPauseUntil) {
    return noAction('pausa por cambio manual');
  }

  const delta = prediction.predictedTemp - state.baseTarget;
  const cooldownReady = now - state.lastActionAt >= policy.cooldownMs;

  if (node.status === 'inactive') {
    state.hotStreak = 0;
    state.coldStreak = 0;
    state.neutralStreak = 0;
    if (
      state.aiShutdown &&
      now - state.shutdownAt >= policy.minDowntimeMs &&
      cooldownReady &&
      (!policy.allowShutdown ||
        prediction.predictedTemp < state.baseTarget - policy.restartDelta)
    ) {
      return {
        action: 'startup',
        reason: policy.allowShutdown
          ? `nodo apagado por la IA y ya está suficientemente frío (${prediction.predictedTemp.toFixed(2)} °C)`
          : 'apagado de emergencia deshabilitado; reactivando el nodo',
      };
    }
    return noAction('nodo inactivo');
  }

  if (delta > policy.hotDelta) {
    state.hotStreak = Math.min(state.hotStreak + 1, 10_000);
    state.coldStreak = 0;
    state.neutralStreak = 0;

    if (state.hotStreak < policy.confirmations) {
      return noAction('confirmando tendencia caliente');
    }
    if (!cooldownReady) {
      return noAction('cooldown activo');
    }
    if (
      policy.allowShutdown &&
      delta >= policy.emergencyDelta &&
      state.hotStreak >= policy.confirmations * 2
    ) {
      return {
        action: 'shutdown',
        reason: `emergencia térmica: ${prediction.predictedTemp.toFixed(2)} °C supera el objetivo en ${delta.toFixed(2)} °C`,
      };
    }
    if (policy.allowFan && !node.fanActive) {
      return {
        action: 'fan_on',
        params: { minutes: 5 },
        reason: `predicción ${prediction.predictedTemp.toFixed(2)} °C por encima del objetivo`,
      };
    }
    if (policy.allowLoad && node.workload > policy.loadMin + 0.0001) {
      const value = Math.max(policy.loadMin, node.workload - policy.loadStep);
      return {
        action: 'set_workload',
        params: { value },
        reason: `reduciendo carga para bajar ${delta.toFixed(2)} °C`,
      };
    }
    const canEnqueue =
      policy.allowTasks &&
      node.queueSize < node.queueCapacity * 0.5 &&
      now - state.lastTaskAt >= policy.taskIntervalMs &&
      node.processingType !== 'cooldown';
    if (canEnqueue) {
      return {
        action: 'enqueue_cooldown',
        params: { computeDemand: 3, durationSecs: 5 },
        reason: 'encolando tarea de enfriamiento',
      };
    }
    if (policy.allowTarget && state.targetOffset > -policy.targetMargin + 0.0001) {
      const offset = Math.max(-policy.targetMargin, state.targetOffset - policy.targetStep);
      return {
        action: 'target_offset',
        params: { offset },
        reason: 'ajustando el objetivo efectivo hacia abajo',
      };
    }
    return noAction('caliente, sin acciones disponibles');
  }

  if (delta < -policy.coldDelta) {
    state.coldStreak = Math.min(state.coldStreak + 1, 10_000);
    state.hotStreak = 0;
    state.neutralStreak = 0;

    if (state.coldStreak < policy.confirmations) {
      return noAction('confirmando tendencia fría');
    }
    if (!cooldownReady) {
      return noAction('cooldown activo');
    }
    if (policy.allowFan && AI_OWNED_FAN(node, state)) {
      return {
        action: 'fan_off',
        reason: `predicción ${prediction.predictedTemp.toFixed(2)} °C por debajo del objetivo`,
      };
    }
    if (policy.allowLoad && node.workload < policy.loadMax - 0.0001) {
      const value = Math.min(policy.loadMax, node.workload + policy.loadStep);
      return {
        action: 'set_workload',
        params: { value },
        reason: `subiendo carga para recuperar temperatura`,
      };
    }
    if (policy.allowTarget && state.targetOffset < policy.targetMargin - 0.0001) {
      const offset = Math.min(policy.targetMargin, state.targetOffset + policy.targetStep);
      return {
        action: 'target_offset',
        params: { offset },
        reason: 'ajustando el objetivo efectivo hacia arriba',
      };
    }
    const canEnqueue =
      policy.allowTasks &&
      node.queueSize < node.queueCapacity * 0.5 &&
      now - state.lastTaskAt >= policy.taskIntervalMs &&
      node.processingType !== 'maintenance';
    if (canEnqueue) {
      return {
        action: 'enqueue_load',
        params: { computeDemand: 1, durationSecs: 5 },
        reason: 'encolando tarea de carga para generar calor',
      };
    }
    return noAction('frío, sin acciones disponibles');
  }

  state.hotStreak = 0;
  state.coldStreak = 0;
  state.neutralStreak += 1;

  if (!cooldownReady) {
    return noAction('en banda');
  }
  if (policy.allowFan && AI_OWNED_FAN(node, state) && delta <= policy.restoreDelta) {
    return {
      action: 'fan_off',
      reason: 'temperatura de vuelta en banda',
    };
  }
  if (
    policy.allowTarget &&
    !closeTo(state.targetOffset, 0) &&
    Math.abs(delta) <= policy.restoreDelta
  ) {
    const offset =
      Math.abs(state.targetOffset) <= policy.targetStep
        ? 0
        : state.targetOffset > 0
          ? state.targetOffset - policy.targetStep
          : state.targetOffset + policy.targetStep;
    return {
      action: 'target_offset',
      params: { offset },
      reason: 'restaurando el objetivo efectivo',
    };
  }
  return noAction('en banda');
}
