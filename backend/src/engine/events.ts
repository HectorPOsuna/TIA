import type { NodeDto, Rule, SystemSnapshotDto, TaskDto } from '../domain/types.js';
import type { AiActionKind } from '../domain/aiControl.js';

export interface NodeUpdatedPayload {
  nodeId: string;
  node: NodeDto;
}

export interface RuleTriggeredPayload {
  rule: Rule;
  nodeId?: string;
  at: number;
}

export interface TaskEventPayload {
  nodeId: string;
  task: TaskDto;
}

export interface TaskPendingPayload {
  task: TaskDto;
}

export interface AlertPayload {
  level: 'warning' | 'critical';
  message: string;
  nodeId?: string;
  at: number;
}

export interface InferencePayload {
  nodeId: string;
  predictedTemp: number;
  actualTemp: number;
  horizonMs: number;
  modelVersion: string;
  latencyMs: number;
  featuresHash?: string;
  at: number;
}

export interface AiActionPayload {
  nodeId: string;
  action: AiActionKind;
  params?: Record<string, unknown>;
  reason: string;
  predictedTemp: number;
  actualTemp: number;
  baseTarget: number;
  targetTemp: number;
  offset: number;
  applied: boolean;
  at: number;
}

export interface SimEventMap {
  'state:update': SystemSnapshotDto;
  'node:updated': NodeUpdatedPayload;
  'rule:triggered': RuleTriggeredPayload;
  'task:queued': TaskEventPayload;
  'task:completed': TaskEventPayload;
  'task:pending': TaskPendingPayload;
  alert: AlertPayload;
  'inference:completed': InferencePayload;
  'ai:action': AiActionPayload;
}