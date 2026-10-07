# WAItt Backend — Simulador de temperatura

Simulador en Node.js/TypeScript del sistema WAItt: replica la lógica del firmware Arduino
(modelo térmico, sensores con estados, colas de prioridad de tareas, pila LIFO de eventos y
reglas reactivas) y la expone vía REST + Socket.IO para que la interfaz React pueda operar
sin hardware.

## Requisitos

- Node.js ≥ 20
- pnpm ≥ 9 (instalación con `npm install -g pnpm`)

## Instalación y ejecución

```bash
pnpm install          # instala dependencias
cp .env.example .env  # configuración opcional
pnpm dev              # arranca el servidor con recarga en vivo (tsx watch)
pnpm build            # compila TypeScript a dist/
pnpm start            # sirve dist/ (tras build)
pnpm test             # tests unitarios (vitest)
```

Por defecto escucha en `http://localhost:3000` con `GET /health` de verificación.

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP/WebSocket |
| `TICK_MS` | `1000` | Intervalo de tick del motor (50–60000 ms) |
| `INITIAL_NODES` | `3` | Número de nodos trabajadores al arrancar |
| `INITIAL_TEMP` | `25` | Temperatura inicial de los nodos (°C) |
| `TARGET_TEMP` | `30` | Temperatura objetivo del sistema |
| `AMBIENT_TEMP` | `20` | Temperatura ambiente |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido (Vite dev) |
| `NODE_QUEUE_CAPACITY` | `50` | Capacidad máxima de la cola de prioridad por nodo |
| `STACK_CAPACITY` | `20` | Capacidad de la pila LIFO de eventos |
| `LOG_CAPACITY` | `200` | Tamaño del buffer de logs en memoria |
| `LOG_FILE` | `data/logs.jsonl` | Archivo JSONL de persistencia del log (`""` desactiva) |
| `LOG_CONSOLE` | `true` | Imprime los logs en la consola del proceso |
| `LOG_LEVEL` | `info` | Nivel mínimo impreso en consola (`info`/`warning`/`critical`) |
| `LOG_HTTP` | `true` | Registra cada petición HTTP (método, ruta, status, duración) |
| `LOG_TELEMETRY_EVERY` | `5` | Línea de telemetría (temps y media) cada N ticks; `0` desactiva |
| `MAX_CONSECUTIVE_FAILURES` | `5` | Lecturas fallidas consecutivas antes de marcar el sensor en error |
| `PENDING_POOL_CAPACITY` | `100` | Capacidad del pool global de tareas pendientes (cola de prioridad) |
| `RULES_FILE` | `data/default-rules.json` | Ruta del JSON de reglas iniciales |
| `DB_ENABLED` | `true` | Activa el escritor time-series hacia MariaDB/MySQL |
| `DB_HOST` | `localhost` | Host de la BD (`db` dentro de Docker) |
| `DB_PORT` | `3306` | Puerto de la BD |
| `DB_NAME` | `waitt` | Base de datos |
| `DB_USER` | `waitt` | Usuario (creado por el docker-compose) |
| `DB_PASSWORD` | `waitt` | Contraseña del usuario |
| `DB_FLUSH_MS` | `1000` | Intervalo de vaciado del buffer hacia la BD |
| `DB_MAX_BUFFER` | `1000` | Filas máximas antes de forzar un vaciado |
| `DB_SCHEMA_FILE` | `../docker/mysql/init/01-schema.sql` | DDL ejecutado al arrancar (fuente única del esquema) |

## Arquitectura

Capa por directorio bajo `src/`:

- `domain/` — reglas de negocio puras en TypeScript sin I/O: modelo térmico, colas de
  prioridad, pila LIFO, nodos, sistema, dispatcher, store y evaluación de reglas, acciones.
- `engine/` — `EventBus` tipado y `SimulationEngine`: avanza el tick (térmico → tareas y
  dispatch → reglas) y emite eventos.
- `api/` — routers Express con validación zod y contexto compartido.
- `infra/` — config de entorno, loader de reglas, logs, persistencia del log (JSONL) y
  Socket.IO. `PersistenceRepository` (implementado en memoria) queda como punto de enganche
  para la BD time-series futura.
- `index.ts` — bootstrap: configura, crea el contexto, arranca el motor y el servidor.

El dominio no depende de Express ni del transport: la API y Socket.IO se suscriben al
mismo `EventBus<SimEventMap>`.

## Modelo térmico

Cada tick, para cada nodo activo:

```
dT/dt = (target − T)/τ + gananciaCarga × workload − disipación × (T − ambiente) × (ventilador ? 3 : 1)
```

Parámetros: `τ = 20 s`, ganancia de carga `0.35`, disipación `0.002` (×3 con ventilador).
Un nodo inactivo no cambia la temperatura. La tarea en curso aporta calor adicional según su
**demanda de cómputo** (1–5): `demanda × 0.07` sobre la carga del nodo.

## Cola de prioridad global y dispatcher

Toda tarea de la regla `enqueue_task` con `subject=any|all`, o vía `POST /api/tasks`, entra en
un **pool global** (`PriorityTaskQueue`). Cada tick, el **dispatcher** toma la tarea de mayor
prioridad (1 = menor … 5 = mayor; empate en hora de encolado, FIFO) y la asigna al nodo
**activo, libre y con cola propia vacía** de menor temperatura: así el trabajador más frío
recibe trabajo y se calienta (estrangulamiento térmico), repartiéndose la carga. Los nodos
con tareas en su cola local las procesan antes que el pool.

## Persistencia

- **Log acotado persistente**: el buffer en memoria (`LOG_CAPACITY`) se vuelca a `LOG_FILE`
  en formato JSONL (una entrada `LogEntry` por línea). Al superar la capacidad, el archivo se
  reescribe desde memoria para respetar el mismo límite. Al arrancar, el buffer se restaura
  desde el archivo (las líneas corruptas se ignoran). Vaciar el log con `DELETE /api/logs`
  también vacía el archivo.
- **Reglas**: `RULES_FILE` es la semilla inicial; cada alta/baja/modificación por API se
  sincroniza de vuelta al mismo archivo (escritura atómica, sin campos runtime como
  `triggerCount`).
- **BD time-series** (`infra/timeseriesSink.ts`): si `DB_ENABLED`, un `TimeSeriesSink` se
  suscribe al `EventBus` y escribe en MariaDB/MySQL las mediciones del esquema de
  `docs/guia-tecnica.md`: `node:updated` → filas `telemetry`; `rule:triggered`,
  `task:queued/completed/pending` y `alert` → filas `events`. El DDL se ejecuta al arranque
  desde `DB_SCHEMA_FILE` y la escritura va por lotes (cada `DB_FLUSH_MS` o `DB_MAX_BUFFER`
  filas); si la BD falla solo se loguea, la simulación sigue. El `docker-compose.yml` de la
  raíz levanta MariaDB + phpMyAdmin.

## API REST

Prefijo `/api`. Errores de validación: `400 { error, issues }`. Nodo inexistente: `404`.
Cola llena: `409`.

### Nodos — `/api/nodes`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Todos los nodos (general + trabajadores) |
| GET | `/:id` | Un nodo |
| POST | `/` | Crear nodo `{ name, initialTemp?, targetTemp?, ambientTemp?, workload? }` |
| PATCH | `/:id` | `{ name?, status?, targetTemp?, ambientTemp?, workload?, fanActive?, fanMinutes? }` |
| DELETE | `/:id` | Eliminar nodo (no el general) |
| GET | `/:id/queue` | Cola de prioridad de tareas del nodo |
| POST | `/:id/queue` | Encolar `{ type?='custom', priority?=3, computeDemand?=1, durationSecs?=5, description?, payload? }` |
| DELETE | `/:id/queue` | Vaciar la cola |
| GET | `/:id/stack` | Pila LIFO de eventos del nodo |

```bash
curl http://localhost:3000/api/nodes
curl -X POST http://localhost:3000/api/nodes -H "Content-Type: application/json" -d '{"name":"Nodo 4","initialTemp":28}'
curl -X PATCH http://localhost:3000/api/nodes/node-1 -H "Content-Type: application/json" -d '{"fanActive":true,"fanMinutes":5}'
curl -X POST http://localhost:3000/api/nodes/node-1/queue -H "Content-Type: application/json" -d '{"type":"cooldown","priority":4,"computeDemand":2,"durationSecs":8,"description":"Enfriar"}'
```

### Tareas globales — `/api/tasks`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Pool global: `{ pending: { list, size, capacity, remaining } }` |
| POST | `/` | Encolar al pool `{ type?='custom', priority?=3, computeDemand?=1, durationSecs?=5, description?, payload? }` → `201` |
| DELETE | `/` | Vaciar el pool → `{ removed }` |

```bash
curl http://localhost:3000/api/tasks
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"type":"maintenance","priority":5,"computeDemand":3,"durationSecs":10,"description":"Urgente"}'
``

### Sistema — `/api/system`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Snapshot completo (nodos, colas, pila, reglas, motor) |
| PATCH | `/` | `{ targetTemp?, ambientTemp?, running? }` |

### Reglas — `/api/rules`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Reglas activas |
| POST | `/` | Crear regla (ver esquema abajo) |
| PATCH | `/:id` | Actualización parcial |
| DELETE | `/:id` | Eliminar regla |

Una regla tiene el formato:

```json
{
  "name": "Ventilador por temperatura alta",
  "enabled": true,
  "cooldownMs": 30000,
  "subject": "any | all | system | node",
  "nodeId": "node-1",
  "metric": "temperature | status",
  "op": "> | < | >= | <= | == | !=",
  "value": 55,
  "action": "fan_on | fan_off | shutdown | startup | enqueue_task | send_alert | reduce_load | set_target_temperature",
  "actionParams": { "minutes": 2 }
}
```

Por defecto `enabled=true`, `cooldownMs=30000`, `subject='any'`. Con `subject=node` es
obligatorio `nodeId`. `status` numérico: `0` activo, `1` inactivo, `2` en error. Los
cambios se aplican en vivo: el motor re-carga las reglas cada tick (no hay reinicio), y se
persisten en `RULES_FILE` al crear/editar/eliminar por API.

### Logs — `/api/logs`

`GET /api/logs?level=info,warning,critical&type=rule|task|node|api&nodeId=node-1&since=<ms>&limit=<n>`.
`DELETE /api/logs` limpia el buffer y el archivo persistido.

### Motor — `/api/sim`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/status` | `running`, `tickMs`, `uptimeMs`, conteos |
| POST | `/pause` | Pausar el motor |
| POST | `/resume` | Reanudar |
| POST | `/tick` | Avanzar un tick manualmente (solo en pausa; `409` si corre) |
| POST | `/reset` | Reiniciar el sistema al estado inicial |

## WebSocket (Socket.IO)

Conecta `io("http://localhost:3000")`. Todos los paquetes llegan como
`{ type, ts, payload }` emitidos por el nombre del evento:

| Evento | Payload |
|---|---|
| `state:update` | Snapshot completo del sistema |
| `node:updated` | `{ nodeId, node }` |
| `rule:triggered` | `{ ruleId, ruleName, nodeIds }` |
| `task:queued` / `task:completed` | `{ nodeId, task }` |
| `task:pending` | `{ task }` (entra al pool global) |
| `alert` | `{ nodeId, message, level }` |

El cliente puede suscribirse a un nodo concreto:

```js
socket.emit('node:subscribe', 'node-1');
socket.emit('node:unsubscribe', 'node-1');
```

## Integración con la interfaz React

En `vite.config.js` del frontend, redirige API y Socket.IO al backend:

```js
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/socket.io': { target: 'http://localhost:3000', ws: true },
  },
}
```

```js
import { io } from 'socket.io-client';
const socket = io(); // por el proxy en el mismo puerto Vite

socket.on('state:update', (packet) => console.log(packet.payload));
socket.on('alert', ({ payload }) => console.warn(payload));
```

Recomendado: un hook `useSimulation()` que mantenga el snapshot en estado con
`useState` + `useEffect`, y hooks específicos por dominio consumiendo los demás eventos.