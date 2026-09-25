import { Router, type Response } from 'express';
import { createId } from '../domain/ids.js';
import { parseBody, createNodeSchema, enqueueTaskSchema, patchNodeSchema } from './validation.js';
import type { AppContext } from './context.js';

const notFound = (res: Response, message = 'nodo no encontrado') =>
  res.status(404).json({ error: message });

export function nodesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ nodes: ctx.system.allNodes().map((n) => n.toDto()) });
  });

  router.get('/:id', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    res.json({ node: node.toDto() });
  });

  router.post('/', (req, res) => {
    const parsed = parseBody(createNodeSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const node = ctx.system.addWorker({ ...parsed.value, id: createId('node') });
    ctx.logs.add('info', 'api', `Nodo creado: ${node.id} (${node.name})`, node.id);
    ctx.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.status(201).json({ node: node.toDto() });
  });

  router.delete('/:id', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    if (node.type === 'general') {
      return res.status(400).json({ error: 'el nodo general no puede eliminarse' });
    }
    ctx.system.removeWorker(node.id);
    ctx.logs.add('warning', 'api', `Nodo eliminado: ${node.id} (${node.name})`, node.id);
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.status(204).end();
  });

  router.patch('/:id', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    const parsed = parseBody(patchNodeSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }

    const p = parsed.value;
    if (p.name !== undefined) node.name = p.name;
    if (p.status !== undefined) node.status = p.status;
    if (p.targetTemp !== undefined) node.targetTemp = p.targetTemp;
    if (p.ambientTemp !== undefined) node.ambientTemp = p.ambientTemp;
    if (p.workload !== undefined) node.workload = p.workload;

    if (p.fanActive === true || p.fanMinutes !== undefined) {
      const minutes = p.fanMinutes ?? 2;
      node.fanActive = true;
      node.fanUntilMs = Date.now() + minutes * 60_000;
    } else if (p.fanActive === false) {
      node.fanActive = false;
      node.fanUntilMs = 0;
    }

    node.updatedAt = Date.now();
    ctx.logs.add('info', 'api', `Nodo actualizado: ${node.id}`, node.id, { campos: Object.keys(p) });
    ctx.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.json({ node: node.toDto() });
  });

  router.get('/:id/queue', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    res.json({ queue: node.queueSnapshot() });
  });

  router.post('/:id/queue', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    const parsed = parseBody(enqueueTaskSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const { task, reason } = node.enqueueTask(parsed.value);
    if (task === null) {
      return res.status(409).json({ error: `no se pudo encolar la tarea: ${reason}` });
    }
    ctx.logs.add('info', 'task', `Tarea ${task.type} encolada en ${node.id} (API)`, node.id, {
      taskId: task.id,
    });
    ctx.bus.emit('task:queued', { nodeId: node.id, task });
    ctx.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    res.status(201).json({ task });
  });

  router.delete('/:id/queue', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    const removed = node.clearQueue();
    ctx.logs.add('warning', 'task', `Cola de ${node.id} vaciada (${removed.length} tareas)`, node.id);
    ctx.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    ctx.bus.emit('state:update', ctx.system.getSnapshot());
    res.json({ removed: removed.length });
  });

  router.get('/:id/stack', (req, res) => {
    const node = ctx.system.getNode(req.params.id);
    if (node === undefined) {
      return notFound(res);
    }
    res.json({ stack: node.stackSnapshot() });
  });

  return router;
}