import { z } from 'zod';
import {
  ACTION_TYPE_VALUES,
  NODE_STATUS_VALUES,
  RULE_METRIC_VALUES,
  RULE_OPERATOR_VALUES,
  RULE_SUBJECT_VALUES,
  TASK_TYPE_VALUES,
} from '../domain/types.js';

export const temperatureSchema = z.number().min(-60).max(150);
export const workloadSchema = z.number().min(0).max(1);

const paramsRecord = z.record(z.string(), z.unknown());

export const patchNodeSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    status: z.enum(NODE_STATUS_VALUES).optional(),
    targetTemp: temperatureSchema.optional(),
    ambientTemp: temperatureSchema.optional(),
    workload: workloadSchema.optional(),
    fanActive: z.boolean().optional(),
    fanMinutes: z.number().int().min(1).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No se enviaron campos para actualizar' });

export const createNodeSchema = z.object({
  name: z.string().min(1).max(80),
  initialTemp: temperatureSchema.optional(),
  targetTemp: temperatureSchema.optional(),
  ambientTemp: temperatureSchema.optional(),
  workload: workloadSchema.optional(),
});

export const enqueueTaskSchema = z.object({
  type: z.enum(TASK_TYPE_VALUES).default('custom'),
  estimatedDurationMs: z.number().int().min(100).max(3_600_000).default(5000),
  description: z.string().max(120).optional(),
  payload: paramsRecord.optional(),
});

export const systemPatchSchema = z
  .object({
    targetTemp: temperatureSchema.optional(),
    ambientTemp: temperatureSchema.optional(),
    running: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No se enviaron campos para actualizar' });

const ruleFields = {
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  cooldownMs: z.number().int().min(0).max(3_600_000),
  subject: z.enum(RULE_SUBJECT_VALUES),
  nodeId: z.string().min(1),
  metric: z.enum(RULE_METRIC_VALUES),
  op: z.enum(RULE_OPERATOR_VALUES),
  value: z.number(),
  action: z.enum(ACTION_TYPE_VALUES),
  actionParams: paramsRecord,
};

export const ruleSchema = z
  .object({
    name: ruleFields.name,
    enabled: ruleFields.enabled.default(true),
    cooldownMs: ruleFields.cooldownMs.default(30000),
    subject: ruleFields.subject.default('any'),
    nodeId: ruleFields.nodeId.optional(),
    metric: ruleFields.metric,
    op: ruleFields.op,
    value: ruleFields.value,
    action: ruleFields.action,
    actionParams: ruleFields.actionParams.optional(),
  })
  .refine((v) => v.subject !== 'node' || v.nodeId !== undefined, {
    message: 'nodeId es obligatorio cuando subject=node',
    path: ['nodeId'],
  });

export const rulePatchSchema = z
  .object({
    name: ruleFields.name.optional(),
    enabled: ruleFields.enabled.optional(),
    cooldownMs: ruleFields.cooldownMs.optional(),
    subject: ruleFields.subject.optional(),
    nodeId: ruleFields.nodeId.optional(),
    metric: ruleFields.metric.optional(),
    op: ruleFields.op.optional(),
    value: ruleFields.value.optional(),
    action: ruleFields.action.optional(),
    actionParams: ruleFields.actionParams.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No se enviaron campos para actualizar' });

export type PatchNodeInput = z.infer<typeof patchNodeSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type EnqueueTaskInput = z.infer<typeof enqueueTaskSchema>;
export type SystemPatchInput = z.infer<typeof systemPatchSchema>;
export type RuleInputZod = z.infer<typeof ruleSchema>;
export type RulePatchInput = z.infer<typeof rulePatchSchema>;

export function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): { ok: true; value: z.output<S> } | { ok: false; issues: z.ZodIssue[] } {
  const result = schema.safeParse(body);
  return result.success ? { ok: true, value: result.data } : { ok: false, issues: result.error.issues };
}

export function parseQueryLimit(raw: unknown, max: number, fallback = 100): number {
  const n = typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(n), max);
}

export function parseQueryLevels(raw: unknown): Array<'info' | 'warning' | 'critical'> | undefined {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }
  const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  const levels: Array<'info' | 'warning' | 'critical'> = [];
  for (const part of parts) {
    if (part === 'info' || part === 'warning' || part === 'critical') {
      levels.push(part);
    }
  }
  return levels.length > 0 ? levels : undefined;
}