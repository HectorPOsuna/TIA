# Guía de Usuario — WAItt Simulador de Temperatura

WAItt es el acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**.

## Qué es WAItt

WAItt es un **simulador de monitoreo térmico**. En lugar de depender de sensores físicos, genera una simulación de servidores (nodos) que se calientan, se enfrían, encargan tareas y pueden entrar en estado de alerta. Sirve para explorar cómo se comportaría un sistema de monitoreo de temperatura real, sin necesidad de hardware.

La aplicación se compone de dos piezas que trabajan juntas:

- **Backend (el "cerebro")**: un servidor que sostiene la simulación, aplica el modelo térmico, procesa colas de tareas y evalúa reglas automáticas. Corre en `http://localhost:3000`.
- **Frontend (el "tablero")**: la interfaz web que abre en el navegador y muestra, en vivo, la temperatura de cada nodo, sus tareas, sus eventos y sus alertas. Corre en `http://localhost:5173`.

En este simulador, los "sensores" son simulados: cada nodo tiene una temperatura objetivo y una temperatura ambiente, y el tiempo que tarda en acercarse a su objetivo depende del modelo térmico interno.

## Requisitos previos

- **Node.js** (versión 20 o superior).
- **pnpm** para el backend: `npm install -g pnpm`.
- **npm** (incluido con Node.js) para el frontend.
- En Windows, los comandos se ejecutan con el sufijo `.cmd` (`pnpm.cmd`, `npm.cmd`).

## Cómo levantar la aplicación paso a paso

La aplicación necesita **dos ventanas de terminal**: una para el backend y otra para el frontend.

### 1. Backend

```bash
cd backend
pnpm.cmd install
pnpm.cmd dev
```

Al arrancar verás un mensaje similar a:

```
Backend WAItt escuchando en http://localhost:3000
```

Puedes comprobar que está vivo abriendo `http://localhost:3000/health` en el navegador. Debe responder algo como `{"status":"ok","running":true,...}`.

### 2. Frontend

En una **segunda ventana de terminal**:

```bash
cd frontend
npm.cmd install
npm.cmd run dev
```

Cuando termine, abre la dirección que indica el mensaje (habitualmente):

```
http://localhost:5173
```

Deberías ver el panel **WAItt · Simulador de temperatura** con una etiqueta verde "conectado" y el estado "en ejecución".

## La interfaz

### Cabecera

- **WAItt · Simulador de temperatura**: título del panel.
- Etiqueta de **conexión**: verde "conectado" si el frontend habla con el backend, roja "sin conexión" si el WebSocket cayó.
- Etiqueta de **estado**: "en ejecución" o "pausado".
- Botones **Pausar/Reanudar** y **Reset**:
  - **Pausar**: detiene el avance de la simulación (las temperaturas se congelan).
  - **Reset**: reinicia el sistema a su estado inicial (temperaturas, colas, eventos y contadores de reglas).

### Resumen del sistema

Una fila muestra: número de **nodos** totales, cuántos están **activos**, **inactivos**, **en error**, la **temperatura media**, y una caja "**Objetivo global (°C)**" con su botón **Aplicar**.

### Tarjeta de cada nodo

Cada nodo (el **Servidor General** y los trabajadores `Servidor 1`, `Servidor 2`, …) se muestra en una tarjeta con:

- **Nombre** y estado: `active` (activo), `inactive` (inactivo) o `error`.
- **Temperatura actual** en grados; junto al número aparece un icono de ventilador (💨) si el ventilador está encendido.
- **Objetivo**, **ambiente** y **carga de trabajo** actuales.
- **Cola de tareas**: tamaño usado frente a capacidad (`X/Y`) y, si hay una tarea en curso, el tipo que se está procesando (por ejemplo `processing: cooldown`).
- **Eventos de la pila**: el número de eventos registrados recientemente en el nodo.
- Botones de acción: **−5°C** / **+5°C** (ajustan el objetivo de ese nodo), **Ventilador on/off** y **Encolar** (añade una tarea de enfriamiento a la cola del nodo).

### Reglas reactivas

La sección **Reglas reactivas** lista las reglas automáticas cargadas. Cada regla indica: nombre, a qué nodos afecta (`any`, `all`, `system`, `node`), la condición (`metric op value`, por ejemplo `temperature > 55`) y la acción que ejecuta. También muestra cuántas veces se ha disparado y si está **activa** o **desactivada**.

Desde la interfaz puedes:
- **Activar/Desactivar** una regla (se aplica en vivo, sin reiniciar).
- **Eliminar** una regla con el botón **✕**.

La lista de **Disparos recientes** muestra las últimas reglas que se activaron y sobre qué nodos.

### Alertas

La sección **Alertas** muestra los últimos avisos importantes (hasta 20). Cada alerta indica la hora, el nodo afectado y el mensaje (por ejemplo, una temperatura crítica).

## Cómo modificar la temperatura

- **De un nodo en concreto**: usa los botones **−5°C** / **+5°C** de su tarjeta. El nodo se acercará gradualmente al nuevo objetivo (no salta al instante).
- **De todo el sistema**: escribe un valor en "Objetivo global (°C)" y pulsa **Aplicar**. Esto actualiza el objetivo de todos los nodos a la vez.
- La **temperatura ambiente** no se modifica desde la interfaz; se configura en el backend (ver `AMBIENT_TEMP` en la guía técnica).

## Cómo encolar tareas y leer su progreso

Pulsa **Encolar** en un nodo. Se añade una tarea de enfriamiento (`cooldown`) con una duración estimada de 8 segundos a la **cola FIFO** de ese nodo (FIFO = primero en entrar, primero en salir).

La cola tiene tres estados de tarea:

| Estado | Significado |
|---|---|
| `pending` | En la cola, esperando turno |
| `processing` | En curso: se muestra como "procesando: cooldown" en la tarjeta |
| `completed` | Terminada; sale de la cola y queda reflejada en el log de eventos |

Cada nodo solo procesa **una tarea a la vez**; el resto espera en la cola. Si la cola está llena, la asignación se rechaza.

## Cómo crear y editar reglas reactivas

Las reglas se cargan al arrancar desde `backend/data/default-rules.json`. La interfaz permite **activar, desactivar o eliminar** reglas; **crear o editar** reglas se hace por API (más detalles y ejemplos en la [guía técnica](guia-tecnica.md)):

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"Ventilador a 50°C","metric":"temperature","op":">","value":50,"action":"fan_on","actionParams":{"minutes":1}}'
```

Los cambios se aplican en vivo, sin reiniciar nada. Para que sean permanentes, añade la regla también a `backend/data/default-rules.json` (y reinicia el backend).

> **Nota**: una regla tiene un "enfriamiento" (`cooldownMs`) para no dispararse repetidamente; si la condición sigue cumpliéndose, esperará ese intervalo antes de volver a actuar.

## Cómo interpretar el log de eventos

Cada acción relevante queda registrada en el buffer de logs del backend (se consulta con `GET /api/logs`). Ejemplos de entradas que verás:

- `Simulación iniciada (tick cada 1000 ms)` — arranque del motor.
- `Simulación en pausa` / `Simulación reanudada` — cambios de estado.
- `Tarea encolada (cooldown) en node-1` / `Tarea completada: ... en node-1` — vida de las tareas.
- `Regla "Ventilador por temperatura alta" disparada en node-1 → acción fan_on` — reglas ejecutadas.
- `Ventilador activado en node-1` / `Nodo node-1 apagado` — efectos de las acciones.

Los niveles son `info` (informativo), `warning` (aviso) y `critical` (crítico; las alertas por `send_alert` se registran como `critical`). También hay mensajes en el panel **Alertas** del frontend cuando una regla de alerta se dispara.

## Preguntas frecuentes (FAQ)

1. **¿La temperatura cambia de golpe al pulsar +5°C?** No. El modelo térmico hace que el nodo se acerque gradualmente al objetivo; tarda unos segundos en estabilizarse (cada tick, ~1 segundo, recalcula la temperatura).

2. **¿Qué significa que un nodo esté "en error"?** Es un estado simulado: un contador de fallos consecutivos supera un umbral (`MAX_CONSECUTIVE_FAILURES`, por defecto 5). No corresponde a hardware real.

3. **¿Por qué veo poco movimiento en la temperatura media?** Debajo de la media cada nodo oscila alrededor de su objetivo según su carga de trabajo; la media sobre todos los nodos varía lentamente a propósito.

4. **¿El ventilador consume algo?** El ventilador acelera la disipación del calor (el modelo enfría más rápido). Se puede activar manualmente y, según la regla configurada, también automáticamente; se apaga solo tras el tiempo indicado.

5. **¿Puedo encolar más de una tarea a la vez?** Sí, todas menos una esperan en la cola FIFO. Si saturas la cola, las siguientes asignaciones se rechazan.

6. **¿Reiniciar borra las reglas que creé por API?** No. Reset restaura nodos, tareas y contadores; las reglas añadidas por API siguen existiendo hasta que se eliminen o reinicie el backend.

## Solución de problemas

### Error de CORS

**Síntoma**: la interfaz carga pero las consultas al backend fallan con errores de CORS en la consola del navegador.

**Causa**: el backend solo acepta orígenes autorizados. El valor por defecto es `http://localhost:5173`.

**Solución**: en `backend/.env` asegúrate de que `CORS_ORIGIN` coincide con la URL exacta del frontend (incluido el puerto). Luego reinicia el backend.

### Puerto ocupado

**Síntoma**: al lanzar el backend, aparece un error `EADDRINUSE` o el mensaje de "puerto en uso".

**Causa**: otro proceso (u otra instancia) ocupa el puerto `3000` (o el `5173` del frontend).

**Solución**: cambia el puerto en `backend/.env` (`PORT=3001`) o cierra el proceso anterior. Verifica con:

```powershell
netstat -ano | findstr :3000
```

### WebSocket caído (sin conexión)

**Síntoma**: el panel muestra "sin conexión" en rojo y los datos no se actualizan en vivo.

**Causa**: la conexión WebSocket entre el frontend y el backend no pudo establecerse (backend apagado, proxy roto o cambio de puerto).

**Solución**:
1. Confirma que el backend sigue corriendo (`http://localhost:3000/health`).
2. Si cambiaste el puerto del backend, actualiza también el proxy en `frontend/vite.config.js`.
3. Cuando el backend vuelva, el frontend se reconecta automáticamente.

### El panel está vacío o "sin reglas"

**Síntoma**: no aparecen nodos ni reglas.

**Causa**: normalmente el backend no arrancó o `data/default-rules.json` no existe/está vacío.

**Solución**: revisa la terminal del backend; confirma que el archivo de reglas está en `backend/data/` y reinicia. El estado inicial crea `INITIAL_NODES` trabajadores + 1 nodo general.