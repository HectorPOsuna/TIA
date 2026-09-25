import { Router } from 'express';
import { parseBody, rulePatchSchema, ruleSchema } from './validation.js';
import type { AppContext } from './context.js';

export function rulesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ rules: ctx.rules.list() });
  });

  router.post('/', (req, res) => {
    const parsed = parseBody(ruleSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const rule = ctx.rules.add(parsed.value);
    ctx.logs.add('info', 'rule', `Regla creada: "${rule.name}"`, undefined, { ruleId: rule.id });
    res.status(201).json({ rule });
  });

  router.patch('/:id', (req, res) => {
    const parsed = parseBody(rulePatchSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const rule = ctx.rules.update(req.params.id, parsed.value);
    if (rule === undefined) {
      return res.status(404).json({ error: 'regla no encontrada' });
    }
    ctx.logs.add('info', 'rule', `Regla actualizada: "${rule.name}"`, undefined, { ruleId: rule.id });
    res.json({ rule });
  });

  router.delete('/:id', (req, res) => {
    const removed = ctx.rules.remove(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'regla no encontrada' });
    }
    ctx.logs.add('warning', 'rule', `Regla eliminada: ${req.params.id}`);
    res.status(204).end();
  });

  return router;
}