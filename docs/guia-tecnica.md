# Guía Técnica — WAItt Simulador de Temperatura

WAItt es el acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**.

Guía para desarrolladores que van a **mantener o extender** el proyecto. Presupone lectura previa de la [Guía de Usuario](guia-usuario.md) y de `AGENTS.md`.

## Visión general de la arquitectura

Dos aplicaciones independientes dentro del mismo repositorio, comunicadas por HTTP (REST) y WebSocket (Socket.IO).

```
┌─────────────────────────┐        ┌──────────────────────────────────────────────┐
│  Navegador (React 19)   │        │  Backend Node.js/TS (backend/)               │
│                          │        │                                              │
│  App.jsx  ── hooks ──┐  │        │  ┌─────────────┐   ┌────────────────────┐    │
│                       │  │  fetch │  │ Express API │──▶│ AppContext         │    │
│  useSimulation.js     │──┼───────▶│  │ (api/)      │   │ system · rules ·   │    │
│  useRules.js          │  │        │  └─────────────┘   │ logs · engine · bus│    │
│                       │  │        │  ┌─────────────┐   └─────────┬──────────┘    │
│  socket.io-client ────┼──┼───────▶│  │ Socket.IO   │◀──(EventBus)─┴──▶ Motor      │
└───────────────────────┘  │  ws    │  │ (infra/)    │   ┌──────────┐ ┌──────────┐ │
                           │        │  └─────────────┘   │ System   │ │ RuleStore│ │
                           ▼        │  /api + /socket.io │ Sim ·    │ │ · logs   │ │
                      Vite dev      │  (proxy)           │ tasks ·  │ │ rules    │ │
                      server        │                    │ stack    │ └──────────┘ │
                       :5173        └────────────────────┴──────────┴──────────────┘
```

- El **dominio** no depende del transporte: tanto Express como Socket.IO se suscriben al mismo `EventBus<SimEventMap>`.
- El motor emite eventos (`state:update`, `node:updated`, …) y el bus los reenvía, por un lado, a los clientes WebSocket y, por otro, a cualquier suscriptor interno.

## Estructura de carpetas del backend

```
backend/
├── src/
│   ├── domain/   # Lógica pura sin I/O
│   │   ├── types.ts / ids.ts      # DTOs, tipos de dominio y createId
│   │   ├── node.ts                # SimNode (nodo + cola FIFO + pila LIFO)
│   │   ├── tasks.ts               # TaskQueue (cola FIFO)
│   │   ├── stack.ts               # EventStack (pila LIFO)
│   │   ├── thermal.ts             # Modelo térmico (thermalStep)
│   │   ├── system.ts              # SystemSimulation (nodos, snapshot, reset)
│   │   ├── rules.ts               # Evaluación de reglas (evaluateRule)
│   │   ├── rules-store.ts         # RuleStore (CRUD + enabledList)
│   │   └── actions.ts             # runAction (efecto de cada acción)
│   ├── engine/
│   │   ├── eventBus.ts            # EventBus genérico tipado
│   │   ├── events.ts              # SimEventMap (eventos tipados)
│   │   └── simulationEngine.ts    # Tick, colas, reglas, cooldowns
│   ├── api/
│   │   ├── context.ts             # AppContext (contexto compartido)
│   │   ├── validation.ts          # Schemas zod + parseBody/parseQuery*
│   │   └── *.routes.ts            # nodes / system / rules / logs / simulate
│   ├── infra/
│   │   ├── config.ts              # loadConfig (env → Config zod)
│   │   ├── httpServer.ts          # Express: cors, routers, health, 404/500
│   │   ├── socket.ts              # attachSockets (puente bus ↔ io)
│   │   ├── logger.ts              # LogStore (buffer en memoria)
│   │   ├── persistence.ts         # PersistenceRepository + MemoryPersistence
│   │   └── rulesLoader.ts         # Carga data/default-rules.json
│   └── index.ts                   # Bootstrap (config, ctx, io, listen)
├── data/default-rules.json        # Reglas iniciales (hot-editable por API)
└── test/                          # Tests vitest (thermal, tasks, rules)
```

Responsabilidades por capa:

| Capa | Responsabilidad | Depende de |
|---|---|---|
| `domain/` | Reglas de negocio puras: modelo térmico, colas, nodos, reglas, acciones | Solo TS |
| `engine/` | Motor de simulación + bus de eventos tipado | `domain/` y `infra/logger` |
| `api/` | Routers Express, validación zod, contexto compartido | `domain/`, `engine/`, `infra/` |
| `infra/` | Config, persistencia, logs, Socket.IO, HTTP | `domain/`, `engine/` |

## Modelo de dominio

### Nodo (`SimNode`, `domain/node.ts`)

Un nodo representa un servidor. El sistema crea **`node-general`** (tipo `general`) más **`node-1..N`** (tipo `worker`, según `INITIAL_NODES`). Campos de su DTO (`NodeDto` en `types.ts`):

| Campo | Tipo | Descripción |
|---|---|---|
| `id`, `name`, `type` | string, `'general'\|'worker'` | Identidad |
| `status` | `'active'\|'inactive'\|'error'` | Equivale a `STATUS_CODE` 0/1/2 |
| `currentTemp` | number | Temperatura actual (°C, 2 decimales) |
| `targetTemp`, `ambientTemp` | number | Objetivo y ambiente (°C) |
| `workload` | number | Carga de trabajo 0–1 (3 decimales) |
| `fanActive`, `fanUntilMs` | boolean, number | Ventilador y hasta cuándo |
| `stats` | `{failures, consecutiveFailures, maxConsecutiveFailures, ok}` | Lecturas fallidas simuladas |
| `queue` | `QueueDto` | Estado de la cola FIFO |
| `stack` | `StackDto` | Estado de la pila LIFO |
| `updatedAt` | number | Último tick |

El "estado en error" es un **contador simulado** de fallos consecutivos: cuando `consecutiveFailures >= maxConsecutiveFailures` el nodo pasa a `error` (métodos `markFailure`/`recover`). No hay hardware.

### Tarea y cola FIFO (`tasks.ts`)

`TaskQueue` procesa por **FIFO** (primero en entrar, primero en salir) con capacidad limitada (`NODE_QUEUE_CAPACITY`). Tipos de tarea (`TaskType`): `cooldown`, `maintenance`, `reboot`, `calibration`, `custom`. Estados: `pending → processing → completed`. Campos: `id`, `type`, `status`, `enqueuedAt`, `startedAt?`, `completedAt?`, `estimatedDurationMs` (defecto `5000`), `description?`, `payload?`.

### Evento y pila LIFO (`stack.ts`)

`EventStack` guarda los últimos eventos del nodo en orden **LIFO** (`unshift`, recorta por `STACK_CAPACITY`). Cada entrada: `{ts, kind, label, detail?, meta?}` con `kind ∈ {event, task, rule, alert, change}`.

### Regla (`rules-store.ts`, `rules.ts`)

Forma de `Rule`:

```ts
interface Rule {
  id: string; name: string;
  enabled: boolean; cooldownMs: number;
  subject: 'any' | 'all' | 'system' | 'node';
  nodeId?: string;
  metric: 'temperature' | 'temperatureDelta' | 'workload' | 'status' | 'queueLength' | 'stackLength';
  op: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: number;
  action: ActionType;
  actionParams?: Record<string, unknown>;
  lastTriggeredAt?: number; triggerCount: number;
}
```

- `matchTargetNodes`: `system` → solo `node-general`; `node` → un nodo concreto (requiere `nodeId`); `any`/`all` → todos los workers.
- `all` exige que TODOS los candidatos cumplan; `any` basta con uno.
- `metricValue`: `status` se compara numérico (`active=0`, `inactive=1`, `error=2`); `temperatureDelta` = `currentTemp - targetTemp`.

### Acciones (`actions.ts`)

| Acción | Parámetros (`actionParams`) | Efecto |
|---|---|---|
| `fan_on` | `minutes` (def. 2) | Activa el ventilador con vencimiento |
| `fan_off` | — | Apaga el ventilador |
| `shutdown` | — | `status = 'inactive'` |
| `startup` | — | `status = 'active'` |
| `enqueue_task` | `taskType` (def. `cooldown`), `durationMs`, `description` | Encola tarea (emite `task:queued`) |
| `send_alert` | `message` | Log crítico + evento WebSocket `alert` |
| `reduce_load` | `by` (def. 0.3) | Baja `workload` (mínimo 0) |
| `set_target_temperature` | `target` | Ajusta `targetTemp` |

## Motor de simulación (`engine/simulationEngine.ts`)

- `start()` usa `setInterval(tick, TICK_MS)`. El tick calcula `dt = min(Date.now() - lastTickAt, MAX_DT_MS)` con `MAX_DT_MS = 5000` — **tiempo real**, no un delta fijo (evita "saltos" si el proceso se bloquea).
- Orden del tick (`step(dtMs)`):
  1. `system.tickThermalAll(dtMs)` — térmica de cada nodo + expiración de ventiladores.
  2. `processQueues()` — si hay tarea en curso la completa cuando `now - startedAt >= estimatedDurationMs`; si no, arranca la siguiente (`startNextTask`).
  3. `evaluateRules()` — recorre `rules.enabledList()` (las reglas se leen **cada tick** → edits en caliente vía API), respeta `cooldownMs`, ejecuta `runAction` por nodo y emite `rule:triggered` (+ `alert` si la acción es `send_alert`).
  4. Emite `node:updated` por nodo y `state:update` (snapshot).
- `pause()`/`resume()` detienen/reanudan el intervalo. `stepOnce()` permite avanzar un tick manualmente **solo en pausa** (si está corriendo lanza un error que la API traduce a HTTP 409).
- `reset()` restaura nodos, colas, pilas y contadores de reglas. El motor arranca con `engine.start()` al levantar el servidor.

Modelo térmico (`thermal.ts`):

```
dT/dt = (target − T) / τ + loadHeatGain·workload − dissipationRate·(T − ambient)·(fan ? 3 : 1)
```

Con constantes por defecto: `timeConstantMs = 20000`, `loadHeatGain = 0.35`, `dissipationRate = 0.002`, `fanDissipationMultiplier = 3`. Un nodo inactivo no cambia de temperatura.

## API REST

Prefijo `/api`. Errores de validación → `400 {error, issues}`; recurso inexistente → `404`; cola llena → `409`.

### `/health`

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/health` | `{status:'ok', running, tickMs, uptimeMs}` |

### `/api/nodes`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/` | — | `{nodes: NodeDto[]}` (general + workers) |
| GET | `/:id` | — | `{node}` o 404 |
| POST | `/` | `{name, initialTemp?, targetTemp?, ambientTemp?, workload?}` | 201 `{node}` |
| PATCH | `/:id` | `{name?, status?, targetTemp?, ambientTemp?, workload?, fanActive?, fanMinutes?}` | `{node}` |
| DELETE | `/:id` | — | 204 (400 si es el general) |
| GET | `/:id/queue` | — | `{queue: QueueDto}` |
| POST | `/:id/queue` | `{type?='custom', estimatedDurationMs?=5000, description?, payload?}` | 201 `{task}` o 409 |
| DELETE | `/:id/queue` | — | `{removed: n}` |
| GET | `/:id/stack` | — | `{stack: StackDto}` |

La cola en `QueueDto`: `{list, size, capacity, remaining, processing}`.

### `/api/system`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/` | — | `{system: SystemSnapshotDto}` |
| PATCH | `/` | `{targetTemp?, ambientTemp?, running?}` | `{system}` |

`SystemSnapshotDto`: `{ts, running, targetTemp, ambientTemp, general, workers[], summary{totalWorkers, activeWorkers, inactiveWorkers, errorWorkers, averageTemp}}`.

### `/api/rules`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/` | — | `{rules: Rule[]}` |
| POST | `/` | `RuleInput` (ver esquema abajo) | 201 `{rule}` |
| PATCH | `/:id` | `Partial<RuleInput>` | `{rule}` o 404 |
| DELETE | `/:id` | — | 204 o 404 |

Esquema `ruleSchema` (validación zod en `api/validation.ts`):

| Campo | Tipo | Default |
|---|---|---|
| `name` | string (1–80) | requerido |
| `enabled` | boolean | `true` |
| `cooldownMs` | int 0–3_600_000 | `30000` |
| `subject` | enum | `'any'` |
| `nodeId` | string | obligatorio si `subject=node` |
| `metric` | enum (6) | requerido |
| `op` | enum (6) | requerido |
| `value` | number | requerido |
| `action` | enum (8) | requerido |
| `actionParams` | record | `{}` |

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/rules -H "Content-Type: application/json" \
  -d '{"name":"Ventilador","metric":"temperature","op":">","value":55,"action":"fan_on","actionParams":{"minutes":2}}'
```

### `/api/logs`

| Método | Ruta | Query | Respuesta |
|---|---|---|---|
| GET | `/` | `level=info,warning,critical&type=rule\|node\|task\|alert&nodeId=&since=<ms>&limit=` | `{logs, size, returned}` |
| DELETE | `/` | — | 204 |

### `/api/sim`

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/status` | `{running, tickMs, uptimeMs, nodesCount, rulesCount, logsCount}` |
| POST | `/pause` | `{running:false}` |
| POST | `/resume` | `{running:true}` |
| POST | `/tick` | `{ok:true, tickMs}` o 409 si está corriendo |
| POST | `/reset` | `{ok:true}` |

## Eventos Socket.IO

El servidor sobrescribe en `infra/sockets.ts`: cada evento del bus se reenvía como paquete `{type, ts, payload}` con nombre igual al evento. El cliente se conecta con `io()` (proxy de Vite) y puede pedir suscripción a un nodo con `node:subscribe` / `node:unsubscribe`.

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `state:update` | `SystemSnapshotDto` | Cada tick y tras pausa/resume/reset/PATCH |
| `node:updated` | `{nodeId, node}` | Cada tick y tras cambios por API |
| `rule:triggered` | `{rule, nodeId, at}` | Cuando una regla se dispara sobre un nodo |
| `task:queued` | `{nodeId, task}` | Al encolar por API o por regla |
| `task:completed` | `{nodeId, task}` | Cuando una tarea termina en el motor |
| `alert` | `{level:'critical', message, nodeId?, at}` | Acción `send_alert` |

Los eventos emitidos salen como `io.emit(...)` (broadcast a todos los conectados); las suscripciones por nodo usan salas `node:<id>` (los eventos actuales ignoran la sala y se emiten globalmente).

## Convenciones del proyecto

- **ESM**: `"type":"module"`, `moduleResolution: NodeNext`, TS strict. Los imports relativos llevan sufijo `.js` (`import { x } from './file.js'`).
- **Validación zod** (`api/validation.ts`): toda entrada externa pasa por
  `parseBody<S extends z.ZodTypeAny>(schema, body): {ok, value: z.output<S>} | {ok:false, issues}`.
  **NO uses `z.ZodType<T>`**: hace que los campos con `.default()` dentro de schemas con `.refine()` infieran como `optional` y rompan la asignación a tipos como `RuleInput`/`TaskOptions` (bug real, ya corregido — prefiere siempre `z.ZodTypeAny` + `z.output<S>`).
- **Sin comentarios en el código**.
- **IDs**: `createId(prefix)` genera `${prefix}-${ts36}-${rand36}`. Prefixos: `node`, `task`, `rule`. El nodo del sistema se llama `node-general`; los workers `node-1..N`.
- **Estados**: `STATUS_CODE` mapea `active=0`, `inactive=1`, `error=2`.

## Variables de entorno

Definidas en `backend/src/config.ts` (schema zod con default), ejemplo en `backend/.env.example`:

| Variable | Default | Efecto |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP + WebSocket |
| `TICK_MS` | `1000` | Intervalo del tick (50–60000 ms) |
| `INITIAL_NODES` | `3` | Workers iniciales (más el general) |
| `INITIAL_TEMP` | `25` | Temperatura inicial de los nodos |
| `TARGET_TEMP` | `30` | Objetivo global inicial |
| `AMBIENT_TEMP` | `20` | Ambiente global inicial |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido (REST y WS) |
| `NODE_QUEUE_CAPACITY` | `50` | Capacidad de la cola FIFO por nodo |
| `STACK_CAPACITY` | `20` | Capacidad de la pila LIFO |
| `LOG_CAPACITY` | `200` | Tamaño del buffer de logs |
| `MAX_CONSECUTIVE_FAILURES` | `5` | Fallos consecutivos para estado `error` (1–255) |
| `RULES_FILE` | `data/default-rules.json` | Reglas iniciales cargadas al arranque |

## Cómo extender el proyecto

### 1. Agregar un tipo de acción

1. Añade el nombre al union `ActionType` y al array `ACTION_TYPE_VALUES` en `domain/types.ts` (el enum zod de `validation.ts` lo usa directamente).
2. Añade un `case` en `runAction` (`domain/actions.ts`) usando `numParam`/`strParam` para leer `actionParams`, mutar el nodo, hacer `pushEvent` y loguear.
3. (Opcional) Añade un ejemplo en `data/default-rules.json` y tests en `test/rules.test.ts`.

### 2. Agregar un campo a un nodo

1. `NodeConfig` (entrada) y la clase `SimNode` en `domain/node.ts`.
2. `NodeDto` en `domain/types.ts` y su emisión en `toDto()`.
3. Si es editable por API: `patchNodeSchema` (o `createNodeSchema`) en `api/validation.ts` y su aplicación en `nodes.routes.ts`.
4. Si afecta al térmico: hazlo valer en `SimNode.thermalStep` o en `thermal.ts`.

### 3. Agregar una regla por defecto

Añade un objeto válido en `backend/data/default-rules.json`. El `rulesLoader` filtra por `isRuleInput` (requiere `name`, `metric`, `op`, `value`, `action`) y lo ignora si es inválido. Se pueden tocar en caliente por `PATCH /api/rules/:id` sin reiniciar.

### 4. Persistencia real

`PersistenceRepository` (`infra/persistence.ts`) tiene un `MemoryPersistence` inyectado en `index.ts`. Para persistir de verdad, implementa la interfaz (`load(): SystemSnapshotDto | null`, `save(snapshot): void`) y enróscala en el bootstrap; el shutdown ya llama a `persistence.save(...)`.

## Flujo de trabajo con git

Antes de commitear:

```bash
cd backend
pnpm.cmd run typecheck && pnpm.cmd run test && pnpm.cmd run build
```

- `typecheck` falla con imports/locals sin usar (`noUnusedLocals`/`noUnusedParameters`).
- 19 tests vitest en `backend/test/` (térmico, colas/pila, reglas).
- El frontend valida con `npm.cmd run lint` y `npm.cmd run build`.

Mensajes en español, imperativo, con scope: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Ejemplos: `feat(backend): ...`, `feat(frontend): ...`. No commitear artefactos de build (`node_modules/`, `dist/`, `.pio/`).