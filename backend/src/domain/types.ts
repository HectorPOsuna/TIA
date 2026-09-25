export type NodeType = 'general' | 'worker';
export type NodeStatus = 'active' | 'inactive' | 'error';

export const NODE_STATUS_VALUES: readonly NodeStatus[] = ['active', 'inactive', 'error'];

export const STATUS_CODE: Record<NodeStatus, number> = {
  active: 0,
  inactive: 1,
  error: 2,
};

export type TaskType =
  | 'cooldown'
  | 'maintenance'
  | 'reboot'
  | 'calibration'
  | 'custom';

export const TASK_TYPE_VALUES: readonly TaskType[] = [
  'cooldown',
  'maintenance',
  'reboot',
  'calibration',
  'custom',
];

export type TaskStatus = 'pending' | 'processing' | 'completed';

export interface Task {
  id: string;
  type: TaskType;
  payload?: Record<string, unknown>;
  status: TaskStatus;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDurationMs: number;
  description?: string;
}

export type StackEntryKind = 'event' | 'task' | 'rule' | 'alert' | 'change';

export interface StackEntry {
  ts: number;
  kind: StackEntryKind;
  label: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface TaskDto {
  id: string;
  type: TaskType;
  payload?: Record<string, unknown>;
  status: TaskStatus;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDurationMs: number;
  description?: string;
}

export interface QueueDto {
  list: TaskDto[];
  size: number;
  capacity: number;
  remaining: number;
  processing: TaskDto | null;
}

export interface StackDto {
  list: StackEntry[];
  size: number;
  capacity: number;
}

export interface NodeStats {
  failures: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  ok: boolean;
}

export interface NodeDto {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  currentTemp: number;
  targetTemp: number;
  ambientTemp: number;
  workload: number;
  fanActive: boolean;
  fanUntilMs: number;
  stats: NodeStats;
  queue: QueueDto;
  stack: StackDto;
  updatedAt: number;
}

export type LogLevel = 'info' | 'warning' | 'critical';

export type LogType =
  | 'system'
  | 'api'
  | 'rule'
  | 'task'
  | 'node'
  | 'alert';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  type: LogType;
  message: string;
  nodeId?: string;
  meta?: Record<string, unknown>;
}

export type RuleMetric =
  | 'temperature'
  | 'temperatureDelta'
  | 'workload'
  | 'status'
  | 'queueLength'
  | 'stackLength';

export const RULE_METRIC_VALUES: readonly RuleMetric[] = [
  'temperature',
  'temperatureDelta',
  'workload',
  'status',
  'queueLength',
  'stackLength',
];

export type RuleOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

export const RULE_OPERATOR_VALUES: readonly RuleOperator[] = [
  '>',
  '>=',
  '<',
  '<=',
  '==',
  '!=',
];

export type RuleSubject = 'any' | 'all' | 'system' | 'node';

export const RULE_SUBJECT_VALUES: readonly RuleSubject[] = [
  'any',
  'all',
  'system',
  'node',
];

export type ActionType =
  | 'fan_on'
  | 'fan_off'
  | 'shutdown'
  | 'startup'
  | 'enqueue_task'
  | 'send_alert'
  | 'reduce_load'
  | 'set_target_temperature';

export const ACTION_TYPE_VALUES: readonly ActionType[] = [
  'fan_on',
  'fan_off',
  'shutdown',
  'startup',
  'enqueue_task',
  'send_alert',
  'reduce_load',
  'set_target_temperature',
];

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  cooldownMs: number;
  subject: RuleSubject;
  nodeId?: string;
  metric: RuleMetric;
  op: RuleOperator;
  value: number;
  action: ActionType;
  actionParams?: Record<string, unknown>;
  lastTriggeredAt?: number;
  triggerCount: number;
}

export type RuleInput = Omit<Rule, 'id' | 'lastTriggeredAt' | 'triggerCount'>;

export interface SystemSummary {
  totalWorkers: number;
  activeWorkers: number;
  inactiveWorkers: number;
  errorWorkers: number;
  averageTemp: number;
}

export interface SystemSnapshotDto {
  ts: number;
  running: boolean;
  targetTemp: number;
  ambientTemp: number;
  general: NodeDto;
  workers: NodeDto[];
  summary: SystemSummary;
}