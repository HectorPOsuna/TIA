import { Router } from 'express';
import type { AppContext } from './context.js';

export function simulateRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      running: ctx.engine.running,
      tickMs: ctx.engine.tickMs,
      uptimeMs: ctx.engine.uptimeMs,
      nodesCount: ctx.system.allNodes().length,
      rulesCount: ctx.rules.count(),
      logsCount: ctx.logs.size,
    });
  });

  router.post('/pause', (_req, res) => {
    ctx.engine.pause();
    res.json({ running: false });
  });

  router.post('/resume', (_req, res) => {
    ctx.engine.resume();
    res.json({ running: true });
  });

  router.post('/tick', (_req, res) => {
    try {
      ctx.engine.stepOnce();
      res.json({ ok: true, tickMs: ctx.engine.tickMs });
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  router.post('/reset', (_req, res) => {
    ctx.engine.reset();
    res.json({ ok: true });
  });

  return router;
}