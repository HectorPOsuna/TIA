import { Router } from 'express';
import { EVENT_IDS } from '../domain/events.js';
import type { EventId } from '../domain/events.js';
import { eventGeneratorPatchSchema, eventPatchSchema, eventTriggerSchema, parseBody } from './validation.js';
import type { AppContext } from './context.js';

const isEventId = (value: string): value is EventId => (EVENT_IDS as readonly string[]).includes(value);

const MUTATING_EVENTS: readonly EventId[] = [
  'thermal_spike',
  'node_failure',
  'node_recovery',
  'fan_failure',
  'workload_surge',
];

export function eventsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(ctx.events.state);
  });

  router.patch('/', (req, res) => {
    const parsed = parseBody(eventGeneratorPatchSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const generator = ctx.events.patchGenerator(parsed.value);
    ctx.logs.add(
      'info',
      'api',
      `Generador de eventos ${generator.enabled ? 'activado' : 'detenido'} (intervalo ${generator.intervalMs} ms)`,
      undefined,
      { enabled: generator.enabled, intervalMs: generator.intervalMs },
    );
    res.json(ctx.events.state);
  });

  router.patch('/:id', (req, res) => {
    if (!isEventId(req.params.id)) {
      return res.status(404).json({ error: 'evento no encontrado' });
    }
    const parsed = parseBody(eventPatchSchema, req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const event = ctx.events.patchEvent(req.params.id, parsed.value);
    if (event === null) {
      return res.status(404).json({ error: 'evento no encontrado' });
    }
    ctx.logs.add('info', 'api', `Evento ${event.id} actualizado`, undefined, {
      probability: event.probability,
      cooldownMs: event.cooldownMs,
      enabled: event.enabled,
    });
    res.json({ event });
  });

  router.post('/:id/trigger', (req, res) => {
    const id = req.params.id;
    if (!isEventId(id)) {
      return res.status(404).json({ error: 'evento no encontrado' });
    }
    const parsed = parseBody(eventTriggerSchema, req.body ?? {});
    if (!parsed.ok) {
      return res.status(400).json({ error: 'validación', issues: parsed.issues });
    }
    const { nodeId } = parsed.value;
    if (nodeId !== undefined) {
      const node = ctx.system.getNode(nodeId);
      if (node === undefined) {
        return res.status(404).json({ error: 'nodo no encontrado' });
      }
      if (node.isGeneral && MUTATING_EVENTS.includes(id)) {
        return res.status(400).json({ error: 'el nodo general no admite perturbaciones' });
      }
    }
    const event = ctx.events.trigger(id, parsed.value);
    res.json({ event });
  });

  return router;
}
