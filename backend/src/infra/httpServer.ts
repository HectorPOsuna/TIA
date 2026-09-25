import cors from 'cors';
import express from 'express';
import { logsRouter } from '../api/logs.routes.js';
import { nodesRouter } from '../api/nodes.routes.js';
import { rulesRouter } from '../api/rules.routes.js';
import { simulateRouter } from '../api/simulate.routes.js';
import { systemRouter } from '../api/system.routes.js';
import type { AppContext } from '../api/context.js';

export function buildHttpServer(ctx: AppContext, corsOrigin: string): express.Express {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      running: ctx.engine.running,
      tickMs: ctx.engine.tickMs,
      uptimeMs: ctx.engine.uptimeMs,
    });
  });

  app.use('/api/nodes', nodesRouter(ctx));
  app.use('/api/system', systemRouter(ctx));
  app.use('/api/rules', rulesRouter(ctx));
  app.use('/api/logs', logsRouter(ctx));
  app.use('/api/sim', simulateRouter(ctx));

  app.use((_req, res) => {
    res.status(404).json({ error: 'recurso no encontrado' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[http] error:', err);
    res.status(500).json({ error: 'error interno del servidor' });
  });

  return app;
}