# Eventos de simulación y generador de tráfico

Fecha: 2026-11-05

## Intención

Añadir al simulador un catálogo de eventos de primera clase que permita dos cosas:

1. Generar tráfico de tareas de forma autónoma, simulando servidores que reciben trabajo.
2. Inyectar perturbaciones automáticas (por probabilidad) o manuales para comprobar que las
   reglas, el control IA, el dispatcher y la telemetría reaccionan.

El objetivo es probar el sistema sin esperar condiciones reales ni escribir scripts externos.

## Objetivos

- Catálogo con id, nombre, categoría, probabilidad, cooldown, enabled y parámetros.
- Motor automático que evalúa el catálogo cada `EVENTS_INTERVAL_MS`.
- Disparo manual que salta probabilidad y cooldown.
- Configuración por env y API en caliente; el reinicio restablece los valores por defecto.
- Panel flotante abajo a la derecha, abierto con un icono original de sonrisa de bufón.
- Cada disparo visible en logs, en la tabla `events` y por Socket.IO.

## No objetivos

- Persistir la configuración del catálogo en disco.
- Editar el catálogo desde el centro de control existente.
- Añadir dependencias nuevas.
- Cambiar el modelo térmico, el dispatcher o el formato de las tareas.
- Reproducir un personaje concreto: el icono es una sonrisa de bufón original en SVG.

## Antimetas

- Que el generador arranque activo y cambie el comportamiento actual sin pedirlo.
- Que un evento manual quede bloqueado por probabilidad o cooldown.
- Que el panel bloquee la escena o se abra como modal.
- Que un fallo de un evento detenga el tick.

## Enfoques considerados

### A. Motor de eventos dentro del tick (elegido)

`EventEngine` en `engine/`, catálogo y efectos en `domain/events.ts`, avanzado desde
`SimulationEngine.step(dtMs)`. Pausa, `stepOnce`, reset y tests comparten el mismo reloj.
Es el que se implementa.

### B. Servicio con `setInterval` propio

Menos cableado en el motor, pero sigue disparando en pausa, necesita ciclo de vida aparte y
duplica el reloj. Descartado.

### C. Reutilizar reglas reactivas

Las reglas son umbrales deterministas en memoria. No representan probabilidad por evento ni
perturbaciones sin métricas artificiales. Descartado.

## Catálogo

| Id | Categoría | Efecto | Prob. por defecto | Cooldown |
|---|---|---|---|---|
| `task_arrival` | tráfico | Encola 1–3 tareas en el pool global | 0.08 | 3 s |
| `thermal_spike` | perturbación | Suma +6 °C a un worker | 0.02 | 15 s |
| `node_failure` | perturbación | Fuerza el estado `error` de un worker | 0.01 | 60 s |
| `node_recovery` | perturbación | Devuelve un worker a `active` y limpia fallos | 0.03 | 30 s |
| `fan_failure` | perturbación | Apaga el ventilador de un worker | 0.01 | 30 s |
| `workload_surge` | perturbación | Suma +0.35 de carga (máximo 1) | 0.02 | 30 s |
| `synthetic_alert` | perturbación | Emite una alerta crítica | 0.01 | 30 s |

Todos los eventos arrancan `enabled=true`, pero el generador global arranca apagado
(`EVENTS_ENABLED=false`). Las perturbaciones se aplican solo a workers; el nodo general es un
agregado y se sobrescribe cada tick. Si no hay workers, el evento no se aplica.

### Semántica de `task_arrival`

- Sin `nodeId`: encola en el pool global, que el dispatcher reparte.
- Con `nodeId`: encola en la cola local de ese nodo.
- Tipo, prioridad, demanda y duración se eligen al azar dentro de los rangos existentes. El tipo
  incluye los cinco valores (`cooldown`, `maintenance`, `reboot`, `calibration`, `custom`), así
  que el tráfico también puede probar el enfriamiento por tarea.
- `params.count` limita el número de tareas (1–3).
- Cada tarea emitida produce `task:pending` o `task:queued`.
- `applied=true` si se encoló al menos una tarea; si el pool está lleno, las que no entraron se
  cuentan en `message` y el evento queda `applied=false` solo cuando no entró ninguna.

### Semántica de las perturbaciones

- `thermal_spike`: `params.magnitude` (por defecto 6) se suma a `currentTemp` con clamp
  `[-60, 150]`. `applied=false` si el clamp impide el cambio.
- `node_failure`: nuevo `SimNode.forceFailure(now)` que incrementa `failures`, fija
  `consecutiveFailures` al máximo, pone `status='error'` y apila el cambio. No cancela la tarea
  actual ni vacía la cola. `applied=false` si el nodo ya estaba en error.
- `node_recovery`: fija `status='active'` y llama a `recover()`. `applied=false` si ya estaba
  activo.
- `fan_failure`: `fanActive=false`, `fanUntilMs=0`. `applied=false` si ya estaba apagado.
- `workload_surge`: `params.magnitude` (por defecto 0.35) se suma a `workload` con clamp `[0, 1]`.
  `applied=false` si la carga ya era 1.
- `synthetic_alert`: `params.message` y `params.level` (`warning` o `critical`); por defecto
  crítica. No muta el nodo. Emite el `alert` existente (toast, panel de alertas y fila `alert` en
  BD) además de `event:triggered`.

### Selección de objetivo

- Las perturbaciones automáticas solo eligen workers:
  - `thermal_spike`, `node_failure` y `workload_surge`: workers `active`; `workload_surge`
    además exige `workload < 1`.
  - `fan_failure`: workers `active` con `fanActive=true`.
  - `node_recovery`: workers en `error`. No reactiva apagados deliberadamente por reglas o IA.
  - `synthetic_alert`: un worker activo aleatorio; si no hay, sin `nodeId`.
- `task_arrival` automático siempre va al pool.
- En disparo manual, `nodeId` es opcional. Las perturbaciones aceptan cualquier worker; si se
  pasa el nodo general, `400`; si el id no existe, `404`. `synthetic_alert` acepta cualquier nodo.
  `task_arrival` acepta cualquier nodo y encola en su cola local.
- Si no hay candidatos elegibles, el evento no se aplica y se registra `applied=false`.

## Motor

`EventEngine` recibe `SystemSimulation`, `EventBus`, `LogStore`, un RNG inyectable y un reloj
inyectable.

- Estado global: `enabled`, `intervalMs`, acumulador de tiempo.
- Estado por evento: `enabled`, `probability`, `cooldownMs`, `lastTriggeredAt`, `triggerCount`.
- `step(dtMs)`: si el generador está apagado, no hace nada. Acumula `dtMs`; cuando llega al
  intervalo, evalúa una vez y descuenta el intervalo. Como máximo una evaluación por tick.
- En cada evaluación, cada evento habilitado tira su probabilidad de forma independiente y
  respeta su cooldown. Pueden dispararse varios en la misma ventana.
- Si la tirada pasa, el evento consume cooldown y suma `triggerCount` aunque su efecto no se
  pueda aplicar (`applied=false`): así un pool lleno no reintenta cada ventana.
- `trigger(id, request)`: aplica siempre, aunque el generador o el evento estén deshabilitados.
  Actualiza contador y `lastTriggeredAt`. Devuelve el payload.
- `resetRuntime()`: limpia contadores, `lastTriggeredAt` y el acumulador; conserva la
  configuración. Lo llama `SimulationEngine.reset()`.
- El reinicio del proceso vuelve a los valores por defecto de env.

Un fallo al aplicar un evento se captura, se registra como warning y no interrumpe el tick.

## API

### `GET /api/events`

```json
{
  "generator": { "enabled": false, "intervalMs": 5000 },
  "events": [
    {
      "id": "task_arrival",
      "name": "Llegada de tareas",
      "category": "traffic",
      "description": "...",
      "enabled": true,
      "probability": 0.08,
      "cooldownMs": 3000,
      "defaultParams": { "count": 2 },
      "lastTriggeredAt": 1760000000000,
      "triggerCount": 4
    }
  ],
  "recent": []
}
```

`recent` es un buffer en memoria de los últimos 50 disparos.

### `PATCH /api/events`

Body `{ enabled?, intervalMs? }`. `intervalMs` entre 250 y 3 600 000. Devuelve el estado
completo.

### `PATCH /api/events/:id`

Body `{ enabled?, probability?, cooldownMs? }`. `probability` entre 0 y 1; `cooldownMs` entre 0
y 3 600 000. Devuelve el evento actualizado. `404` si el id no existe. Los `defaultParams` son
de solo lectura: se consultan en el GET y se pueden sobrescribir por disparo manual, pero no se
editan por PATCH.

### `POST /api/events/:id/trigger`

Body opcional `{ nodeId?, params? }`. Aplica el evento y devuelve `{ event }` con el payload
completo. `404` si el evento o el nodo no existen; `400` si la validación falla. Si el efecto no
se puede aplicar (pool lleno, sin workers), responde `200` con `applied=false` y un mensaje.

## Evento de bus y persistencia

Nuevo `event:triggered` en `SimEventMap`:

```ts
interface EventTriggeredPayload {
  eventId: string;
  name: string;
  category: 'traffic' | 'perturbation';
  source: 'auto' | 'manual';
  nodeId?: string;
  applied: boolean;
  message: string;
  taskIds?: string[];
  params?: Record<string, unknown>;
  at: number;
}
```

- Socket.IO lo emite a todos los clientes.
- `TimeSeriesSink` escribe una fila en `events` con `kind='sim_event'`, `type='event'` y
  `label=eventId`.
- `LogStore` usa el nuevo tipo `event`.
- El panel mantiene su propio feed y además carga `recent` al abrirse.

## Frontend

- `useEvents`: GET inicial, suscripción a `event:triggered`, buffer de 50, métodos
  `setGenerator`, `patchEvent` y `trigger`.
- `EventPanel`: panel flotante no modal, anclado abajo a la derecha, `width` máxima 380 px,
  `max-height` 70dvh. Cabecera con estado del generador, botón de encendido, intervalo en
  segundos y cierre. Lista del catálogo con checkbox, probabilidad en porcentaje, cooldown y
  botón de disparo. Feed de últimos eventos con hora, origen, nodo y mensaje.
- Botón flotante con icono `joker` original: sonrisa ancha con dientes triangulares. `aria-label`
  y `aria-expanded`.
- En móvil, el panel pasa a hoja inferior de ancho completo y el botón sube por encima del
  `ReplayBar`.
- En replay el panel se abre en solo lectura: sin cambios de configuración ni disparos, con el
  banner existente.
- El panel vive dentro de `.scene-col` para no tapar el drawer y usa tokens de tema.

## Configuración

Nuevas variables:

| Variable | Defecto |
|---|---|
| `EVENTS_ENABLED` | `false` |
| `EVENTS_INTERVAL_MS` | `5000` |
| `EVENT_TASK_ARRIVAL_PROBABILITY` | `0.08` |
| `EVENT_THERMAL_SPIKE_PROBABILITY` | `0.02` |
| `EVENT_NODE_FAILURE_PROBABILITY` | `0.01` |
| `EVENT_NODE_RECOVERY_PROBABILITY` | `0.03` |
| `EVENT_FAN_FAILURE_PROBABILITY` | `0.01` |
| `EVENT_WORKLOAD_SURGE_PROBABILITY` | `0.02` |
| `EVENT_SYNTHETIC_ALERT_PROBABILITY` | `0.01` |

Los cooldowns no tienen env; se ajustan por API. El catálogo no se persiste.

## Tests

- `backend/test/events.test.ts` con RNG y reloj falsos:
  - catálogo completo y defaults;
  - generador apagado no dispara;
  - probabilidad 1 dispara y el cooldown bloquea la siguiente ventana;
  - disparo manual salta probabilidad, enabled y cooldown;
  - cada evento aplica su efecto (tareas, temperatura, estado, ventilador, carga, alerta);
  - target inválido y pool lleno devuelven `applied=false`;
  - `resetRuntime` limpia contadores;
  - integración con `SimulationEngine.step` y emisión de `event:triggered`.
- `backend/test/timeseries-sink.test.ts`: `event:triggered` genera fila `sim_event`.
- Frontend sin tests unitarios: `npm.cmd run lint`, `npm.cmd run build` y verificación
  Playwright con consola limpia en escritorio, móvil y replay.

## Riesgos y mitigaciones

- **Eventos aleatorios que rompen la demo:** el generador arranca apagado y las probabilidades
  son bajas; se apaga con un botón.
- **Pausa del motor:** al ir dentro del tick, no se dispara nada en pausa.
- **Pool lleno:** el evento devuelve `applied=false`, se registra y no lanza.
- **Nodo general:** las perturbaciones solo apuntan a workers.
- **Replay:** el panel queda en solo lectura.
- **Ruido en BD:** cada evento escribe una fila; el volumen es bajo por los cooldowns.

## Entrega

Tres commits, cada uno compila y pasa tests/lint:

1. `feat(backend): añade catálogo y motor de eventos de simulación`
2. `feat(frontend): añade panel flotante de eventos`
3. `docs: documenta el catálogo de eventos`

## Resoluciones de la revisión

Estas decisiones se tomaron al revisar el diseño y quedan cerradas:

- Selección de objetivo por elegibilidad (arriba), no uniforme sobre todos los workers.
- `node_failure` usa `forceFailure` y deja `stats.ok=false`; no toca tarea ni cola.
- `node_recovery` automático solo reactiva workers en `error`.
- `synthetic_alert` emite también el evento `alert` existente.
- El tráfico incluye los cinco tipos de tarea, incluido `cooldown`.
- `defaultParams` se expone en GET, no se edita por PATCH y se puede sobrescribir por disparo.
- Un disparo automático que pasa la tirada consume cooldown aunque `applied=false`.
- `applied` refleja un cambio real de estado o al menos una tarea encolada.

## Decisiones dejadas al implementador

- Nombres exactos de los helpers internos y forma de los tests.
- Textos definitivos de descripciones y mensajes.
- Ajuste fino de tamaños y espaciados del panel.
