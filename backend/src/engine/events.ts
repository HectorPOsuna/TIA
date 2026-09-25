import type { NodeDto, Rule, SystemSnapshotDto, TaskDto } from '../domain/types.js';

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

export interface AlertPayload {
  level: 'warning' | 'critical';
  message: string;
  nodeId?: string;
  at: number;
}

export interface SimEventMap {
  'state:update': SystemSnapshotDto;
  'node:updated': NodeUpdatedPayload;
  'rule:triggered': RuleTriggeredPayload;
  'task:queued': TaskEventPayload;
  'task:completed': TaskEventPayload;
  alert: AlertPayload;
}