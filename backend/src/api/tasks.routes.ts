import { Router } from 'express';
import { parseBody, enqueueTaskSchema } from './validation.js';
import type { AppContext } from './context.js';

export function tasksRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ pending: ctx.system.pendingSnapshot() });
  });

  router.post('/', (req, res) => {
    const parsed = parseBody(enqueueTaskSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const task = ctx.system.submitPending(parsed.value);
    if (task === null) {
      return res.status(409).json({ error: 'pool de tareas pendientes lleno' });
    }
    ctx.logs.add(
      'info',
      'task',
      `Tarea p${task.priority} ${task.type} encolada en el pool global (API)`,
      undefined,
      { taskId: task.id },
    );
    ctx.bus.emit('task:pending', { task });
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.status(201).json({ task });
  });

  router.delete('/', (_req, res) => {
    const removed = ctx.system.clearPending();
    ctx.logs.add('warning', 'task', `Pool global vaciado (${removed.length} tareas)`);
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.json({ removed: removed.length });
  });

  return router;
}