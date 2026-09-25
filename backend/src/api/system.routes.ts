import { Router } from 'express';
import { parseBody, systemPatchSchema } from './validation.js';
import type { AppContext } from './context.js';

export function systemRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ system: ctx.system.getSnapshot() });
  });

  router.patch('/', (req, res) => {
    const parsed = parseBody(systemPatchSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }

    const p = parsed.value;
    const changes: string[] = [];

    if (p.targetTemp !== undefined) {
      ctx.system.setTargetTemp(p.targetTemp);
      changes.push('targetTemp');
    }
    if (p.ambientTemp !== undefined) {
      ctx.system.setAmbientTemp(p.ambientTemp);
      changes.push('ambientTemp');
    }
    if (p.running !== undefined) {
      if (p.running) {
        ctx.engine.resume();
        changes.push('running');
      } else {
        ctx.engine.pause();
        changes.push('running');
      }
    }

    ctx.logs.add('info', 'api', 'Configuración del sistema actualizada', undefined, { cambios: changes });
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.json({ system: ctx.system.getSnapshot() });
  });

  return router;
}