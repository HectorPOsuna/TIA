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
│   │   ├── node.ts                # SimNode (nodo + cola de prioridad + pila LIFO)
│   │   ├── tasks.ts               # PriorityTaskQueue (cola por prioridad, FIFO en empate)
│   │   ├── stack.ts               # EventStack (pila LIFO)
│   │   ├── thermal.ts             # Modelo térmico (thermalStep) + COMPUTE_DEMAND_HEAT
│   │   ├── dispatcher.ts          # Pick del nodo libre más frío (estrangulamiento térmico)
│   │   ├── system.ts              # SystemSimulation (nodos, pool global, snapshot, reset)
│   │   ├── rules.ts               # Evaluación de reglas (evaluateRule)
│   │   ├── rules-store.ts         # RuleStore (CRUD + enabledList)
│   │   └── actions.ts             # runAction (efecto de cada acción)
│   ├── engine/
│   │   ├── eventBus.ts            # EventBus genérico tipado
│   │   ├── events.ts              # SimEventMap (eventos tipados)
│   │   └── simulationEngine.ts    # Tick, tareas/dispatch, reglas, cooldowns
│   ├── api/
│   │   ├── context.ts             # AppContext (contexto compartido)
│   │   ├── validation.ts          # Schemas zod + parseBody/parseQuery*
│   │   └── *.routes.ts            # nodes / system / rules / logs / simulate / tasks
│   ├── infra/
│   │   ├── config.ts              # loadConfig (env → Config zod)
│   │   ├── httpServer.ts          # Express: cors, routers, health, 404/500
│   │   ├── sockets.ts             # attachSockets (puente bus ↔ io)
│   │   ├── logger.ts              # LogStore (buffer en memoria)
│   │   ├── persistence.ts         # PersistenceRepository + MemoryPersistence
│   │   └── rulesLoader.ts         # Carga data/default-rules.json
│   └── index.ts                   # Bootstrap (config, ctx, io, listen)
├── data/default-rules.json        # Reglas iniciales (hot-editable por API)
└── test/                          # Tests vitest (thermal, tasks, dispatch, rules)
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
| `queue` | `QueueDto` | Estado de la cola de prioridad |
| `stack` | `StackDto` | Estado de la pila LIFO |
| `updatedAt` | number | Último tick |

El "estado en error" es un **contador simulado** de fallos consecutivos: cuando `consecutiveFailures >= maxConsecutiveFailures` el nodo pasa a `error` (métodos `markFailure`/`recover`). No hay hardware.

### Tarea y cola de prioridad (`tasks.ts`)

`PriorityTaskQueue` procesa primero la tarea de **mayor prioridad** (`priority`, 1 = menor … 5 = mayor) y, en empate, la **más antigua** (FIFO), con capacidad limitada (`NODE_QUEUE_CAPACITY` por nodo, `PENDING_POOL_CAPACITY` para el pool global). API: `enqueue`, `peek` (solo lectura), `poll` (extrae), `startProcessing`, `complete`, `clear`, `toArray` (orden de servicio).

Tipos de tarea (`TaskType`): `cooldown`, `maintenance`, `reboot`, `calibration`, `custom`. Estados: `pending → processing → completed`. Campos: `id`, `type`, `priority`, `computeDemand` (1–5), `durationSecs` (1–10, defecto `5`), `status`, `enqueuedAt`, `startedAt?`, `completedAt?`, `description?`, `payload?`.

### Dispatcher (`dispatcher.ts`)

`dispatchHighestPriority(workers, pool)` toma `pool.peek()` (la mayor prioridad) y lo asigna al candidato elegido por `pickCoolestWorker`: un worker **activo**, **sin tarea en curso** y con **cola local vacía**, de **menor `currentTemp`**. Devuelve `{node, task}` (la tarea ya se extrajo del pool); el motor llama a `node.startExternalTask(task)`. Así el "estrangulamiento térmico" reparte carga: el nodo más frío recibe trabajo y su temperatura sube por la demanda de cómputo.

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
| `enqueue_task` | `taskType` (def. `cooldown`), `priority?` (1–5), `computeDemand?` (1–5), `durationSecs?` (1–10) o `durationMs` (retrocompatible), `description` | Encola tarea: con `subject=any\|all` entra **al pool global** (emite `task:pending`); con `subject=system\|node` a la cola del nodo (emite `task:queued`) |
| `send_alert` | `message` | Log crítico + evento WebSocket `alert` |
| `reduce_load` | `by` (def. 0.3) | Baja `workload` (mínimo 0) |
| `set_target_temperature` | `target` | Ajusta `targetTemp` |

## Motor de simulación (`engine/simulationEngine.ts`)

- `start()` usa `setInterval(tick, TICK_MS)`. El tick calcula `dt = min(Date.now() - lastTickAt, MAX_DT_MS)` con `MAX_DT_MS = 5000` — **tiempo real**, no un delta fijo (evita "saltos" si el proceso se bloquea).
- Orden del tick (`step(dtMs)`):
  1. `system.tickThermalAll(dtMs)` — térmica de cada nodo + expiración de ventiladores.
  2. `processTasks()` — completa tareas vencidas (`now - startedAt >= durationSecs*1000`); después despacha el **pool global**: mientras queden tareas y workers elegibles, `dispatchHighestPriority` las asigna al nodo activo libre más frío (`startExternalTask`); finalmente, los nodos con cola local libre arrancan su siguiente tarea (`startNextTask`).
  3. `evaluateRules()` — recorre `rules.enabledList()` (las reglas se leen **cada tick** → edits en caliente vía API), respeta `cooldownMs`, ejecuta `runAction` por nodo y emite `rule:triggered` (+ `alert` si la acción es `send_alert`). La acción `enqueue_task` con `subject=any|all` inyecta **una** tarea al pool global en vez de una por nodo.
  4. Emite `node:updated` por nodo y `state:update` (snapshot).
- `pause()`/`resume()` detienen/reanudan el intervalo. `stepOnce()` permite avanzar un tick manualmente **solo en pausa** (si está corriendo lanza un error que la API traduce a HTTP 409).
- `reset()` restaura nodos, colas, pilas y contadores de reglas. El motor arranca con `engine.start()` al levantar el servidor.

Modelo térmico (`thermal.ts`):

```
dT/dt = (target − T) / τ + loadHeatGain·(workload + demanda×COMPUTE_DEMAND_HEAT) − dissipationRate·(T − ambient)·(fan ? 3 : 1)
```

Con constantes por defecto: `timeConstantMs = 20000`, `loadHeatGain = 0.35`, `dissipationRate = 0.002`, `fanDissipationMultiplier = 3`, `COMPUTE_DEMAND_HEAT = 0.07`. Un nodo inactivo no cambia de temperatura; la tarea en curso aporta `computeDemand × 0.07` a la carga efectiva.

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
| POST | `/:id/queue` | `{type?='custom', priority?=3, computeDemand?=1, durationSecs?=5, description?, payload?}` | 201 `{task}` o 409 |
| DELETE | `/:id/queue` | — | `{removed: n}` |
| GET | `/:id/stack` | — | `{stack: StackDto}` |

La cola en `QueueDto`: `{list, size, capacity, remaining, processing}`.

### `/api/tasks`

Pool global de tareas pendientes (cola de prioridad).

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/` | — | `{pending: PendingQueueDto}` |
| POST | `/` | `{type?='custom', priority?=3, computeDemand?=1, durationSecs?=5, description?, payload?}` | 201 `{task}` o 409 (pool lleno) |
| DELETE | `/` | — | `{removed: n}` |

`PendingQueueDto`: `{list, size, capacity, remaining}`.

### `/api/system`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/` | — | `{system: SystemSnapshotDto}` |
| PATCH | `/` | `{targetTemp?, ambientTemp?, running?}` | `{system}` |

`SystemSnapshotDto`: `{ts, running, targetTemp, ambientTemp, general, workers[], summary{totalWorkers, activeWorkers, inactiveWorkers, errorWorkers, averageTemp}, pendingQueue{list, size, capacity, remaining}}`.

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
| GET | `/status` | `{running, tickMs, uptimeMs, nodesCount, rulesCount, logsCount, pendingTasks}` |
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
| `task:queued` | `{nodeId, task}` | Al encolar por API o por regla en la cola de un nodo |
| `task:completed` | `{nodeId, task}` | Cuando una tarea termina en el motor |
| `task:pending` | `{task}` | Al entrar una tarea al pool global (API o regla `any`/`all`) |
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
| `NODE_QUEUE_CAPACITY` | `50` | Capacidad de la cola de prioridad por nodo |
| `STACK_CAPACITY` | `20` | Capacidad de la pila LIFO |
| `LOG_CAPACITY` | `200` | Tamaño del buffer de logs |
| `LOG_FILE` | `data/logs.jsonl` | Archivo JSONL de persistencia del log (`""` desactiva) |
| `LOG_CONSOLE` | `true` | Imprime los logs en la consola del proceso |
| `LOG_LEVEL` | `info` | Nivel mínimo impreso en consola (`info`/`warning`/`critical`) |
| `LOG_HTTP` | `true` | Registra cada petición HTTP (método, ruta, status, duración) |
| `LOG_TELEMETRY_EVERY` | `5` | Línea de telemetría (temps y media) cada N ticks; `0` desactiva |
| `MAX_CONSECUTIVE_FAILURES` | `5` | Fallos consecutivos para estado `error` (1–255) |
| `PENDING_POOL_CAPACITY` | `100` | Capacidad del pool global de tareas pendientes (1–10000) |
| `RULES_FILE` | `data/default-rules.json` | Reglas iniciales cargadas al arranque |
| `DB_ENABLED` | `true` | Activa el escritor time-series hacia MariaDB/MySQL |
| `DB_HOST` | `localhost` | Host de la BD (`db` dentro de Docker Compose) |
| `DB_PORT` | `3306` | Puerto de la BD |
| `DB_NAME` | `waitt` | Base de datos |
| `DB_USER` | `waitt` | Usuario (creado por el docker-compose) |
| `DB_PASSWORD` | `waitt` | Contraseña del usuario |
| `DB_FLUSH_MS` | `1000` | Intervalo de vaciado del buffer hacia la BD |
| `DB_MAX_BUFFER` | `1000` | Filas máximas antes de forzar un vaciado |
| `DB_SCHEMA_FILE` | `../docker/mysql/init/01-schema.sql` | DDL ejecutado al arrancar (fuente única) |

## Persistencia (S5)

- **Log acotado persistente** (`infra/logger.ts`): el buffer en memoria (`LOG_CAPACITY`) se
  vuelca a `LOG_FILE` en JSONL (una `LogEntry` por línea). Cuando el buffer excede la
  capacidad, se reescribe el archivo completo desde memoria (el archivo respeta el mismo
  límite). Al arrancar se restaura el buffer desde el archivo, ignorando líneas corruptas;
  `clear()` y `DELETE /api/logs` vacían también el archivo.
- **Salida a consola**: el `LogStore` puede espejar cada entrada a la consola del proceso
  (`LOG_CONSOLE`, filtrada por `LOG_LEVEL`, con colores por nivel si hay TTY). Además, el
  middleware HTTP de `httpServer.ts` registra cada petición (`LOG_HTTP`) y el motor emite
  una línea de telemetría periódica con las temperaturas y su media (`LOG_TELEMETRY_EVERY`
  ticks); todo ello entra también al buffer y al archivo.
- **Reglas** (`infra/rulesLoader.ts`): `RULES_FILE` es la semilla inicial. El `RuleStore`
  expone `onChange`, enganchado en `index.ts` a `saveRulesToFile`, de modo que crear,
  editar o eliminar reglas por API sincroniza el archivo (escritura atómica `.tmp`+rename,
  sin los campos runtime `id`/`lastTriggeredAt`/`triggerCount`). El arranque no regraba el
  archivo porque `onChange` se asigna tras construir el store.
- **BD time-series** (`infra/timeseriesSink.ts`): con `DB_ENABLED` (defecto `true`), un
  `TimeSeriesSink` se suscribe al `EventBus` y escribe por lotes en MariaDB/MySQL siguiendo el
  esquema de abajo. El DDL se ejecuta al arranque desde `DB_SCHEMA_FILE` (fuente única con
  `docker/mysql/init/01-schema.sql`, idempotente). El Docker Compose de la raíz levanta
  MariaDB + phpMyAdmin; las credenciales de desarrollo son `waitt`/`waitt`.

## Esquema de la BD time-series

Implementado en MariaDB/MySQL (Docker Compose de la raíz) con diseño pensado también para
otras bases de series temporales (InfluxDB, TimescaleDB). Dos mediciones: `telemetry` captura
el estado térmico
por nodo en cada evento de tick; `events` registra los eventos de cola/pila/log sin perder el
detalle estructurado.

### Medición `telemetry`

| Campo | Tipo | Fuente |
|---|---|---|
| `ts` | timestamp | `NodeDto.updatedAt` (ms) |
| `node_id` | tag | `NodeDto.id` |
| `node_type` | tag | `NodeDto.type` (`general`/`worker`) |
| `current_temp` | float | `NodeDto.currentTemp` |
| `target_temp` | float | `NodeDto.targetTemp` |
| `ambient_temp` | float | `NodeDto.ambientTemp` |
| `workload` | float | `NodeDto.workload` |
| `status` | field | `STATUS_CODE[NodeDto.status]` (0/1/2) |
| `fan_active` | bool | `NodeDto.fanActive` |
| `queue_length` | int | `NodeDto.queue.size` |
| `stack_size` | int | `NodeDto.stack.size` |

### Medición `events`

| Campo | Tipo | Fuente |
|---|---|---|
| `ts` | timestamp | `LogEntry.ts` / `StackEntry.ts` |
| `node_id` | tag | `nodeId` (optativo) |
| `kind` | tag | `StackEntryKind` (`event`/`task`/`rule`/`alert`/`change`) o `LogLevel` |
| `type` | tag | `LogType` (`system`/`api`/`rule`/`task`/`node`/`alert`) |
| `label` | field | `StackEntry.label` |
| `message` | field | `LogEntry.message` |
| `meta` | field | JSON estructurado (`LogEntry.meta` / `StackEntry.meta`) |

El DDL real (MariaDB/MySQL) vive en `docker/mysql/init/01-schema.sql` — fuente única
ejecutada tanto por Docker en el primer arranque como por el `TimeSeriesSink` al conectar.
Los timestamps se guardan como ms y una vista `telemetry_minute` resume las muestras por
minuto para consultas rápidas.

Las filas las genera el `TimeSeriesSink` (`infra/timeseriesSink.ts`) suscrito al `EventBus`:
`node:updated` → `telemetry`; `rule:triggered`, `task:queued/completed/pending` y `alert` →
`events`. Escribe por lotes (cada `DB_FLUSH_MS` o `DB_MAX_BUFFER` filas) y ejecuta el DDL al
arrancar; si la BD falla, solo registra el error (vía `onError` → log crítico) y la
simulación continúa. `PersistenceRepository` en memoria sigue encargándose del snapshot.

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

El log persiste en JSONL (`LOG_FILE`), las reglas se sincronizan con `RULES_FILE` y la
telemetría/eventos se escriben en MariaDB/MySQL vía el `TimeSeriesSink`
(véase "Persistencia (S5)"). Lo que sigue en memoria es el estado del sistema
(`PersistenceRepository` con su `MemoryPersistence` inyectado en `index.ts`): para
persistirlo, implementa la interfaz (`load(): SystemSnapshotDto | null`,
`save(snapshot): void`) y conéctalas en el bootstrap; el shutdown ya llama a
`persistence.save(...)`.

## Flujo de trabajo con git

Antes de commitear:

```bash
cd backend
pnpm.cmd run typecheck && pnpm.cmd run test && pnpm.cmd run build
```

- `typecheck` falla con imports/locals sin usar (`noUnusedLocals`/`noUnusedParameters`).
- 38 tests vitest en `backend/test/` (térmico, colas de prioridad/pila, dispatcher, reglas,
  persistencia de log y de reglas).
- El frontend valida con `npm.cmd run lint` y `npm.cmd run build`.

Mensajes en español, imperativo, con scope: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Ejemplos: `feat(backend): ...`, `feat(frontend): ...`. No commitear artefactos de build (`node_modules/`, `dist/`, `.pio/`).