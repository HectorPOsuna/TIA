import { Router } from 'express';
import { z } from 'zod';
import { DEFAULT_AI_POLICY } from '../domain/aiControl.js';
import { parseBody } from './validation.js';
import type { AppContext } from './context.js';

const policySchema = z
  .object({
    hotDelta: z.number().min(0.1).max(20).optional(),
    coldDelta: z.number().min(0.1).max(20).optional(),
    restoreDelta: z.number().min(0).max(20).optional(),
    confirmations: z.number().int().min(1).max(20).optional(),
    cooldownMs: z.number().int().min(100).max(300_000).optional(),
    maxActionsPerMinute: z.number().int().min(1).max(600).optional(),
    loadStep: z.number().min(0.01).max(1).optional(),
    loadMin: z.number().min(0).max(1).optional(),
    loadMax: z.number().min(0).max(1).optional(),
    targetMargin: z.number().min(0).max(1.5).optional(),
    targetStep: z.number().min(0.1).max(5).optional(),
    taskIntervalMs: z.number().int().min(1000).max(300_000).optional(),
    emergencyDelta: z.number().min(1).max(50).optional(),
    manualPauseMs: z.number().int().min(0).max(600_000).optional(),
    restartDelta: z.number().min(0).max(20).optional(),
    minDowntimeMs: z.number().int().min(0).max(600_000).optional(),
    allowFan: z.boolean().optional(),
    allowLoad: z.boolean().optional(),
    allowTarget: z.boolean().optional(),
    allowTasks: z.boolean().optional(),
    allowShutdown: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No se enviaron parámetros de política',
  });

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    policy: policySchema.optional(),
  })
  .refine((value) => value.enabled !== undefined || value.policy !== undefined, {
    message: 'No se enviaron cambios',
  });

export function aiRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/control', (_req, res) => {
    const controller = ctx.aiControl;
    if (controller === undefined) {
      return res.json({
        available: false,
        enabled: false,
        policy: DEFAULT_AI_POLICY,
        stats: { actions: 0, actionsLastMinute: 0, lastActionAt: null },
        nodes: [],
        recent: [],
      });
    }
    res.json(controller.status());
  });

  router.patch('/control', (req, res) => {
    const controller = ctx.aiControl;
    if (controller === undefined) {
      return res.status(503).json({ error: 'control de IA no disponible: inferencia deshabilitada' });
    }
    const parsed = parseBody(patchSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    if (parsed.value.enabled !== undefined) {
      controller.setEnabled(parsed.value.enabled);
    }
    if (parsed.value.policy !== undefined) {
      controller.updatePolicy(parsed.value.policy);
    }
    ctx.logs.add(
      'warning',
      'ai',
      parsed.value.enabled === undefined
        ? 'Política de control IA actualizada'
        : `Control IA ${parsed.value.enabled ? 'activado' : 'desactivado'}`,
    );
    res.json(controller.status());
  });

  return router;
}
