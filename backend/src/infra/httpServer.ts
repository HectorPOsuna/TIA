import cors from 'cors';
import express from 'express';
import { logsRouter } from '../api/logs.routes.js';
import { nodesRouter } from '../api/nodes.routes.js';
import { rulesRouter } from '../api/rules.routes.js';
import { simulateRouter } from '../api/simulate.routes.js';
import { systemRouter } from '../api/system.routes.js';
import { tasksRouter } from '../api/tasks.routes.js';
import type { AppContext } from '../api/context.js';

export function buildHttpServer(ctx: AppContext, corsOrigin: string, httpLogging = true): express.Express {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '256kb' }));

  if (httpLogging) {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startedAt = process.hrtime.bigint();
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        ctx.logs.add(
          'info',
          'api',
          `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs.toFixed(1)} ms)`,
        );
      });
      next();
    });
  }

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
  app.use('/api/tasks', tasksRouter(ctx));

  app.use((_req, res) => {
    res.status(404).json({ error: 'recurso no encontrado' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[http] error:', err);
    res.status(500).json({ error: 'error interno del servidor' });
  });

  return app;
}