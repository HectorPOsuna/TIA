import { Router } from 'express';
import { z } from 'zod';
import { parseBody } from './validation.js';
import type { AppContext } from './context.js';
import type { InferenceService } from '../infra/ai/inferenceService.js';

const predictSchema = z.object({
  nodeId: z.string().min(1).optional(),
  nodes: z.array(z.string().min(1)).optional(),
  horizonMs: z.number().int().min(1000).max(120_000).optional(),
});

export function inferenceRouter(ctx: AppContext): Router {
  const router = Router();
  const service: InferenceService | undefined = ctx.inference;

  router.get('/version', async (_req, res) => {
    if (service === undefined) {
      return res.status(503).json({ error: 'inferencia deshabilitada' });
    }
    const info = await service.version();
    res.json(info);
  });

  router.post('/predict', async (req, res) => {
    if (service === undefined) {
      return res.status(503).json({ error: 'inferencia deshabilitada' });
    }
    const parsed = parseBody(predictSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    if (parsed.value.nodeId === undefined && parsed.value.nodes === undefined) {
      return res.status(400).json({ error: 'se requiere nodeId o nodes' });
    }
    if (parsed.value.nodeId !== undefined) {
      const known = ctx.system.getSnapshot();
      const exists =
        known.general.id === parsed.value.nodeId ||
        known.workers.some((w) => w.id === parsed.value.nodeId);
      if (!exists) {
        return res.status(404).json({ error: 'nodo no encontrado' });
      }
      if (!service.hasWindow(parsed.value.nodeId)) {
        return res.status(409).json({ error: 'ventana de muestras insuficiente para el nodo' });
      }
      const outcome = await service.predictNow(parsed.value.nodeId, parsed.value.horizonMs);
      if (!outcome.ok) {
        return res.status(502).json({ error: outcome.error });
      }
      ctx.bus.emit('inference:completed', outcome);
      return res.json(outcome);
    }
    const ids = parsed.value.nodes ?? [];
    const snapshot = ctx.system.getSnapshot();
    const results = [];
    for (const id of ids) {
      const exists = snapshot.general.id === id || snapshot.workers.some((w) => w.id === id);
      if (!exists) {
        results.push({ nodeId: id, ok: false, error: 'nodo no encontrado' });
        continue;
      }
      if (!service.hasWindow(id)) {
        results.push({ nodeId: id, ok: false, error: 'ventana de muestras insuficiente' });
        continue;
      }
      const outcome = await service.predictNow(id, parsed.value.horizonMs);
      if (outcome.ok) {
        ctx.bus.emit('inference:completed', outcome);
      }
      results.push(outcome);
    }
    res.json({ count: results.length, results });
  });

  return router;
}
