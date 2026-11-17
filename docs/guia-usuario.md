# Guía de Usuario — WAItt Simulador de Temperatura

WAItt es el acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**.

## Qué es WAItt

WAItt es un **simulador de monitoreo térmico**. En lugar de depender de sensores físicos, genera servidores simulados (nodos) que se calientan, se enfrían, reciben tareas y pueden entrar en alerta. Sirve para explorar cómo se comportaría un sistema de monitoreo real sin hardware.

La aplicación tiene dos piezas:

- **Backend (el cerebro)**: sostiene la simulación, aplica el modelo térmico, procesa colas, evalúa reglas, sirve la API y habla por WebSocket.
- **Frontend (el tablero)**: la interfaz web que muestra la escena 3D, el estado de los nodos, las reglas, la IA, los eventos y el replay.

Opcionalmente hay una **base de datos** para guardar telemetría y un **modelo de IA** para predecir temperatura.

## Requisitos

| Herramienta | Uso |
|---|---|
| Node.js 20 o superior | Backend y frontend |
| pnpm | Backend |
| npm | Frontend |
| Docker Desktop | Opcional, para MariaDB + phpMyAdmin |
| Python 3.14 + `ml/.venv` | Opcional, para inferencia y entrenamiento |
| Ollama | Opcional, para explicar anomalías |

En Windows, los shims `pnpm`/`npm` de PowerShell pueden estar bloqueados por la policy de ejecución. Usa siempre `pnpm.cmd` y `npm.cmd`.

## Arranque rápido

### 1. Backend

```powershell
cd backend
pnpm.cmd install
pnpm.cmd dev
```

Debe aparecer:

```text
Backend WAItt escuchando en http://localhost:3000 (CORS: http://localhost:5173)
Simulación iniciada (tick cada 1000 ms)
```

### 2. Frontend

En otra terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abre **http://localhost:5173**.

### 3. Base de datos (opcional)

```powershell
docker compose up -d
```

Levanta MariaDB en `localhost:3306` y phpMyAdmin en `http://localhost:8080`. El backend escribe telemetría si `DB_ENABLED=true`. Si la BD no está, el simulador sigue funcionando y solo registra el error.

### 4. Modelo de IA (opcional)

El backend busca `ml/out/model.joblib`. Si no existe, no llegan predicciones y la sección de IA se queda en «Esperando inferencias»; el resto sigue funcionando.

Para entrenar:

```powershell
ml\.venv\Scripts\python -m ml.train
```

Necesita telemetría en la BD. Deja el backend corriendo unos minutos con `DB_ENABLED=true`.

## Puertos: la regla que evita el error `ECONNREFUSED`

El backend escucha en `PORT`. El proxy de Vite debe apuntar al **mismo puerto**.

| Pieza | Default | Ejemplo con 3001 |
|---|---|---|
| Backend | `3000` | `$env:PORT='3001'; pnpm.cmd dev` |
| Proxy Vite | `http://localhost:3000` | `http://localhost:3001` |
| CORS | `http://localhost:5173` | `http://localhost:5173` |
| Frontend | `5173` | `5173` |

Si ves en la terminal de Vite:

```text
[vite] http proxy error: /api/system
AggregateError [ECONNREFUSED]
```

el proxy apunta a un puerto donde no hay backend. Revisa `frontend/vite.config.js`:

```js
'/api': 'http://localhost:3001',
'/socket.io': { target: 'http://localhost:3001', ws: true },
```

Y arranca el backend con el mismo puerto:

```powershell
cd backend
$env:PORT='3001'; pnpm.cmd dev
```

No mezcles: backend en 3000 y proxy en 3001 produce `ECONNREFUSED`; backend en 3001 y `CORS_ORIGIN` en otro puerto produce error de CORS.

## La interfaz

Esquema general (no es pixel-perfect):

```text
┌──────────────────────────────────────────────────────────────────────┐
│ WAItt control   ● en vivo   media 31.2°  activos 3/3  errores 0     │
│ [IA off]  objetivo [30.0] fijar  [tema] [pausa] [alertas] [Panel]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        ESCENA 3D CENITAL                             │
│                                                                      │
│          ┌────────┐      ┌────────┐      ┌────────┐                 │
│          │ node-1 │      │ node-2 │      │ node-3 │                 │
│          │ 31.2°  │      │ 30.8°  │      │ 29.9°  │                 │
│          └────────┘      └────────┘      └────────┘                 │
│                                                                      │
│   [leyenda]                         [replay ──────●─────]           │
│                                                                      │
│   ┌ Nodos ──────────────┐                              [eventos]   │
│   │ ● node-1  31.2°     │                                           │
│   │ ● node-2  30.8°     │                                           │
│   │ ● node-3  29.9°     │                                           │
│   └─────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### HUD superior

- **WAItt control**: marca.
- **● en vivo / sin conexión / histórico**: estado de la conexión o del replay.
- **media**: temperatura media de los workers.
- **activos**: workers activos sobre el total.
- **errores**: workers en estado `error`.
- **IA off / IA auto / IA n/a**: estado del control IA.
- **objetivo + fijar**: cambia el objetivo global.
- **tema**: alterna claro/oscuro.
- **pausa/reanudar**: congela o reanuda el tick.
- **alertas**: abre la pestaña de alertas.
- **Panel**: abre el centro de control.

### Escena 3D

Cada nodo es un **rack de servidor**. La altura, el panel frontal, la tira LED y el halo cambian con la temperatura.

| Estado | Aspecto |
|---|---|
| Activo | Color térmico normal |
| Inactivo | Gris y semitransparente |
| Error | Rojo con pulso |
| Ventilador encendido | Disco cian giratorio |
| Seleccionado | Anillo cian y etiqueta visible |

La etiqueta 3D muestra temperatura, ventilador, cola y pila. Haz clic en un rack para abrir su detalle.

### Dock de nodos

Lista lateral con todos los nodos. Se navega con las flechas, `Home` y `End`. Al seleccionar uno se abre el drawer.

### Drawer del nodo

```text
┌──────────────────────────────────────────────┐
│ NODE-1 · worker                    [activo]  │
│ 31.20 °C                                     │
│ objetivo 30.0°C · ambiente 20.0°C            │
│ [ -5° ] [ +5° ] [ Ventilador on ]            │
│                                              │
│ carga 0.30   cola 2/50   pila 5   fallos 0   │
│                                              │
│ Modelo IA · +15 s            [estable]       │
│ 30.80 °C previstos                           │
│ Δ vs actual -0.40 °C · latencia 8 ms         │
│                                              │
│ Cola del nodo                                │
│  cooldown   p4 · 5s                          │
│  custom     p2 · 3s                          │
│                                              │
│ Pila LIFO (última arriba)                    │
│  change  Ventilador activado                 │
│  event   Tarea encolada                      │
│                                              │
│ prioridad [3] demanda [2] duración [5]       │
│ [ Encolar tarea ]                            │
│                                              │
│ Tendencia (sesión)  ────────────────         │
└──────────────────────────────────────────────┘
```

En replay, el drawer oculta los botones de edición y el formulario.

### Centro de control

Es un diálogo con cuatro pestañas:

| Pestaña | Contenido |
|---|---|
| **IA** | Modelo, versión, horizonte, predicción por nodo, recomendación y control IA |
| **Automatización** | Reglas reactivas, últimos disparos y cola global |
| **Sistema** | Eficiencia, sparklines y reinicio de la simulación |
| **Alertas** | Últimas alertas de la sesión |

En replay, todo el centro de control queda en solo lectura.

### Panel de eventos

El botón flotante con la sonrisa de un bufón abre el panel:

```text
┌──────────────────────────────────────────────┐
│ Eventos                              [cerrar]│
│ [auto/off] Generador activo cada 5 s         │
│ [ Detener ]  Intervalo (s) [5]               │
│                                              │
│ Catálogo                                     │
│  [x] Llegada de tareas       [tráfico]       │
│      Prob. % [8]  Cooldown (s) [3] [Disparar]│
│  [x] Pico térmico        [perturbación]      │
│      Prob. % [2]  Cooldown (s) [15] [Disparar]│
│  ...                                         │
│                                              │
│ Últimos eventos                              │
│  11:42:03  auto  Pico térmico  node-1        │
│  temperatura de node-1 ajustada a 35C        │
└──────────────────────────────────────────────┘
```

### Replay

La barra inferior guarda los últimos **600 estados** de la sesión:

- **Línea de tiempo**: arrastra para revisar un instante.
- **Play**: reproduce automáticamente cada 600 ms.
- **Paso**: avanza o retrocede un estado.
- **Vivo**: vuelve a la simulación en tiempo real.

Durante el replay, el HUD muestra **histórico**, la escena y el drawer son de solo lectura y la configuración está deshabilitada.

### Tema

El botón sol/luna cambia entre modo claro y oscuro. La preferencia se guarda en `localStorage` (`waitt-theme`) y se aplica antes del primer pintado.

## Primeros pasos

1. Arranca backend y frontend.
2. Abre `http://localhost:5173`.
3. Espera a que la escena muestre los nodos.
4. Selecciona `node-1` en el dock o en la escena.
5. Pulsa **+5°** y observa cómo la temperatura sube gradualmente.
6. Encola una tarea en la cola local.
7. Abre **Panel → Automatización** y revisa las reglas.
8. Activa el generador de eventos y dispara un **Pico térmico**.
9. Abre **Panel → IA** y activa el control IA.
10. Usa el replay para revisar lo ocurrido.

## Nodos y estados

| Estado | Significado |
|---|---|
| `active` | El nodo procesa tareas y converge a su objetivo |
| `inactive` | Está apagado; disipa hacia el ambiente |
| `error` | Superó `MAX_CONSECUTIVE_FAILURES` fallos simulados |

El **Servidor General** es un agregado: no se controla con IA ni admite perturbaciones, pero puede procesar tareas encoladas por API o por reglas `system`.

## Cómo modificar la temperatura

- **Nodo concreto**: selecciónalo y usa **−5°** / **+5°** en el drawer.
- **Todo el sistema**: escribe el objetivo en el HUD y pulsa **fijar**.
- **Temperatura ambiente**: no se edita desde la UI; se configura con `AMBIENT_TEMP` o `PATCH /api/system`.

El cambio no es instantáneo. El modelo térmico tiene inercia: el nodo tarda unos segundos en acercarse al nuevo objetivo.

## Tareas

Hay dos formas de encolar:

1. **Cola local del nodo**: formulario **Encolar tarea** del drawer. Crea tareas `cooldown`.
2. **Pool global**: **Panel → Automatización → Cola global**. Crea tareas `custom`.

Para `maintenance`, `reboot`, `calibration` u otros tipos, usa la API (`POST /api/nodes/:id/queue` o `POST /api/tasks`).

Parámetros:

| Parámetro | Rango | Significado |
|---|---|---|
| `priority` | 1–5 | Urgencia; 5 se procesa antes |
| `computeDemand` | 1–5 | Calor extra mientras se ejecuta (`demanda × 0.07`) |
| `durationSecs` | 1–10 | Duración en segundos |

Cada nodo procesa **una tarea a la vez**. Las tareas del pool se asignan al **worker activo libre más frío**; si no hay ninguno, esperan. Las tareas `cooldown` **restan calor** en lugar de sumarlo.

Estados de una tarea:

| Estado | Significado |
|---|---|
| `pending` | En cola o en el pool |
| `processing` | En ejecución |
| `completed` | Terminada |

Si la cola local o el pool están llenos, la tarea se rechaza con `409`.

## Reglas reactivas

Las reglas se cargan al arrancar desde `backend/data/default-rules.json`. La UI permite **activar, desactivar y eliminar**; crear o editar se hace por API.

Cada regla tiene:

- **Sujeto**: `any` (algún worker), `all` (todos), `system` (general) o `node` (un nodo).
- **Condición**: `metric op value`, por ejemplo `temperature > 55` o `predictedDelta > 1.5`.
- **Acción**: ventilador, apagado, encendido, tarea, alerta, carga u objetivo.
- **Cooldown**: tiempo mínimo entre disparos.

Métricas disponibles: `temperature`, `temperatureDelta`, `predictedTemperature`, `predictedDelta`, `workload`, `status`, `queueLength`, `stackLength`.

Las métricas predictivas usan la última inferencia del nodo (válida 60 s). Permiten actuar **antes** de que la temperatura suba. La regla semilla «Ventilador por predicción alta» enciende el ventilador cuando `predictedDelta > 1.5`.

Ejemplo por API:

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"Ventilador a 50°C","metric":"temperature","op":">","value":50,"action":"fan_on","actionParams":{"minutes":1}}'
```

Los cambios se aplican en vivo. Para que sobrevivan a un reinicio, añade la regla a `backend/data/default-rules.json`.

## Control IA

El control IA está **desactivado por defecto**. Se activa en **Panel → IA → Activar IA**; el botón IA del HUD abre esa pestaña.

La política consume las predicciones y actúa sobre los workers:

- **Caliente** (predicción por encima del objetivo): enciende el ventilador, reduce carga, encola una tarea `cooldown` y baja temporalmente el objetivo efectivo (máx. ±1.5 °C).
- **Frío** (predicción por debajo): apaga el ventilador si lo encendió la IA, sube carga, encola una tarea de mantenimiento y sube el objetivo efectivo.
- **En banda**: restaura el objetivo efectivo y apaga el ventilador de la IA.

Guardarraíles:

- Solo workers; el general no se controla.
- 2 predicciones consecutivas para confirmar.
- Cooldown de 5 s por nodo.
- Máximo 20 acciones por minuto.
- Pausa de 30 s si detecta un cambio manual.
- Apagado de emergencia desactivado por defecto.

El objetivo del usuario (`targetTemp`) no se modifica. El ajuste de la IA se ve como `aiTargetOffset` en el drawer. Al **Detener IA**, se liberan offset, ventilador y apagados aplicados por la IA.

## Eventos de simulación

El panel de eventos permite:

- **Activar/Detener** el generador automático.
- Ajustar el **intervalo** de evaluación.
- Activar o desactivar cada evento.
- Ajustar **probabilidad** y **cooldown**.
- **Disparar** un evento a mano.

El generador arranca **apagado** (`EVENTS_ENABLED=false`). El catálogo vive en memoria: reiniciar restablece los valores.

| Evento | Efecto |
|---|---|
| Llegada de tareas | Encola 1–3 tareas en el pool o en un nodo |
| Pico térmico | Suma temperatura a un worker |
| Fallo de nodo | Fuerza estado `error` |
| Recuperación de nodo | Devuelve a `active` |
| Fallo de ventilador | Apaga el ventilador |
| Pico de carga | Sube la carga |
| Alerta sintética | Emite una alerta |

El disparo manual salta probabilidad y cooldown. El automático solo elige workers elegibles. Las perturbaciones no se aplican al Servidor General.

## Alertas y toasts

Las alertas aparecen en **Panel → Alertas** y como **toasts** en la esquina. Se generan por la acción `send_alert`, por una alerta sintética o por una regla. Se conservan las últimas 20 en el cliente.

## Logs y base de datos

El backend guarda un log acotado en `backend/data/logs.jsonl`. Se consulta con `GET /api/logs` y se vacía con `DELETE /api/logs`.

Con `DB_ENABLED=true`, la telemetría, los eventos, las reglas, las acciones de IA y las inferencias se guardan en MariaDB. Tablas principales:

- `telemetry`: temperatura y estado por nodo y tick.
- `events`: reglas, tareas, alertas, eventos, IA e inferencias.
- `inferences`: predicción, valor real, latencia y versión del modelo.

## Preguntas frecuentes

**¿La temperatura cambia de golpe al pulsar +5°?** No. El modelo térmico tiene inercia; tarda unos segundos.

**¿Qué significa que un nodo esté en error?** Es un estado simulado por fallos consecutivos. No hay hardware real.

**¿Por qué la temperatura media se mueve poco?** Cada nodo oscila alrededor de su objetivo; la media de todos cambia lentamente a propósito.

**¿El ventilador consume algo?** Acelera la disipación (multiplica por 3). Se apaga solo si tiene `fanUntilMs`.

**¿Puedo encolar varias tareas?** Sí. Una se procesa y el resto espera en la cola local o en el pool.

**¿Cómo se elige la tarea del pool?** La de mayor prioridad; a igualdad, la más antigua. Se asigna al worker activo libre más frío.

**¿Reiniciar borra las reglas creadas por API?** Reset no las borra; reiniciar el backend sí, porque la semilla es de solo lectura.

**¿Por qué la IA no actúa?** Revisa que esté activada, que haya predicciones frescas, que el nodo no esté en error y que no haya una pausa manual o cooldown.

**¿Por qué no veo el modelo IA?** Falta `ml/out/model.joblib` o `INFERENCE_ENABLED=false`.

## Solución de problemas

### `ECONNREFUSED` en la terminal de Vite

**Síntoma**: Vite llena la terminal con `http proxy error` y `AggregateError [ECONNREFUSED]`.

**Causa**: el proxy apunta a un puerto sin backend.

**Solución**: iguala `PORT`, el target de `vite.config.js` y `CORS_ORIGIN`. Ejemplo con 3001:

```powershell
cd backend
$env:PORT='3001'; pnpm.cmd dev
```

```js
// frontend/vite.config.js
'/api': 'http://localhost:3001',
'/socket.io': { target: 'http://localhost:3001', ws: true },
```

### Error de CORS

**Síntoma**: la interfaz carga pero las peticiones fallan con CORS.

**Causa**: `CORS_ORIGIN` no coincide con el origen del frontend.

**Solución**: pon `CORS_ORIGIN=http://localhost:5173` y reinicia el backend.

### Puerto ocupado

**Síntoma**: `EADDRINUSE`.

**Solución**:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Cierra el proceso o cambia `PORT` y el proxy.

### Panel sin conexión

**Síntoma**: el HUD muestra **sin conexión** y los datos no se actualizan.

**Causa**: backend apagado, proxy roto o puerto cambiado.

**Solución**:

1. Comprueba `http://localhost:3000/health`.
2. Revisa el target del proxy.
3. Espera la reconexión automática de Socket.IO.

### La BD no guarda nada

**Síntoma**: las tablas están vacías.

**Causa**: MariaDB no está levantada o `DB_ENABLED=false`.

**Solución**:

```powershell
docker compose up -d
```

Revisa el log del backend. Si la BD falla, la simulación sigue.

### No hay predicciones

**Síntoma**: `IA n/a` o `503` en `/api/inference/version`.

**Causa**: falta el modelo, el worker Python no arranca o `INFERENCE_ENABLED=false`.

**Solución**:

```powershell
ml\.venv\Scripts\python -m ml.train
```

Comprueba que exista `ml/out/model.joblib` y que `INFERENCE_PYTHON` apunte al intérprete correcto.

### El replay no me deja editar

Es intencional. Vuelve a **Vivo** para editar.

### El generador de eventos no hace nada

Está apagado por defecto. Actívalo en el panel. Revisa también la probabilidad y el cooldown de cada evento.

## Para profundizar

- [Guía Técnica](guia-tecnica.md): arquitectura, API, BD, IA y ML.
- [Guía Junior](guia-junior.md): recorrido guiado, diagramas y ejercicios.
- [Pruebas y calibración](pruebas-calibracion.md): resultados y límites.
