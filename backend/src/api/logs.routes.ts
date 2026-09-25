import { Router } from 'express';
import type { LogType } from '../domain/types.js';
import { parseQueryLevels, parseQueryLimit } from './validation.js';
import type { AppContext } from './context.js';

const LOG_TYPES: readonly LogType[] = ['system', 'api', 'rule', 'task', 'node', 'alert'];

export function logsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const level = parseQueryLevels(req.query.level);
    const rawType = req.query.type;
    const type = typeof rawType === 'string' && LOG_TYPES.includes(rawType as LogType)
      ? (rawType as LogType)
      : undefined;
    const rawNodeId = req.query.nodeId;
    const nodeId = typeof rawNodeId === 'string' ? rawNodeId : undefined;
    const rawSince = req.query.since;
    const since = typeof rawSince === 'string' && /^\d+$/.test(rawSince) ? Number(rawSince) : undefined;
    const limit = parseQueryLimit(req.query.limit, ctx.logs.size, 100);

    const logs = ctx.logs.list({ level, type, nodeId, since, limit });
    res.json({ logs, size: ctx.logs.size, returned: logs.length });
  });

  router.delete('/', (_req, res) => {
    ctx.logs.clear();
    ctx.logs.add('info', 'system', 'Logs limpiados por el usuario');
    res.status(204).end();
  });

  return router;
}