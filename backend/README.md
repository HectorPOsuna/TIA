# TIA Backend — Simulador de temperatura

Simulador en Node.js/TypeScript del sistema TIA: replica la lógica del firmware Arduino
(modelo térmico, sesores con estados, colas FIFO de tareas, pila LIFO de eventos y reglas
reactivas) y la expone vía REST + Socket.IO para que la interfaz React pueda operar sin
hardware.

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
| `NODE_QUEUE_CAPACITY` | `50` | Capacidad máxima de la cola FIFO por nodo |
| `STACK_CAPACITY` | `20` | Capacidad de la pila LIFO de eventos |
| `LOG_CAPACITY` | `200` | Tamaño del buffer de logs en memoria |
| `MAX_CONSECUTIVE_FAILURES` | `5` | Lecturas fallidas consecutivas antes de marcar el sensor en error |
| `RULES_FILE` | `data/default-rules.json` | Ruta del JSON de reglas iniciales |

## Arquitectura

Capa por directorio bajo `src/`:

- `domain/` — reglas de negocio puras en TypeScript sin I/O: modelo térmico, cola FIFO,
  pila LIFO, nodos, sistema, store y evaluación de reglas, acciones.
- `engine/` — `EventBus` tipado y `SimulationEngine`: avanza el tick (térmico → colas de
  tareas → reglas) y emite eventos.
- `api/` — routers Express con validación zod y contexto compartido.
- `infra/` — config de entorno, persistencia (interface con implementación en memoria,
  lista para un driver real), loader de reglas, logs y Socket.IO.
- `index.ts` — bootstrap: configura, crea el contexto, arranca el motor y el servidor.

El dominio no depende de Express ni del transport: la API y Socket.IO se suscriben al
mismo `EventBus<SimEventMap>`.

## Modelo térmico

Cada tick, para cada nodo activo:

```
dT/dt = (target − T)/τ + gananciaCarga × workload − disipación × (T − ambiente) × (ventilador ? 3 : 1)
```

Parámetros: `τ = 20 s`, ganancia de carga `0.35`, disipación `0.002` (×3 con ventilador).
Un nodo inactivo no cambia la temperatura.

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
| GET | `/:id/queue` | Cola FIFO de tareas |
| POST | `/:id/queue` | Encolar `{ type?='custom', estimatedDurationMs?=5000, description?, payload? }` |
| DELETE | `/:id/queue` | Vaciar la cola |
| GET | `/:id/stack` | Pila LIFO de eventos del nodo |

```bash
curl http://localhost:3000/api/nodes
curl -X POST http://localhost:3000/api/nodes -H "Content-Type: application/json" -d '{"name":"Nodo 4","initialTemp":28}'
curl -X PATCH http://localhost:3000/api/nodes/node-1 -H "Content-Type: application/json" -d '{"fanActive":true,"fanMinutes":5}'
curl -X POST http://localhost:3000/api/nodes/node-1/queue -H "Content-Type: application/json" -d '{"type":"cooldown","estimatedDurationMs":8000,"description":"Enfriar"}'
```

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
cambios se aplican en vivo: el motor re-carga las reglas cada tick (no hay reinicio).

### Logs — `/api/logs`

`GET /api/logs?level=info,warning,critical&type=rule|task|node|api&nodeId=node-1&since=<ms>&limit=<n>`.
`DELETE /api/logs` limpia el buffer.

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