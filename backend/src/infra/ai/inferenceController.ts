import {
  DEFAULT_AI_POLICY,
  createAiNodeState,
  decideAiAction,
  type AiActionKind,
  type AiNodeState,
  type AiNodeView,
  type AiPolicy,
} from '../../domain/aiControl.js';
import { runAction } from '../../domain/actions.js';
import type { ActionLogger } from '../../domain/actions.js';
import type { SystemSimulation } from '../../domain/system.js';
import type { SimNode } from '../../domain/node.js';
import type { AiActionPayload, InferencePayload, SimEventMap } from '../../engine/events.js';
import type { EventBus } from '../../engine/eventBus.js';
import type { LogStore } from '../logger.js';

export interface AiControlOptions {
  enabled: boolean;
  policy: AiPolicy;
}

export interface AiNodeControlStatus {
  nodeId: string;
  baseTarget: number;
  offset: number;
  effectiveTarget: number;
  aiFan: boolean;
  aiShutdown: boolean;
  manualPauseUntil: number;
  hotStreak: number;
  coldStreak: number;
  lastAction: AiActionKind | null;
  lastActionAt: number;
}

export interface AiControlStatus {
  available: boolean;
  enabled: boolean;
  policy: AiPolicy;
  stats: {
    actions: number;
    actionsLastMinute: number;
    lastActionAt: number | null;
  };
  nodes: AiNodeControlStatus[];
  recent: AiActionPayload[];
}

const RECENT_LIMIT = 20;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizePolicy = (base: AiPolicy, patch: Partial<AiPolicy>): AiPolicy => {
  const merged = { ...base, ...patch };
  const loadMin = clamp(merged.loadMin, 0, 1);
  const loadMax = Math.max(loadMin, clamp(merged.loadMax, 0, 1));
  return {
    hotDelta: clamp(merged.hotDelta, 0.1, 20),
    coldDelta: clamp(merged.coldDelta, 0.1, 20),
    restoreDelta: clamp(merged.restoreDelta, 0, 20),
    confirmations: clamp(Math.round(merged.confirmations), 1, 20),
    cooldownMs: clamp(Math.round(merged.cooldownMs), 100, 300_000),
    maxActionsPerMinute: clamp(Math.round(merged.maxActionsPerMinute), 1, 600),
    loadStep: clamp(merged.loadStep, 0.01, 1),
    loadMin,
    loadMax,
    targetMargin: clamp(merged.targetMargin, 0, 1.5),
    targetStep: clamp(merged.targetStep, 0.1, 5),
    taskIntervalMs: clamp(Math.round(merged.taskIntervalMs), 1000, 300_000),
    emergencyDelta: clamp(merged.emergencyDelta, 1, 50),
    manualPauseMs: clamp(Math.round(merged.manualPauseMs), 0, 600_000),
    restartDelta: clamp(merged.restartDelta, 0, 20),
    minDowntimeMs: clamp(Math.round(merged.minDowntimeMs), 0, 600_000),
    allowFan: merged.allowFan,
    allowLoad: merged.allowLoad,
    allowTarget: merged.allowTarget,
    allowTasks: merged.allowTasks,
    allowShutdown: merged.allowShutdown,
  };
};

const nodeView = (node: SimNode): AiNodeView => {
  const processing = node.processingTask;
  return {
    id: node.id,
    type: node.type,
    status: node.status,
    currentTemp: node.currentTemp,
    targetTemp: node.targetTemp,
    workload: node.workload,
    fanActive: node.fanActive,
    fanUntilMs: node.fanUntilMs,
    queueSize: node.queueSize,
    queueCapacity: node.queueSnapshot().capacity,
    processingType: processing === null ? null : processing.type,
  };
};

export class InferenceController {
  private enabled: boolean;
  private policy: AiPolicy;
  private readonly states = new Map<string, AiNodeState>();
  private readonly recent: AiActionPayload[] = [];
  private actionTimes: number[] = [];
  private totalActions = 0;
  private lastActionAt: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly system: SystemSimulation,
    private readonly bus: EventBus<SimEventMap>,
    private readonly logs: LogStore,
    options: AiControlOptions = { enabled: false, policy: DEFAULT_AI_POLICY },
  ) {
    this.enabled = options.enabled;
    this.policy = normalizePolicy(DEFAULT_AI_POLICY, options.policy);
  }

  start(): void {
    if (this.unsubscribe !== null) {
      return;
    }
    for (const node of this.system.workers) {
      this.stateFor(node);
    }
    this.unsubscribe = this.bus.on('inference:completed', (payload) => {
      this.handle(payload);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.release();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updatePolicy(patch: Partial<AiPolicy>): AiPolicy {
    this.policy = normalizePolicy(this.policy, patch);
    return this.policy;
  }

  getPolicy(): AiPolicy {
    return this.policy;
  }

  reset(): void {
    this.states.clear();
    this.recent.length = 0;
    this.actionTimes = [];
    this.totalActions = 0;
    this.lastActionAt = null;
  }

  private release(): void {
    const now = Date.now();
    for (const node of this.system.workers) {
      const state = this.states.get(node.id);
      if (state === undefined) {
        continue;
      }
      let changed = false;
      if (state.targetOffset !== 0 || node.aiTargetOffset !== 0) {
        state.targetOffset = 0;
        node.aiTargetOffset = 0;
        changed = true;
      }
      const ownsFan =
        node.fanActive &&
        state.aiFanUntilMs !== null &&
        node.fanUntilMs === state.aiFanUntilMs;
      if (ownsFan) {
        node.fanActive = false;
        node.fanUntilMs = 0;
        changed = true;
      }
      if (state.aiShutdown && node.status === 'inactive') {
        node.status = 'active';
        changed = true;
      }
      state.hotStreak = 0;
      state.coldStreak = 0;
      state.neutralStreak = 0;
      state.lastWorkload = node.workload;
      state.aiFanUntilMs = null;
      state.aiShutdown = false;
      state.shutdownAt = 0;
      state.manualPauseUntil = 0;
      if (changed) {
        node.updatedAt = now;
        this.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
        this.logs.add('info', 'ai', `Estado de ${node.id} liberado al desactivar la IA`, node.id);
      }
    }
  }

  status(): AiControlStatus {
    const now = Date.now();
    this.actionTimes = this.actionTimes.filter((at) => now - at < 60_000);
    const nodes: AiNodeControlStatus[] = [];
    for (const node of this.system.allNodes()) {
      if (node.type !== 'worker') {
        continue;
      }
      const state = this.stateFor(node);
      nodes.push({
        nodeId: node.id,
        baseTarget: state.baseTarget,
        offset: state.targetOffset,
        effectiveTarget: state.baseTarget + state.targetOffset,
        aiFan: state.aiFanUntilMs !== null && node.fanUntilMs === state.aiFanUntilMs,
        aiShutdown: state.aiShutdown,
        manualPauseUntil: state.manualPauseUntil,
        hotStreak: state.hotStreak,
        coldStreak: state.coldStreak,
        lastAction: state.lastAction,
        lastActionAt: state.lastActionAt,
      });
    }
    return {
      available: true,
      enabled: this.enabled,
      policy: this.policy,
      stats: {
        actions: this.totalActions,
        actionsLastMinute: this.actionTimes.length,
        lastActionAt: this.lastActionAt,
      },
      nodes,
      recent: [...this.recent],
    };
  }

  private get actionLogger(): ActionLogger {
    return {
      log: (level, type, message, nodeId, meta) => {
        this.logs.add(level, type, message, nodeId, meta);
      },
    };
  }

  private stateFor(node: SimNode): AiNodeState {
    let state = this.states.get(node.id);
    if (state === undefined) {
      state = createAiNodeState(nodeView(node));
      this.states.set(node.id, state);
    }
    return state;
  }

  private handle(payload: InferencePayload): void {
    if (!this.enabled) {
      return;
    }
    const node = this.system.getNode(payload.nodeId);
    if (node === undefined || node.type !== 'worker') {
      return;
    }

    const now = Date.now();
    const state = this.stateFor(node);
    this.detectManualChanges(node, state, now);

    this.actionTimes = this.actionTimes.filter((at) => now - at < 60_000);
    if (this.actionTimes.length >= this.policy.maxActionsPerMinute) {
      return;
    }

    const decision = decideAiAction(
      nodeView(node),
      {
        predictedTemp: payload.predictedTemp,
        actualTemp: payload.actualTemp,
        at: payload.at,
      },
      state,
      this.policy,
      now,
    );
    if (decision.action === null) {
      return;
    }

    const applied = this.apply(
      node,
      state,
      decision.action,
      decision.params,
      decision.reason,
      payload,
      now,
    );
    if (!applied) {
      return;
    }
    state.lastActionAt = now;
    state.lastAction = decision.action;
    this.lastActionAt = now;
    this.actionTimes.push(now);
    this.totalActions += 1;

    const actionPayload: AiActionPayload = {
      nodeId: node.id,
      action: decision.action,
      params: decision.params,
      reason: decision.reason,
      predictedTemp: payload.predictedTemp,
      actualTemp: node.currentTemp,
      baseTarget: state.baseTarget,
      targetTemp: state.baseTarget + state.targetOffset,
      offset: state.targetOffset,
      applied: true,
      at: now,
    };
    this.recent.unshift(actionPayload);
    if (this.recent.length > RECENT_LIMIT) {
      this.recent.length = RECENT_LIMIT;
    }
    this.bus.emit('ai:action', actionPayload);
    this.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    this.logs.add(
      'info',
      'ai',
      `IA ${decision.action} en ${node.id}: ${decision.reason}`,
      node.id,
      {
        predictedTemp: payload.predictedTemp,
        baseTarget: state.baseTarget,
        offset: state.targetOffset,
        params: decision.params,
      },
    );
  }

  private detectManualChanges(node: SimNode, state: AiNodeState, now: number): void {
    if (Math.abs(node.targetTemp - state.baseTarget) > 0.0001) {
      state.baseTarget = node.targetTemp;
      state.targetOffset = 0;
      state.manualPauseUntil = now + this.policy.manualPauseMs;
    }

    if (state.aiFanUntilMs !== null) {
      const expired = !node.fanActive && node.fanUntilMs === 0 && now >= state.aiFanUntilMs;
      const changed =
        (node.fanActive && node.fanUntilMs !== state.aiFanUntilMs) ||
        (!node.fanActive && !expired);
      if (changed) {
        state.manualPauseUntil = now + this.policy.manualPauseMs;
      }
      if (changed || expired) {
        state.aiFanUntilMs = null;
      }
    }

    if (state.lastWorkload !== null && Math.abs(node.workload - state.lastWorkload) > 0.0001) {
      state.lastWorkload = null;
      state.manualPauseUntil = now + this.policy.manualPauseMs;
    }

    if (state.aiShutdown && node.status === 'active') {
      state.aiShutdown = false;
      state.shutdownAt = 0;
      state.manualPauseUntil = now + this.policy.manualPauseMs;
    }
  }

  private apply(
    node: SimNode,
    state: AiNodeState,
    action: AiActionKind,
    params: Record<string, unknown> | undefined,
    reason: string,
    payload: InferencePayload,
    now: number,
  ): boolean {
    switch (action) {
      case 'fan_on': {
        runAction('fan_on', params, node, this.actionLogger);
        state.aiFanUntilMs = node.fanUntilMs;
        return true;
      }
      case 'fan_off': {
        runAction('fan_off', params, node, this.actionLogger);
        state.aiFanUntilMs = null;
        return true;
      }
      case 'set_workload': {
        runAction('set_workload', params, node, this.actionLogger);
        state.lastWorkload = node.workload;
        return true;
      }
      case 'target_offset': {
        const raw = params?.offset;
        const offset =
          typeof raw === 'number' && Number.isFinite(raw)
            ? clamp(raw, -this.policy.targetMargin, this.policy.targetMargin)
            : state.targetOffset;
        state.targetOffset = offset;
        node.aiTargetOffset = offset;
        node.pushEvent(
          'change',
          `Objetivo efectivo de ${node.id} ajustado a ${(state.baseTarget + offset).toFixed(1)}C (base ${state.baseTarget.toFixed(1)}C)`,
        );
        this.logs.add('info', 'node', `Objetivo efectivo de ${node.id} ajustado por IA`, node.id, {
          baseTarget: state.baseTarget,
          offset,
        });
        return true;
      }
      case 'enqueue_cooldown':
      case 'enqueue_load': {
        const type = action === 'enqueue_cooldown' ? 'cooldown' : 'maintenance';
        if (node.queueSize >= node.queueSnapshot().capacity) {
          return false;
        }
        const result = node.enqueueTask({
          type,
          priority: 1,
          computeDemand: action === 'enqueue_cooldown' ? 3 : 1,
          durationSecs: 5,
          description: action === 'enqueue_cooldown' ? 'IA: enfriamiento' : 'IA: carga',
        });
        if (result.task === null) {
          return false;
        }
        state.lastTaskAt = now;
        this.bus.emit('task:queued', { nodeId: node.id, task: result.task });
        this.logs.add('info', 'task', `Tarea ${type} encolada por IA en ${node.id}`, node.id, {
          taskId: result.task.id,
          reason,
        });
        return true;
      }
      case 'shutdown': {
        runAction('shutdown', params, node, this.actionLogger);
        state.aiShutdown = true;
        state.shutdownAt = now;
        this.bus.emit('alert', {
          level: 'critical',
          message: `IA apagó ${node.id} por emergencia térmica (${payload.predictedTemp.toFixed(2)} °C)`,
          nodeId: node.id,
          at: now,
        });
        return true;
      }
      case 'startup': {
        runAction('startup', params, node, this.actionLogger);
        state.aiShutdown = false;
        state.shutdownAt = 0;
        return true;
      }
      default:
        return false;
    }
  }
}
