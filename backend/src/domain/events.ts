import type { SimNode } from './node.js';
import type { SystemSimulation } from './system.js';
import {
  COMPUTE_DEMAND_MAX,
  COMPUTE_DEMAND_MIN,
  DURATION_SECS_MAX,
  DURATION_SECS_MIN,
  TASK_PRIORITY_MAX,
  TASK_PRIORITY_MIN,
  TASK_TYPE_VALUES,
} from './types.js';
import type { Task } from './types.js';

export type EventId =
  | 'task_arrival'
  | 'thermal_spike'
  | 'node_failure'
  | 'node_recovery'
  | 'fan_failure'
  | 'workload_surge'
  | 'synthetic_alert';

export type EventCategory = 'traffic' | 'perturbation';

export const EVENT_IDS: readonly EventId[] = [
  'task_arrival',
  'thermal_spike',
  'node_failure',
  'node_recovery',
  'fan_failure',
  'workload_surge',
  'synthetic_alert',
];

export interface EventDefinition {
  id: EventId;
  name: string;
  category: EventCategory;
  description: string;
  defaultProbability: number;
  defaultCooldownMs: number;
  defaultParams: Record<string, unknown>;
}

export const EVENT_CATALOG: readonly EventDefinition[] = [
  {
    id: 'task_arrival',
    name: 'Llegada de tareas',
    category: 'traffic',
    description: 'Encola entre 1 y 3 tareas en el pool global o en la cola de un nodo.',
    defaultProbability: 0.08,
    defaultCooldownMs: 3000,
    defaultParams: { count: 2 },
  },
  {
    id: 'thermal_spike',
    name: 'Pico térmico',
    category: 'perturbation',
    description: 'Suma una magnitud de temperatura a un worker.',
    defaultProbability: 0.02,
    defaultCooldownMs: 15000,
    defaultParams: { magnitude: 6 },
  },
  {
    id: 'node_failure',
    name: 'Fallo de nodo',
    category: 'perturbation',
    description: 'Fuerza el estado de error de un worker sin cancelar su tarea actual.',
    defaultProbability: 0.01,
    defaultCooldownMs: 60000,
    defaultParams: {},
  },
  {
    id: 'node_recovery',
    name: 'Recuperación de nodo',
    category: 'perturbation',
    description: 'Devuelve un worker al estado activo y limpia sus fallos.',
    defaultProbability: 0.03,
    defaultCooldownMs: 30000,
    defaultParams: {},
  },
  {
    id: 'fan_failure',
    name: 'Fallo de ventilador',
    category: 'perturbation',
    description: 'Apaga el ventilador de un worker.',
    defaultProbability: 0.01,
    defaultCooldownMs: 30000,
    defaultParams: {},
  },
  {
    id: 'workload_surge',
    name: 'Pico de carga',
    category: 'perturbation',
    description: 'Suma carga a un worker con un máximo de 1.',
    defaultProbability: 0.02,
    defaultCooldownMs: 30000,
    defaultParams: { magnitude: 0.35 },
  },
  {
    id: 'synthetic_alert',
    name: 'Alerta sintética',
    category: 'perturbation',
    description: 'Emite una alerta sin modificar el estado térmico del nodo.',
    defaultProbability: 0.01,
    defaultCooldownMs: 30000,
    defaultParams: { level: 'critical' },
  },
];

export interface EventRequest {
  nodeId?: string;
  params?: Record<string, unknown>;
}

export interface EventOutcome {
  applied: boolean;
  nodeId?: string;
  message: string;
  taskIds?: string[];
  tasks?: Task[];
  params?: Record<string, unknown>;
}

export interface EventContext {
  system: SystemSimulation;
  now: number;
  rng: () => number;
  request?: EventRequest;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampInt = (value: number, min: number, max: number): number =>
  clamp(Math.round(value), min, max);

const numParam = (params: Record<string, unknown> | undefined, key: string, fallback: number): number => {
  const raw = params?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
};

const strParam = (params: Record<string, unknown> | undefined, key: string, fallback: string): string => {
  const raw = params?.[key];
  return typeof raw === 'string' ? raw : fallback;
};

const randInt = (rng: () => number, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const pickWorker = (
  system: SystemSimulation,
  rng: () => number,
  predicate: (node: SimNode) => boolean,
): SimNode | undefined => {
  const candidates = system.workers.filter(predicate);
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
};

const definitionOf = (id: EventId): EventDefinition =>
  EVENT_CATALOG.find((event) => event.id === id) as EventDefinition;

const mergeParams = (id: EventId, request: EventRequest | undefined): Record<string, unknown> => ({
  ...definitionOf(id).defaultParams,
  ...request?.params,
});

const failure = (
  id: EventId,
  message: string,
  nodeId?: string,
  request?: EventRequest,
): EventOutcome => ({
  applied: false,
  nodeId,
  message,
  params: mergeParams(id, request),
});

const findRequestedNode = (
  system: SystemSimulation,
  nodeId: string,
): SimNode | undefined => system.getNode(nodeId);

const applyTaskArrival = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const params = mergeParams('task_arrival', request);
  const rawCount = params.count;
  const count =
    typeof rawCount === 'number' && Number.isFinite(rawCount)
      ? clampInt(rawCount, 1, 3)
      : randInt(rng, 1, 3);
  const node = request?.nodeId === undefined ? undefined : findRequestedNode(system, request.nodeId);
  if (request?.nodeId !== undefined && node === undefined) {
    return failure('task_arrival', `nodo ${request.nodeId} no encontrado`, request.nodeId, request);
  }

  const tasks: Task[] = [];
  let reason: string | undefined;
  for (let i = 0; i < count; i += 1) {
    const options = {
      type: TASK_TYPE_VALUES[randInt(rng, 0, TASK_TYPE_VALUES.length - 1)],
      priority: randInt(rng, TASK_PRIORITY_MIN, TASK_PRIORITY_MAX),
      computeDemand: randInt(rng, COMPUTE_DEMAND_MIN, COMPUTE_DEMAND_MAX),
      durationSecs: randInt(rng, DURATION_SECS_MIN, DURATION_SECS_MAX),
      enqueuedAt: now,
      description: 'Tarea generada por evento de tráfico',
    };
    if (node === undefined) {
      const task = system.submitPending(options);
      if (task === null) {
        reason = 'pool lleno';
        continue;
      }
      tasks.push(task);
    } else {
      const result = node.enqueueTask(options);
      if (result.task === null) {
        reason = result.reason;
        continue;
      }
      tasks.push(result.task);
    }
  }

  const skipped = count - tasks.length;
  const effectiveParams = { ...params, count };
  if (tasks.length === 0) {
    return {
      applied: false,
      nodeId: node?.id,
      message: `no se pudo encolar ninguna tarea${reason === undefined ? '' : `: ${reason}`}`,
      params: effectiveParams,
    };
  }
  const target = node === undefined ? 'el pool' : `la cola de ${node.id}`;
  const message =
    skipped === 0
      ? `${tasks.length} tarea(s) encolada(s) en ${target}`
      : `${tasks.length} tarea(s) encolada(s) en ${target}, ${skipped} descartada(s)`;
  return {
    applied: true,
    nodeId: node?.id,
    message,
    taskIds: tasks.map((task) => task.id),
    tasks,
    params: effectiveParams,
  };
};

const applyThermalSpike = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const params = mergeParams('thermal_spike', request);
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.active)
      : findRequestedNode(system, request.nodeId);
  if (node === undefined) {
    return failure(
      'thermal_spike',
      request?.nodeId === undefined ? 'no hay workers activos' : `nodo ${request.nodeId} no encontrado`,
      request?.nodeId,
      request,
    );
  }
  if (node.isGeneral) {
    return failure('thermal_spike', 'el nodo general no admite perturbaciones', node.id, request);
  }
  const magnitude = numParam(params, 'magnitude', 6);
  const next = clamp(node.currentTemp + magnitude, -60, 150);
  if (next === node.currentTemp) {
    return failure('thermal_spike', 'la temperatura ya está en el límite', node.id, request);
  }
  node.currentTemp = next;
  node.updatedAt = now;
  node.pushEvent('event', `Pico térmico de ${magnitude}C en ${node.id}`, undefined, {
    eventId: 'thermal_spike',
    magnitude,
  });
  return {
    applied: true,
    nodeId: node.id,
    message: `temperatura de ${node.id} ajustada a ${next}C`,
    params: { ...params, magnitude },
  };
};

const applyNodeFailure = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.active)
      : findRequestedNode(system, request.nodeId);
  if (node === undefined) {
    return failure(
      'node_failure',
      request?.nodeId === undefined ? 'no hay workers activos' : `nodo ${request.nodeId} no encontrado`,
      request?.nodeId,
      request,
    );
  }
  if (node.isGeneral) {
    return failure('node_failure', 'el nodo general no admite perturbaciones', node.id, request);
  }
  if (node.status === 'error') {
    return failure('node_failure', `${node.id} ya está en error`, node.id, request);
  }
  node.forceFailure(now);
  return {
    applied: true,
    nodeId: node.id,
    message: `${node.id} forzado a error`,
    params: mergeParams('node_failure', request),
  };
};

const applyNodeRecovery = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.status === 'error')
      : findRequestedNode(system, request.nodeId);
  if (node === undefined) {
    return failure(
      'node_recovery',
      request?.nodeId === undefined ? 'no hay workers en error' : `nodo ${request.nodeId} no encontrado`,
      request?.nodeId,
      request,
    );
  }
  if (node.isGeneral) {
    return failure('node_recovery', 'el nodo general no admite perturbaciones', node.id, request);
  }
  if (node.status === 'active') {
    return failure('node_recovery', `${node.id} ya está activo`, node.id, request);
  }
  node.status = 'active';
  node.recover(now);
  node.updatedAt = now;
  node.pushEvent('event', `Recuperación de ${node.id}`, undefined, { eventId: 'node_recovery' });
  return {
    applied: true,
    nodeId: node.id,
    message: `${node.id} recuperado`,
    params: mergeParams('node_recovery', request),
  };
};

const applyFanFailure = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.active && candidate.fanActive)
      : findRequestedNode(system, request.nodeId);
  if (node === undefined) {
    return failure(
      'fan_failure',
      request?.nodeId === undefined ? 'no hay workers con el ventilador encendido' : `nodo ${request.nodeId} no encontrado`,
      request?.nodeId,
      request,
    );
  }
  if (node.isGeneral) {
    return failure('fan_failure', 'el nodo general no admite perturbaciones', node.id, request);
  }
  if (!node.fanActive) {
    return failure('fan_failure', `${node.id} ya tiene el ventilador apagado`, node.id, request);
  }
  node.fanActive = false;
  node.fanUntilMs = 0;
  node.updatedAt = now;
  node.pushEvent('event', `Fallo de ventilador en ${node.id}`, undefined, { eventId: 'fan_failure' });
  return {
    applied: true,
    nodeId: node.id,
    message: `ventilador de ${node.id} apagado`,
    params: mergeParams('fan_failure', request),
  };
};

const applyWorkloadSurge = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, now, rng } = context;
  const params = mergeParams('workload_surge', request);
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.active && candidate.workload < 1)
      : findRequestedNode(system, request.nodeId);
  if (node === undefined) {
    return failure(
      'workload_surge',
      request?.nodeId === undefined ? 'no hay workers con carga disponible' : `nodo ${request.nodeId} no encontrado`,
      request?.nodeId,
      request,
    );
  }
  if (node.isGeneral) {
    return failure('workload_surge', 'el nodo general no admite perturbaciones', node.id, request);
  }
  const magnitude = numParam(params, 'magnitude', 0.35);
  const next = clamp(node.workload + magnitude, 0, 1);
  if (next === node.workload) {
    return failure('workload_surge', `${node.id} ya está al máximo de carga`, node.id, request);
  }
  node.workload = next;
  node.updatedAt = now;
  node.pushEvent('event', `Pico de carga en ${node.id}`, undefined, {
    eventId: 'workload_surge',
    magnitude,
  });
  return {
    applied: true,
    nodeId: node.id,
    message: `carga de ${node.id} ajustada a ${next}`,
    params: { ...params, magnitude },
  };
};

const applySyntheticAlert = (context: EventContext, request: EventRequest | undefined): EventOutcome => {
  const { system, rng } = context;
  const params = mergeParams('synthetic_alert', request);
  const node =
    request?.nodeId === undefined
      ? pickWorker(system, rng, (candidate) => candidate.active)
      : findRequestedNode(system, request.nodeId);
  if (request?.nodeId !== undefined && node === undefined) {
    return failure(
      'synthetic_alert',
      `nodo ${request.nodeId} no encontrado`,
      request.nodeId,
      request,
    );
  }
  const level = strParam(params, 'level', 'critical') === 'warning' ? 'warning' : 'critical';
  const message = strParam(params, 'message', `Alerta sintética en ${node?.id ?? 'el sistema'}`);
  node?.pushEvent('event', message, undefined, { eventId: 'synthetic_alert', level });
  return {
    applied: true,
    nodeId: node?.id,
    message,
    params: { ...params, message, level },
  };
};

export function applyEvent(id: EventId, context: EventContext): EventOutcome {
  const request = context.request;
  switch (id) {
    case 'task_arrival':
      return applyTaskArrival(context, request);
    case 'thermal_spike':
      return applyThermalSpike(context, request);
    case 'node_failure':
      return applyNodeFailure(context, request);
    case 'node_recovery':
      return applyNodeRecovery(context, request);
    case 'fan_failure':
      return applyFanFailure(context, request);
    case 'workload_surge':
      return applyWorkloadSurge(context, request);
    case 'synthetic_alert':
      return applySyntheticAlert(context, request);
  }
}
