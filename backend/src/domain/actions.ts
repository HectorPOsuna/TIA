import { DEFAULT_TASK_DURATION_MS } from './tasks.js';
import type { TaskType } from './types.js';
import type { SimNode } from './node.js';

export interface ActionLogger {
  log(
    level: 'info' | 'warning' | 'critical',
    type: 'rule' | 'node' | 'task' | 'alert',
    message: string,
    nodeId?: string,
    meta?: Record<string, unknown>,
  ): void;
}

const numParam = (params: Record<string, unknown> | undefined, key: string, fallback: number): number => {
  const raw = params?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
};

const strParam = (params: Record<string, unknown> | undefined, key: string, fallback: string): string => {
  const raw = params?.[key];
  return typeof raw === 'string' ? raw : fallback;
};

const FAN_MINUTES_DEFAULT = 2;

export function runAction(
  action: string,
  params: Record<string, unknown> | undefined,
  node: SimNode,
  logger: ActionLogger,
): void {
  const now = Date.now();

  switch (action) {
    case 'fan_on': {
      const minutes = numParam(params, 'minutes', FAN_MINUTES_DEFAULT);
      node.fanActive = true;
      node.fanUntilMs = now + minutes * 60_000;
      node.pushEvent('change', `Ventilador activado (${minutes} min) en ${node.id}`);
      logger.log('info', 'node', `Ventilador activado en ${node.id}`, node.id, { action, minutes });
      break;
    }
    case 'fan_off': {
      node.fanActive = false;
      node.fanUntilMs = 0;
      node.pushEvent('change', `Ventilador desactivado en ${node.id}`);
      logger.log('info', 'node', `Ventilador desactivado en ${node.id}`, node.id, { action });
      break;
    }
    case 'shutdown': {
      if (node.status !== 'inactive') {
        node.status = 'inactive';
        node.pushEvent('change', `Nodo ${node.id} apagado`);
        logger.log('warning', 'node', `Nodo ${node.id} apagado`, node.id, { action });
      }
      break;
    }
    case 'startup': {
      if (node.status !== 'active') {
        node.status = 'active';
        node.pushEvent('change', `Nodo ${node.id} reactivado`);
        logger.log('info', 'node', `Nodo ${node.id} reactivado`, node.id, { action });
      }
      break;
    }
    case 'enqueue_task': {
      const type = strParam(params, 'taskType', 'cooldown') as TaskType;
      const durationMs = numParam(params, 'durationMs', DEFAULT_TASK_DURATION_MS);
      const description = strParam(params, 'description', `Tarea automática (${type})`);
      const result = node.enqueueTask({ type, estimatedDurationMs: durationMs, description });
      logger.log(
        result.task !== null ? 'info' : 'warning',
        'task',
        result.task !== null
          ? `Tarea encolada en ${node.id} por regla`
          : `No se pudo encolar tarea en ${node.id}: ${result.reason}`,
        node.id,
        { action, type, taskId: result.task?.id, reason: result.reason },
      );
      break;
    }
    case 'send_alert': {
      const message = strParam(params, 'message', `Alerta en ${node.id}`);
      logger.log('critical', 'alert', message, node.id, { action });
      break;
    }
    case 'reduce_load': {
      const by = numParam(params, 'by', 0.3);
      node.workload = Math.max(0, node.workload - by);
      node.pushEvent('change', `Carga reducida en ${node.id}`);
      logger.log('info', 'node', `Carga reducida en ${node.id}`, node.id, { action, by });
      break;
    }
    case 'set_target_temperature': {
      const target = numParam(params, 'target', node.targetTemp);
      node.targetTemp = target;
      node.pushEvent('change', `Objetivo de ${node.id} ajustado a ${target}C`);
      logger.log('info', 'node', `Objetivo de temperatura de ${node.id} ajustado a ${target}C`, node.id, {
        action,
        target,
      });
      break;
    }
    default:
      break;
  }
}