# Eventos de simulación y generador de tráfico — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un catálogo de eventos probabilísticos y un generador autónomo de tareas, con disparo manual y panel flotante, para probar reglas y reacciones del simulador.

**Architecture:** Catálogo y efectos puros en `domain/events.ts`; `EventEngine` en `engine/` avanza dentro de `SimulationEngine.step(dtMs)`, por lo que comparte pausa, reset y tests. La API expone estado, ajustes y disparo manual; cada disparo emite `event:triggered`, se registra en logs y en la tabla `events`. El frontend consume el evento por Socket.IO y lo muestra en un panel no modal.

**Tech Stack:** Node.js 20+, TypeScript ESM, Express, zod, Socket.IO, vitest; React 18 + Vite (JSX, sin TypeScript).

**Spec:** `docs/superpowers/specs/2026-11-05-eventos-simulacion-design.md`

## Global Constraints

- Sin dependencias nuevas.
- Backend ESM con imports relativos terminados en `.js`; strict y `noUnusedLocals`/`noUnusedParameters`.
- Sin comentarios en el código.
- Frontend JSX sin TypeScript; `Scene` sigue en chunk lazy.
- Usar `pnpm.cmd` en backend y `npm.cmd` en frontend (Windows).
- Cada commit debe pasar su verificación y compilar por sí solo.
- El generador arranca apagado (`EVENTS_ENABLED=false`).
- La configuración no se persiste; el reinicio vuelve a los valores por defecto.
- Las perturbaciones automáticas solo apuntan a workers; el nodo general queda fuera.
- El panel es flotante, no modal, abajo a la derecha; en replay es solo lectura.

---

## Review Focus

Estos son los fallos que más probablemente muerdan y que el plan debe cubrir con tests:

1. **Ids o parámetros inválidos por API** — deben devolver `400`/`404`, no romper el proceso.
2. **Pool o cola llena durante `task_arrival`** — debe encolar lo que quepa, marcar `applied` correctamente y consumir cooldown.
3. **Sin workers elegibles o target al nodo general** — no debe lanzar; el disparo manual devuelve `400` y el automático `applied=false`.
4. **Pausa, reset y replay** — el generador no dispara en pausa, el reset limpia contadores y el panel no permite escribir en replay.
5. **BD caída al persistir un evento** — la simulación sigue y el fallo solo se registra.

---

### Task 1: Catálogo de eventos y efectos de dominio

**Files:**
- Create: `backend/src/domain/events.ts`
- Modify: `backend/src/domain/node.ts`
- Test: `backend/test/events.test.ts`

**Interfaces:**
- Produces:
  - `type EventId = 'task_arrival' | 'thermal_spike' | 'node_failure' | 'node_recovery' | 'fan_failure' | 'workload_surge' | 'synthetic_alert'`
  - `type EventCategory = 'traffic' | 'perturbation'`
  - `const EVENT_IDS: readonly EventId[]`
  - `const EVENT_CATALOG: readonly EventDefinition[]`
  - `interface EventDefinition { id: EventId; name: string; category: EventCategory; description: string; defaultProbability: number; defaultCooldownMs: number; defaultParams: Record<string, unknown> }`
  - `interface EventRequest { nodeId?: string; params?: Record<string, unknown> }`
  - `interface EventOutcome { applied: boolean; nodeId?: string; message: string; taskIds?: string[]; tasks?: Task[]; params?: Record<string, unknown> }`
  - `function applyEvent(id: EventId, context: { system: SystemSimulation; now: number; rng: () => number; request?: EventRequest }): EventOutcome`
  - `SimNode.forceFailure(now: number): void`

- [ ] **Step 1: Escribe los tests de catálogo y efectos**

Crea `backend/test/events.test.ts` con este contenido base y un test por efecto:

```ts
import { describe, expect, it } from 'vitest';
import { EVENT_CATALOG, EVENT_IDS, applyEvent } from '../src/domain/events.js';
import { SystemSimulation } from '../src/domain/system.js';

const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 3,
};

const now = 1_700_000_000_000;
const rng = (value = 0) => () => value;
const makeSystem = (overrides: Partial<typeof seed> = {}) =>
  new SystemSimulation({ ...seed, ...overrides });

describe('catálogo de eventos', () => {
  it('define los siete eventos con valores válidos', () => {
    expect(EVENT_CATALOG.map((event) => event.id)).toEqual([...EVENT_IDS]);
    expect(EVENT_IDS).toEqual([
      'task_arrival',
      'thermal_spike',
      'node_failure',
      'node_recovery',
      'fan_failure',
      'workload_surge',
      'synthetic_alert',
    ]);
    for (const event of EVENT_CATALOG) {
      expect(event.defaultProbability).toBeGreaterThanOrEqual(0);
      expect(event.defaultProbability).toBeLessThanOrEqual(1);
      expect(event.defaultCooldownMs).toBeGreaterThanOrEqual(0);
      expect(event.defaultParams).toBeTypeOf('object');
    }
  });
});

describe('applyEvent', () => {
  it('task_arrival encola en el pool y respeta count', () => {
    const system = makeSystem();
    const outcome = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 2 } },
    });
    expect(outcome.applied).toBe(true);
    expect(outcome.taskIds).toHaveLength(2);
    expect(system.pendingPool.size).toBe(2);
  });

  it('task_arrival con nodeId encola en la cola local', () => {
    const system = makeSystem();
    const outcome = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { count: 1 } },
    });
    expect(outcome.applied).toBe(true);
    expect(system.getNode('node-1')?.queueSnapshot().size).toBe(1);
    expect(system.pendingPool.size).toBe(0);
  });

  it('task_arrival parcial con pool lleno y fallo total después', () => {
    const system = makeSystem({ poolCapacity: 1 });
    const first = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 3 } },
    });
    expect(first.applied).toBe(true);
    expect(first.taskIds).toHaveLength(1);
    expect(first.message).toContain('2');
    const second = applyEvent('task_arrival', {
      system,
      now,
      rng: rng(),
      request: { params: { count: 1 } },
    });
    expect(second.applied).toBe(false);
  });

  it('thermal_spike suma magnitud y respeta el clamp', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    const outcome = applyEvent('thermal_spike', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 6 } },
    });
    expect(outcome.applied).toBe(true);
    expect(node.currentTemp).toBe(31);
    node.currentTemp = 150;
    const clamped = applyEvent('thermal_spike', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 6 } },
    });
    expect(clamped.applied).toBe(false);
  });

  it('node_failure deja stats.ok=false sin cancelar la tarea actual', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    node.enqueueTask({ type: 'custom', durationSecs: 10 });
    node.startNextTask();
    const outcome = applyEvent('node_failure', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(outcome.applied).toBe(true);
    expect(node.status).toBe('error');
    expect(node.toDto().stats.ok).toBe(false);
    expect(node.processingTask).not.toBeNull();
  });

  it('node_recovery reactiva y limpia fallos', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    applyEvent('node_failure', { system, now, rng: rng(), request: { nodeId: 'node-1' } });
    const outcome = applyEvent('node_recovery', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(outcome.applied).toBe(true);
    expect(node.status).toBe('active');
    expect(node.toDto().stats.ok).toBe(true);
    expect(node.toDto().stats.consecutiveFailures).toBe(0);
  });

  it('fan_failure apaga el ventilador y workload_surge sube la carga', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    node.fanActive = true;
    const fan = applyEvent('fan_failure', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1' },
    });
    expect(fan.applied).toBe(true);
    expect(node.fanActive).toBe(false);
    node.workload = 0.3;
    const load = applyEvent('workload_surge', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { magnitude: 0.35 } },
    });
    expect(load.applied).toBe(true);
    expect(node.workload).toBeCloseTo(0.65);
  });

  it('synthetic_alert no muta el nodo y devuelve parámetros efectivos', () => {
    const system = makeSystem();
    const node = system.getNode('node-1')!;
    const before = node.currentTemp;
    const outcome = applyEvent('synthetic_alert', {
      system,
      now,
      rng: rng(),
      request: { nodeId: 'node-1', params: { message: 'Prueba', level: 'warning' } },
    });
    expect(outcome.applied).toBe(true);
    expect(outcome.params).toMatchObject({ message: 'Prueba', level: 'warning' });
    expect(node.currentTemp).toBe(before);
  });

  it('sin workers elegibles o con nodo general devuelve applied=false', () => {
    const empty = makeSystem({ initialNodes: 0 });
    expect(
      applyEvent('thermal_spike', { system: empty, now, rng: rng() }).applied,
    ).toBe(false);
    const system = makeSystem();
    expect(
      applyEvent('thermal_spike', {
        system,
        now,
        rng: rng(),
        request: { nodeId: 'node-general' },
      }).applied,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecuta el test y confirma que falla**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: FAIL porque `../src/domain/events.js` no existe y `forceFailure` no está definido.

- [ ] **Step 3: Implementa `forceFailure` en `backend/src/domain/node.ts`**

Añade junto a `markFailure`:

```ts
forceFailure(now: number): void {
  this.failures += 1;
  this.consecutiveFailures = Math.max(this.consecutiveFailures, this.maxConsecutiveFailures);
  this.status = 'error';
  this.updatedAt = now;
  this.pushEvent('change', `Nodo ${this.id} forzado a error`);
}
```

- [ ] **Step 4: Implementa `backend/src/domain/events.ts`**

Define el catálogo con estos valores exactos:

| id | category | probability | cooldownMs | defaultParams |
|---|---|---|---|---|
| `task_arrival` | `traffic` | `0.08` | `3000` | `{ count: 2 }` |
| `thermal_spike` | `perturbation` | `0.02` | `15000` | `{ magnitude: 6 }` |
| `node_failure` | `perturbation` | `0.01` | `60000` | `{}` |
| `node_recovery` | `perturbation` | `0.03` | `30000` | `{}` |
| `fan_failure` | `perturbation` | `0.01` | `30000` | `{}` |
| `workload_surge` | `perturbation` | `0.02` | `30000` | `{ magnitude: 0.35 }` |
| `synthetic_alert` | `perturbation` | `0.01` | `30000` | `{ level: 'critical' }` |

Reglas de `applyEvent`:

- `task_arrival`: elige `count` entre 1 y 3 (o el `params.count` acotado), tipo aleatorio entre los cinco `TASK_TYPE_VALUES`, prioridad/demanda/duración aleatorias dentro de sus rangos. Sin `nodeId` usa `system.submitPending`; con `nodeId` usa `node.enqueueTask`. Devuelve `tasks` y `taskIds` de las que entraron; `applied` si entró al menos una.
- `thermal_spike`: target worker; `magnitude` por defecto 6; `currentTemp = clamp(currentTemp + magnitude, -60, 150)`; `applied` si cambió.
- `node_failure`: target worker; si ya está en `error`, `applied=false`; si no, `forceFailure(now)`.
- `node_recovery`: target worker; si ya está `active`, `applied=false`; si no, `status='active'` y `recover(now)`.
- `fan_failure`: target worker; si `fanActive=false`, `applied=false`; si no, apaga y limpia `fanUntilMs`.
- `workload_surge`: target worker; suma `magnitude` (0.35) y clamp `[0,1]`; `applied` si cambió.
- `synthetic_alert`: target opcional; no muta; `applied=true`; `params` incluye `message` y `level` (`warning` o `critical`).
- Selección automática: usa `pickWorker` con los predicados del spec (activos, fan encendido, error, carga < 1). Si no hay candidato, `applied=false`.
- Si `request.nodeId` es `node-general` en una perturbación, devuelve `applied=false` con mensaje `el nodo general no admite perturbaciones`.
- `params` del outcome es la mezcla de `defaultParams` y `request.params`.
- `pushEvent('event', ...)` en cada nodo afectado para que la pila LIFO lo refleje.

- [ ] **Step 5: Ejecuta el test y confirma que pasa**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck y commit**

Run: `pnpm.cmd run typecheck`

Expected: sin errores.

```bash
git add backend/src/domain/events.ts backend/src/domain/node.ts backend/test/events.test.ts
git commit -m "feat(backend): añade catálogo y efectos de eventos"
```

---

### Task 2: Motor de eventos probabilístico

**Files:**
- Create: `backend/src/engine/eventEngine.ts`
- Modify: `backend/src/engine/events.ts`
- Modify: `backend/src/domain/types.ts`
- Test: `backend/test/events.test.ts`

**Interfaces:**
- Consumes: `EVENT_CATALOG`, `EVENT_IDS`, `EventId`, `EventRequest`, `applyEvent` de Task 1.
- Produces:
  - `interface EventTriggeredPayload { eventId: EventId; name: string; category: EventCategory; source: 'auto' | 'manual'; nodeId?: string; applied: boolean; message: string; taskIds?: string[]; params?: Record<string, unknown>; at: number }`
  - `SimEventMap['event:triggered']: EventTriggeredPayload`
  - `interface EventEngineOptions { enabled: boolean; intervalMs: number; probabilities?: Partial<Record<EventId, number>>; rng?: () => number; now?: () => number; recentLimit?: number }`
  - `class EventEngine` con `state`, `step(dtMs)`, `trigger(id, request?, source?)`, `patchGenerator(patch)`, `patchEvent(id, patch)`, `resetRuntime()`.
  - `state.events` incluye por evento `id`, `name`, `category`, `description`, `enabled`, `probability`, `cooldownMs`, `defaultParams`, `lastTriggeredAt` y `triggerCount`.
  - `LogType` incluye `'event'`.

- [ ] **Step 1: Añade el tipo de bus y el tipo de log**

En `backend/src/engine/events.ts`, añade `EventTriggeredPayload` y la entrada `'event:triggered'` en `SimEventMap`.

En `backend/src/domain/types.ts`, añade `'event'` a `LogType`.

- [ ] **Step 2: Escribe los tests del motor**

Añade a `backend/test/events.test.ts`:

```ts
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { LogStore } from '../src/infra/logger.js';

const zeroProbabilities = {
  task_arrival: 0,
  thermal_spike: 0,
  node_failure: 0,
  node_recovery: 0,
  fan_failure: 0,
  workload_surge: 0,
  synthetic_alert: 0,
};

function makeEngine(overrides: Partial<{
  enabled: boolean;
  intervalMs: number;
  probabilities: typeof zeroProbabilities;
  rng: () => number;
  now: () => number;
  recentLimit: number;
}> = {}) {
  const system = makeSystem();
  const bus = new EventBus<SimEventMap>();
  const logs = new LogStore(100);
  let clock = now;
  const engine = new EventEngine(system, bus, logs, {
    enabled: true,
    intervalMs: 1000,
    probabilities: zeroProbabilities,
    rng: rng(),
    now: () => clock,
    recentLimit: 2,
    ...overrides,
  });
  return {
    system,
    bus,
    logs,
    engine,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('EventEngine automático', () => {
  it('no dispara con el generador apagado', () => {
    const { engine } = makeEngine({ enabled: false, probabilities: { ...zeroProbabilities, task_arrival: 1 } });
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(0);
  });

  it('dispara por probabilidad y respeta cooldown', () => {
    const { engine, advance, system } = makeEngine({
      probabilities: { ...zeroProbabilities, task_arrival: 1 },
    });
    engine.step(1000);
    expect(system.pendingPool.size).toBeGreaterThan(0);
    expect(engine.state.recent).toHaveLength(1);
    advance(1000);
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(1);
    advance(2000);
    engine.step(1000);
    expect(engine.state.recent).toHaveLength(2);
  });

  it('un disparo fallido consume cooldown y contador', () => {
    const { engine, system } = makeEngine({
      probabilities: { ...zeroProbabilities, task_arrival: 1 },
    });
    system.submitPending({ type: 'custom' });
    system.submitPending({ type: 'custom' });
    system.submitPending({ type: 'custom' });
    engine.step(1000);
    const runtime = engine.state.events.find((event) => event.id === 'task_arrival')!;
    expect(runtime.triggerCount).toBe(1);
    expect(engine.state.recent[0].applied).toBe(false);
  });

  it('el disparo manual salta enabled, probabilidad y cooldown', () => {
    const { engine, system } = makeEngine({
      enabled: false,
      probabilities: { ...zeroProbabilities, thermal_spike: 0 },
    });
    const payload = engine.trigger('thermal_spike', {
      nodeId: 'node-1',
      params: { magnitude: 4 },
    });
    expect(payload.applied).toBe(true);
    expect(payload.source).toBe('manual');
    expect(system.getNode('node-1')?.currentTemp).toBe(29);
  });

  it('emite alert además de event:triggered para synthetic_alert', () => {
    const { engine, bus } = makeEngine();
    const alerts: unknown[] = [];
    bus.on('alert', (payload) => alerts.push(payload));
    engine.trigger('synthetic_alert', { nodeId: 'node-1', params: { message: 'Prueba' } });
    expect(alerts).toHaveLength(1);
  });

  it('recorta el feed reciente y resetRuntime limpia contadores', () => {
    const { engine } = makeEngine();
    engine.trigger('thermal_spike', { nodeId: 'node-1' });
    engine.trigger('thermal_spike', { nodeId: 'node-2' });
    engine.trigger('thermal_spike', { nodeId: 'node-1' });
    expect(engine.state.recent).toHaveLength(2);
    engine.resetRuntime();
    expect(engine.state.recent).toHaveLength(0);
    expect(engine.state.events.every((event) => event.triggerCount === 0)).toBe(true);
  });
});

describe('EventEngine configuración', () => {
  it('permite ajustar generador y evento en caliente', () => {
    const { engine } = makeEngine();
    engine.patchGenerator({ enabled: true, intervalMs: 2000 });
    const updated = engine.patchEvent('thermal_spike', { probability: 0.5, cooldownMs: 100 });
    expect(engine.state.generator).toMatchObject({ enabled: true, intervalMs: 2000 });
    expect(updated).toMatchObject({ probability: 0.5, cooldownMs: 100 });
  });
});
```

- [ ] **Step 3: Ejecuta los tests y confirma que fallan**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: FAIL porque `EventEngine` no existe.

- [ ] **Step 4: Implementa `backend/src/engine/eventEngine.ts`**

Requisitos exactos:

- `state` devuelve copias: `{ generator: { enabled, intervalMs }, events, recent }`.
- `step(dtMs)`: si `!enabled`, retorna. Suma `dtMs` al acumulador; si no llega a `intervalMs`, retorna. Resta `intervalMs` una vez y evalúa. Como máximo una evaluación por tick.
- `evaluate`: recorre los eventos habilitados, comprueba `now - lastTriggeredAt >= cooldownMs`, tira `rng() < probability`, y llama a `trigger(id, undefined, 'auto')`.
- `trigger`: aplica `applyEvent`, actualiza `lastTriggeredAt` y `triggerCount` siempre, construye el payload, lo mete al principio de `recent` (límite configurable, 50 por defecto), emite `event:triggered` y registra en `logs` con tipo `'event'`.
- Para `task_arrival`, emite `task:pending` por cada tarea sin `nodeId` y `task:queued` con `{ nodeId, task }` cuando hay cola local.
- Para `synthetic_alert` aplicado, emite también `alert` con `{ level, message, nodeId, at }`.
- Captura cualquier excepción de `applyEvent`, la convierte en `applied=false` con mensaje `error aplicando evento: <mensaje>` y sigue.
- `patchGenerator` y `patchEvent` actualizan solo los campos recibidos y devuelven el estado actualizado; `patchEvent` devuelve `null` si el id no existe.
- `resetRuntime` limpia `lastTriggeredAt`, `triggerCount`, acumulador y `recent`, sin tocar la configuración.

- [ ] **Step 5: Ejecuta los tests y confirma que pasan**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck y commit**

Run: `pnpm.cmd run typecheck`

Expected: sin errores.

```bash
git add backend/src/engine/eventEngine.ts backend/src/engine/events.ts backend/src/domain/types.ts backend/test/events.test.ts
git commit -m "feat(backend): añade motor probabilístico de eventos"
```

---

### Task 3: Integración con el tick, configuración y bootstrap

**Files:**
- Modify: `backend/src/engine/simulationEngine.ts`
- Modify: `backend/src/config.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/api/context.ts`
- Modify: `backend/.env.example`
- Test: `backend/test/events.test.ts`

**Interfaces:**
- Consumes: `EventEngine` de Task 2.
- Produces:
  - `EngineDeps.events?: EventEngine`
  - `AppContext.events: EventEngine`
  - Variables `EVENTS_ENABLED`, `EVENTS_INTERVAL_MS` y `EVENT_*_PROBABILITY`.

- [ ] **Step 1: Escribe el test de integración con el tick**

Añade a `backend/test/events.test.ts`:

```ts
import { RuleStore } from '../src/domain/rules-store.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';

it('SimulationEngine avanza el generador y emite event:triggered', () => {
  const system = makeSystem();
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const events = new EventEngine(system, bus, logs, {
    enabled: true,
    intervalMs: 1000,
    probabilities: { ...zeroProbabilities, task_arrival: 1 },
    rng: rng(),
  });
  const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000, 0);
  const received: unknown[] = [];
  bus.on('event:triggered', (payload) => received.push(payload));
  engine.pause();
  engine.stepOnce();
  expect(received).toHaveLength(1);
  expect(system.pendingPool.size).toBeGreaterThan(0);
});

it('reset limpia los contadores del generador', () => {
  const system = makeSystem();
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const events = new EventEngine(system, bus, logs, {
    enabled: false,
    intervalMs: 5000,
    probabilities: zeroProbabilities,
  });
  const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000, 0);
  events.trigger('thermal_spike', { nodeId: 'node-1' });
  engine.reset();
  expect(events.state.events.every((event) => event.triggerCount === 0)).toBe(true);
});
```

- [ ] **Step 2: Ejecuta el test y confirma que falla**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: FAIL porque `EngineDeps` no acepta `events` y `reset` no limpia contadores.

- [ ] **Step 3: Integra en `SimulationEngine`**

- Añade `events?: EventEngine` a `EngineDeps` con `import type { EventEngine } from './eventEngine.js';`.
- En `step(dtMs)`, después de `tickThermalAll(dtMs)`, llama `this.deps.events?.step(dtMs)`.
- En `reset()`, llama `this.deps.events?.resetRuntime()` antes de `broadcast()`.

- [ ] **Step 4: Añade la configuración**

En `backend/src/config.ts`:

```ts
EVENTS_ENABLED: boolFromEnv(false),
EVENTS_INTERVAL_MS: z.coerce.number().int().min(250).max(3_600_000).default(5000),
EVENT_TASK_ARRIVAL_PROBABILITY: z.coerce.number().min(0).max(1).default(0.08),
EVENT_THERMAL_SPIKE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.02),
EVENT_NODE_FAILURE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.01),
EVENT_NODE_RECOVERY_PROBABILITY: z.coerce.number().min(0).max(1).default(0.03),
EVENT_FAN_FAILURE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.01),
EVENT_WORKLOAD_SURGE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.02),
EVENT_SYNTHETIC_ALERT_PROBABILITY: z.coerce.number().min(0).max(1).default(0.01),
```

En `backend/.env.example`, añade el bloque:

```dotenv
# Generador de eventos de simulación (tráfico + perturbaciones)
# Apagado por defecto; se puede activar por API o desde el panel de eventos
EVENTS_ENABLED=false
EVENTS_INTERVAL_MS=5000
EVENT_TASK_ARRIVAL_PROBABILITY=0.08
EVENT_THERMAL_SPIKE_PROBABILITY=0.02
EVENT_NODE_FAILURE_PROBABILITY=0.01
EVENT_NODE_RECOVERY_PROBABILITY=0.03
EVENT_FAN_FAILURE_PROBABILITY=0.01
EVENT_WORKLOAD_SURGE_PROBABILITY=0.02
EVENT_SYNTHETIC_ALERT_PROBABILITY=0.01
```

- [ ] **Step 5: Cablea el bootstrap**

En `backend/src/index.ts`, antes de crear `SimulationEngine`:

```ts
const events = new EventEngine(system, bus, logs, {
  enabled: config.EVENTS_ENABLED,
  intervalMs: config.EVENTS_INTERVAL_MS,
  probabilities: {
    task_arrival: config.EVENT_TASK_ARRIVAL_PROBABILITY,
    thermal_spike: config.EVENT_THERMAL_SPIKE_PROBABILITY,
    node_failure: config.EVENT_NODE_FAILURE_PROBABILITY,
    node_recovery: config.EVENT_NODE_RECOVERY_PROBABILITY,
    fan_failure: config.EVENT_FAN_FAILURE_PROBABILITY,
    workload_surge: config.EVENT_WORKLOAD_SURGE_PROBABILITY,
    synthetic_alert: config.EVENT_SYNTHETIC_ALERT_PROBABILITY,
  },
});
```

Pasa `events` a `SimulationEngine` y añádelo al `ctx`:

```ts
const engine = new SimulationEngine({ system, rules, logs, bus, events }, config.TICK_MS, config.LOG_TELEMETRY_EVERY);
const ctx: AppContext = { system, rules, logs, engine, bus, events, inference: inference ?? undefined, aiControl: aiControl ?? undefined };
```

En `backend/src/api/context.ts`, añade `events: EventEngine` e importa el tipo.

- [ ] **Step 6: Ejecuta tests, typecheck y build**

Run: `pnpm.cmd run test test/events.test.ts`

Expected: PASS.

Run: `pnpm.cmd run typecheck`

Expected: sin errores.

Run: `pnpm.cmd run build`

Expected: compila.

- [ ] **Step 7: Commit**

```bash
git add backend/src/engine/simulationEngine.ts backend/src/config.ts backend/src/index.ts backend/src/api/context.ts backend/.env.example backend/test/events.test.ts
git commit -m "feat(backend): integra el generador de eventos en el tick"
```

---

### Task 4: API, sockets y persistencia de eventos

**Files:**
- Create: `backend/src/api/events.routes.ts`
- Create: `backend/test/events-api.test.ts`
- Modify: `backend/src/api/validation.ts`
- Modify: `backend/src/infra/httpServer.ts`
- Modify: `backend/src/infra/sockets.ts`
- Modify: `backend/src/infra/timeseriesSink.ts`
- Modify: `backend/test/timeseries-sink.test.ts`

**Interfaces:**
- Consumes: `EventEngine`, `EVENT_IDS`, `EventId`, `EventTriggeredPayload`.
- Produces:
  - `GET /api/events`, `PATCH /api/events`, `PATCH /api/events/:id`, `POST /api/events/:id/trigger`.
  - `eventGeneratorPatchSchema`, `eventPatchSchema`, `eventTriggerSchema`.
  - Socket `event:triggered`.
  - Fila `events` con `kind='sim_event'`, `type='event'`.

- [ ] **Step 1: Escribe el test de persistencia**

Añade a `backend/test/timeseries-sink.test.ts`:

```ts
it('mapea event:triggered a una fila sim_event', async () => {
  const bus = new EventBus<SimEventMap>();
  const { driver } = makeSink(bus, { maxBuffer: 1 });

  bus.emit('event:triggered', {
    eventId: 'thermal_spike',
    name: 'Pico térmico',
    category: 'perturbation',
    source: 'manual',
    nodeId: 'node-1',
    applied: true,
    message: 'Pico de +6 °C',
    params: { magnitude: 6 },
    at: 1_700_000_000_003,
  });
  await flushSettle();

  const events = driver.calls.filter((call) => call.sql.startsWith('INSERT INTO `events`'));
  expect(events).toHaveLength(1);
  const params = events[0].params as unknown[];
  expect(params.slice(0, 6)).toEqual([
    1_700_000_000_003,
    'node-1',
    'sim_event',
    'event',
    'thermal_spike',
    'Pico de +6 °C',
  ]);
  expect(JSON.parse(params[6] as string)).toMatchObject({
    source: 'manual',
    applied: true,
    params: { magnitude: 6 },
  });
});
```

- [ ] **Step 2: Escribe el test HTTP**

Crea `backend/test/events-api.test.ts` con un servidor efímero:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { buildHttpServer } from '../src/infra/httpServer.js';
import { LogStore } from '../src/infra/logger.js';

const servers: Server[] = [];
const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 10,
};

async function start() {
  const system = new SystemSimulation(seed);
  const rules = new RuleStore([]);
  const logs = new LogStore(100);
  const bus = new EventBus<SimEventMap>();
  const events = new EventEngine(system, bus, logs, {
    enabled: false,
    intervalMs: 5000,
    probabilities: {},
  });
  const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000, 0);
  const app = buildHttpServer({ system, rules, logs, engine, bus, events }, 'http://localhost:5173', false);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, system, events };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('API de eventos', () => {
  it('GET devuelve catálogo y generador', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/api/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generator.enabled).toBe(false);
    expect(body.events).toHaveLength(7);
  });

  it('rechaza configuración inválida', async () => {
    const { base } = await start();
    const patch = await fetch(`${base}/api/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalMs: 10 }),
    });
    expect(patch.status).toBe(400);
    const probability = await fetch(`${base}/api/events/task_arrival`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probability: 1.5 }),
    });
    expect(probability.status).toBe(400);
  });

  it('devuelve 404 para evento o nodo inexistente y 400 para el general', async () => {
    const { base } = await start();
    const unknown = await fetch(`${base}/api/events/no-existe/trigger`, { method: 'POST' });
    expect(unknown.status).toBe(404);
    const node = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-99' }),
    });
    expect(node.status).toBe(404);
    const general = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-general' }),
    });
    expect(general.status).toBe(400);
  });

  it('dispara manualmente aunque el generador esté apagado', async () => {
    const { base, system } = await start();
    const res = await fetch(`${base}/api/events/thermal_spike/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'node-1', params: { magnitude: 4 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event).toMatchObject({ eventId: 'thermal_spike', source: 'manual', applied: true });
    expect(system.getNode('node-1')?.currentTemp).toBe(29);
  });

  it('task_arrival manual encola en el pool', async () => {
    const { base, system } = await start();
    const res = await fetch(`${base}/api/events/task_arrival/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: { count: 2 } }),
    });
    expect(res.status).toBe(200);
    expect(system.pendingPool.size).toBe(2);
  });
});
```

- [ ] **Step 3: Ejecuta los tests y confirma que fallan**

Run: `pnpm.cmd run test test/events-api.test.ts test/timeseries-sink.test.ts`

Expected: FAIL porque no existen las rutas ni la suscripción.

- [ ] **Step 4: Implementa la validación**

En `backend/src/api/validation.ts`:

```ts
export const eventGeneratorPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMs: z.number().int().min(250).max(3_600_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No se enviaron campos para actualizar' });

export const eventPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    probability: z.number().min(0).max(1).optional(),
    cooldownMs: z.number().int().min(0).max(3_600_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No se enviaron campos para actualizar' });

export const eventTriggerSchema = z.object({
  nodeId: z.string().min(1).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 5: Implementa `backend/src/api/events.routes.ts`**

Requisitos:

- `GET /` → `res.json(ctx.events.state)`.
- `PATCH /` → parsea `eventGeneratorPatchSchema`; `400` con `issues`; devuelve `ctx.events.patchGenerator(parsed.value)`.
- `PATCH /:id` → valida el id con un type guard (`const isEventId = (value: string): value is EventId => (EVENT_IDS as readonly string[]).includes(value)`); si no, `404`; parsea `eventPatchSchema`; devuelve `{ event }` o `404` si `patchEvent` devuelve `null`.
- `POST /:id/trigger` → valida el id antes de leer el body (así un id inexistente sin body devuelve `404`); parsea `eventTriggerSchema`; si `nodeId` existe, busca el nodo: `404` si no existe, `400` si es `node-general` y el evento no es `task_arrival` ni `synthetic_alert`; llama `ctx.events.trigger(id, parsed.value)`; devuelve `200 { event }`.
- Añade logs de API para cambios de configuración con `ctx.logs.add('info', 'api', ...)`.

- [ ] **Step 6: Monta rutas y sockets**

En `backend/src/infra/httpServer.ts`, importa y monta `app.use('/api/events', eventsRouter(ctx));` antes del 404.

En `backend/src/infra/sockets.ts`, añade `'event:triggered'` a `EVENT_NAMES`.

- [ ] **Step 7: Persiste en `TimeSeriesSink`**

- Importa `EventTriggeredPayload`.
- Amplía el tipo de `pushEvent` para aceptar `'event'`.
- Suscríbete:

```ts
bus.on('event:triggered', (payload: EventTriggeredPayload) => {
  this.pushEvent(
    payload.at,
    payload.nodeId,
    'sim_event',
    'event',
    payload.eventId,
    payload.message,
    {
      source: payload.source,
      applied: payload.applied,
      taskIds: payload.taskIds ?? null,
      params: payload.params ?? null,
    },
  );
});
```

- [ ] **Step 8: Ejecuta tests, typecheck y build**

Run: `pnpm.cmd run test test/events.test.ts test/events-api.test.ts test/timeseries-sink.test.ts`

Expected: PASS.

Run: `pnpm.cmd run typecheck`

Expected: sin errores.

Run: `pnpm.cmd run build`

Expected: compila.

- [ ] **Step 9: Commit**

```bash
git add backend/src/api/events.routes.ts backend/src/api/validation.ts backend/src/infra/httpServer.ts backend/src/infra/sockets.ts backend/src/infra/timeseriesSink.ts backend/test/events-api.test.ts backend/test/timeseries-sink.test.ts
git commit -m "feat(backend): expone la API de eventos y los persiste"
```

---

### Task 5: Hook y panel flotante de eventos

**Files:**
- Create: `frontend/src/hooks/useEvents.js`
- Create: `frontend/src/components/EventPanel.jsx`
- Modify: `frontend/src/components/Icon.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: `GET/PATCH /api/events`, `POST /api/events/:id/trigger`, socket `event:triggered`.
- Produces:
  - `useEvents()` → `{ state, error, busy, refresh, patchGenerator, patchEvent, trigger }`.
  - `<EventPanel state error busy readOnly onClose onGenerator onEvent onTrigger />`.
  - Icono `joker`.

- [ ] **Step 1: Implementa `frontend/src/hooks/useEvents.js`**

Requisitos:

- Socket module-level `io()` como en `useAiControl`.
- Estado inicial `{ generator: { enabled: false, intervalMs: 5000 }, events: [], recent: [] }`.
- `GET /api/events` al montar y al reconectar.
- Suscripción a `event:triggered`: prepende a `recent` y recorta a 50.
- `patchGenerator(patch)`: `PATCH /api/events`, reemplaza el estado con la respuesta.
- `patchEvent(id, patch)`: `PATCH /api/events/:id`, actualiza solo ese evento en `state.events`.
- `trigger(id, body = {})`: `POST /api/events/:id/trigger`, prepende `data.event` a `recent`.
- `error` y `busy` como en `useAiControl`; limpia error al empezar.

- [ ] **Step 2: Añade el icono `joker`**

En `frontend/src/components/Icon.jsx`, añade una sonrisa de bufón original (sin copiar un personaje):

```jsx
joker: (
  <>
    <path d="M4 8c2.5-1.5 5-2 8-2s5.5.5 8 2" />
    <path d="M5 12c1.5 4.5 4 7 7 7s5.5-2.5 7-7" />
    <path d="M7 12l2 3 1.5-2 1.5 3 1.5-3 1.5 2 2-3" />
    <path d="M8 8.5 7 10M16 8.5 17 10" />
  </>
),
```

- [ ] **Step 3: Implementa `EventPanel.jsx`**

Requisitos:

- `role="dialog"`, `aria-modal="false"`, `aria-labelledby="event-panel-title"`.
- Cierra con Escape y con el botón de cierre; enfoca el cierre al montar.
- Cabecera: título `Eventos`, badge `auto`/`off`, botón `Activar/Detener` y campo de intervalo en segundos.
- `fieldset disabled={readOnly || busy}` para los controles.
- Catálogo: por evento, checkbox `enabled`, nombre, badge de categoría, descripción, cooldown en segundos, input de probabilidad en porcentaje (`0–100`, `onChange` envía `probability: value / 100`) y botón `Disparar`.
- Feed: últimos eventos con hora `toLocaleTimeString('es')`, badge `auto`/`manual`, nombre, nodo y mensaje. Vacío: `Sin eventos todavía`.
- Banner de solo lectura con el componente/clase existente cuando `readOnly`.
- Errores en rojo con `var(--danger)`.

- [ ] **Step 4: Cablea en `App.jsx`**

- Importa `useEvents` y `EventPanel`.
- `const events = useEvents()` y `const [eventsOpen, setEventsOpen] = useState(false)`.
- Dentro de `.scene-col`, después de `ReplayBar` y antes de `ToastStack`:

```jsx
<div className="event-launcher">
  <button
    type="button"
    className="event-fab"
    onClick={() => setEventsOpen((open) => !open)}
    aria-label={eventsOpen ? 'Cerrar panel de eventos' : 'Abrir panel de eventos'}
    aria-expanded={eventsOpen}
    aria-controls="event-panel"
    title="Eventos de simulación"
  >
    <Icon name="joker" size={22} />
  </button>
  {eventsOpen && (
    <EventPanel
      id="event-panel"
      state={events.state}
      error={events.error}
      busy={events.busy}
      readOnly={isReplay}
      onClose={() => setEventsOpen(false)}
      onGenerator={events.patchGenerator}
      onEvent={events.patchEvent}
      onTrigger={events.trigger}
    />
  )}
</div>
```

- [ ] **Step 5: Añade estilos en `App.css`**

Requisitos:

- `.event-launcher`: `position: absolute; z-index: 35; right: 16px; bottom: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;`.
- `.event-fab`: 48×48, circular, borde `var(--border-strong)`, fondo `var(--glass-strong)`, color `var(--text-strong)`, sombra, hover con `var(--accent-soft)`; `backdrop-filter: blur(12px)`.
- `.event-panel`: ancho `min(380px, calc(100vw - 32px))`, `max-height: 70dvh`, `overflow-y: auto`, fondo `var(--bg-panel)`, borde, radio 14px, sombra, padding 14px.
- Filas del catálogo con grid compacto; probabilidad y cooldown en `mono`; botón de disparo `btn btn--sm`.
- Feed con `list` existente y texto de 12px.
- En `@media (max-width: 900px)`: `.event-launcher { right: 8px; bottom: 84px; }`, `.event-panel { width: calc(100vw - 16px); max-height: 65dvh; }`.
- Mantener contraste en ambos temas usando tokens; no hardcodear colores nuevos salvo los ya existentes.

- [ ] **Step 6: Verifica lint y build**

Run: `npm.cmd run lint`

Expected: sin errores.

Run: `npm.cmd run build`

Expected: compila y `Scene` sigue en su chunk separado (aviso de tamaño esperado).

- [ ] **Step 7: Verifica en navegador**

Crea un script Playwright temporal y ejecútalo con `python C:\Users\gamer\.agents\skills\webapp-testing\scripts\with_server.py --server "cd backend && pnpm.cmd dev" --port 3000 --server "cd frontend && npm.cmd run dev" --port 5173 --timeout 90 -- python <script>`.

Comprueba:

- El botón `[aria-label="Abrir panel de eventos"]` abre el panel y muestra 7 eventos.
- Activar el generador cambia el badge a `auto`; el intervalo se puede editar.
- `Disparar` en `thermal_spike` con `node-1` añade una entrada al feed y sube la temperatura del nodo.
- `Disparar` en `task_arrival` aumenta el pool visible en el centro de control.
- En replay (`Muestra anterior`) el panel sigue abriéndose pero los controles están deshabilitados.
- Móvil 390×844: el panel no tapa el `ReplayBar` y el botón sigue accesible.
- Consola del navegador: 0 errores.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useEvents.js frontend/src/components/EventPanel.jsx frontend/src/components/Icon.jsx frontend/src/App.jsx frontend/src/App.css
git commit -m "feat(frontend): añade el panel flotante de eventos"
```

---

### Task 6: Documentación y verificación final

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `AGENTS.md`
- Include: `docs/superpowers/specs/2026-11-05-eventos-simulacion-design.md`
- Include: `docs/superpowers/plans/2026-11-05-eventos-simulacion.md`

**Interfaces:**
- No produce código nuevo.

- [ ] **Step 1: Actualiza `README.md`**

En la sección Frontend, añade un párrafo sobre el botón de sonrisa, el panel flotante, el generador apagado por defecto, el disparo manual y el modo solo lectura en replay.

- [ ] **Step 2: Actualiza `backend/README.md`**

- Añade las variables nuevas a la tabla de entorno.
- Añade una sección `### Eventos — /api/events` con la tabla de endpoints y un ejemplo `curl` de disparo manual.
- Añade `event:triggered` a la tabla de WebSocket.
- Menciona `kind='sim_event'` en la persistencia.

- [ ] **Step 3: Actualiza `AGENTS.md`**

- En la arquitectura backend, describe `domain/events.ts`, `engine/eventEngine.ts` y la integración en el tick.
- En la arquitectura frontend, añade `useEvents`, `EventPanel` y el icono `joker`.
- En Config, añade las variables `EVENTS_*` y `EVENT_*_PROBABILITY`.

- [ ] **Step 4: Verificación completa**

Backend:

Run: `pnpm.cmd run typecheck`
Run: `pnpm.cmd run test`
Run: `pnpm.cmd run build`

Expected: todo PASS.

Frontend:

Run: `npm.cmd run lint`
Run: `npm.cmd run build`

Expected: todo PASS; `Scene` en chunk separado.

- [ ] **Step 5: Commit**

```bash
git add README.md backend/README.md AGENTS.md docs/superpowers/specs/2026-11-05-eventos-simulacion-design.md docs/superpowers/plans/2026-11-05-eventos-simulacion.md
git commit -m "docs: documenta el catálogo de eventos"
```

- [ ] **Step 6: Revisa el estado final**

Run: `git status --short`

Expected: árbol limpio.

---

## Self-Review

- **Cobertura del spec:** catálogo, motor, probabilidades, cooldown, manual, API, env, bus, sockets, BD, panel, replay, móvil, tests y docs tienen tarea.
- **Consistencia de tipos:** `EventId`, `EventRequest`, `EventOutcome`, `EventTriggeredPayload`, `EventEngine` y `EngineDeps.events` se usan con los mismos nombres en todas las tareas.
- **Focos de revisión:** los cinco fallos del apartado Review Focus tienen test en Task 1 (pool/target), Task 3 (pausa/reset), Task 4 (API/BD) y Task 5 (replay).
- **Proporción:** el plan fija interfaces, valores y tests; los cuerpos de implementación quedan al ejecutor.
