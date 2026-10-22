# WAItt - Simulador de Temperatura

WAItt es el acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**.

Simulador de monitorización térmica que replica el comportamiento del antiguo sistema de firmware Arduino con sensores DS18B20: modelo térmico, nodos (general + trabajadores) con estados y fallos, colas de prioridad de tareas con pool global, pila LIFO de eventos y reglas reactivas que se pueden editar en caliente.

## Composición

| Componente | Tecnología | Carpeta |
|---|---|---|
| Backend (simulador) | Node.js/TypeScript, Express + Socket.IO | `backend/` |
| Frontend (panel) | React (Vite) | `frontend/` |
| Pipeline analítico (IA) | Python (pandas, scikit-learn, Ollama) | `ml/` |

No hay hardware ni código Arduino: el GitHub Actions / histórico lo conserva, pero el árbol actual es 100 % simulado.

## Backend

Ver [backend/README.md](backend/README.md) para API REST, eventos WebSocket, modelo térmico, reglas e integración con el frontend.

```bash
cd backend
pnpm.cmd install
pnpm.cmd dev        # http://localhost:3000
pnpm.cmd run test   # 76 tests vitest
pnpm.cmd run build
```

### Inferencia IA en vivo (S7)

Con el modelo entrenado en `ml/out/`, el backend sirve inferencias en tiempo real **en el mismo
proceso Node**: al arrancar lanza un worker Python persistente (`python -m ml.worker`, JSON por
stdin/stdout) y, en cada `state:update`, mantiene una ventana deslizante por nodo y pide la
predicción a 15 s. La auto-inferencia está siempre activa y cada resultado se emite por el
`EventBus` (`inference:completed`), se guarda en `inferences` y deja una fila `kind=inference` en
`events`. El modelo se versiona por `sha256` del `model.joblib` y se registra en el log al arrancar.

```bash
curl -X POST localhost:3000/api/inference/predict -H "Content-Type: application/json" \
  -d "{\"nodeId\":\"node-1\"}"          # o {"nodes":["node-1","node-2"]}
curl localhost:3000/api/inference/version
```

Se configura con `INFERENCE_*` en `backend/.env` (`INFERENCE_ENABLED`, `INFERENCE_HORIZON_MS`,
`INFERENCE_THROTTLE_MS`, `INFERENCE_PYTHON`). El frontend la consume en el panel **Modelo IA** y en
la predicción del nodo seleccionado.

### Control automático de IA (S8)

El modelo sigue siendo un regresor, pero el backend añade una **política determinista** que consume
sus predicciones y ejecuta acciones reales sobre los workers. Está **desactivada por defecto** y se
activa con el interruptor del panel **Control IA** o con `PATCH /api/ai/control`:

- **Caliente** (`predicha > objetivo + 1.5 °C`): ventilador, reducción de carga, tarea `cooldown`,
  ajuste temporal del objetivo (máx. ±1.5 °C) y apagado de emergencia opcional.
- **Frío** (`predicha < objetivo − 1.5 °C`): apaga el ventilador si lo encendió la IA, sube carga,
  encola una tarea de mantenimiento y ajusta el objetivo hacia arriba.
- **Neutral**: restaura el objetivo y apaga el ventilador de la IA.

Guardarraíles: 2 predicciones de confirmación, cooldown de 5 s, máximo 20 acciones/minuto, límites
de carga, solo workers (el general es un agregado) y pausa automática si se detecta un cambio manual.
Cada acción se emite como `ai:action`, se registra con tipo `ai` y se persiste en `events`
(`kind=ai_action`). El apagado de emergencia está desactivado por defecto (`AI_CONTROL_ALLOW_SHUTDOWN`).
Al desactivar el control se liberan el offset, el ventilador y los apagados que había aplicado la IA.

Cambios asociados del simulador: las tareas `cooldown` **restan calor** mientras se procesan, los
nodos apagados **disipan hacia el ambiente**, y `set_workload` permite fijar la carga. La telemetría
expone `task_heat` para que el modelo aprenda el efecto térmico de cada tarea. Configuración en
`AI_CONTROL_*` (ver `backend/.env.example`).

## Base de datos (BD time-series)

El backend puede persistir la telemetría y los eventos de la simulación en MariaDB/MySQL
(tablas `telemetry` y `events`, ver [docs/guia-tecnica.md](docs/guia-tecnica.md)). Con Docker:

```bash
docker compose up -d     # MariaDB (localhost:3306) + phpMyAdmin (http://localhost:8080)
```

Credenciales de desarrollo: BD/usuario `waitt`/`waitt` (root: `root`). El escritor se activa
con `DB_ENABLED=true` (por defecto) y escribe por lotes; si la BD no responde, solo se loguea
y la simulación continúa. `DB_ENABLED=false` desactiva la conexión por completo.

## Pipeline analítico (IA)

`ml/` es un pipeline reproducible en Python que preprocesa la telemetría, hace feature
engineering, entrena un modelo de regresión de temperatura (GradientBoostingRegressor),
calcula métricas basales (MAE/RMSE frente a una baseline de persistencia), detecta
anomalías por residuo de predicción y redacta avisos con Ollama (qwen3). Ver
[ml/README.md](ml/README.md).

```bash
cd ml
.\.venv\Scripts\python -m ml.train            # entrena y genera ml/out/ (sin tocar la BD)
.\.venv\Scripts\python -m ml.train --write-db # además inserta las alertas en la tabla events
.\.venv\Scripts\python -m ml.train --since 2026-10-22T00:00:00Z  # solo telemetría reciente
.\.venv\Scripts\python -m ml.predict --node node-1
.\.venv\Scripts\python -m pytest tests        # 18 tests
```

Resultado de referencia de la sesión de reentrenamiento con la nueva dinámica (horizonte 15 s,
4 nodos, 3892 lecturas): MAE 0.231 °C y RMSE 0.403 °C. El tramo final es estacionario y la
baseline de persistencia es casi perfecta (MAE 0.002 °C); en tramos con transiciones de
apagado/encendido o cambios de objetivo el MAE sube a ~1 °C. `task_heat` y `status` permiten
al modelo representar el enfriamiento por tareas y los nodos inactivos.

## Frontend

Dashboard de control con **vista cenital 3D** (Three.js + React Three Fiber) sobre una rejilla
automática: cada nodo es una cabina extruida cuyo color y altura reflejan su temperatura respecto
al objetivo; al hacer clic abre el panel de controles en la barra lateral (objetivo ±5°, ventilador,
encolar tarea, tendencia, cola y pila LIFO). La barra lateral agrupa, en secciones colapsables, el
nodo seleccionado, el **modelo IA** (versión, horizonte, predicción por nodo a 15 s y recomendación
estable/enfriar/subir carga), el **control IA** (interruptor, acciones permitidas y feed de decisiones),
la **eficiencia** (nodos en banda ±2 °C, desvío medio, sesión en banda, ventiladores, carga y pool, con
sparklines de la sesión), la cola global (pool), las reglas reactivas (con sus últimos disparos) y las
alertas. Los últimos **600 estados** de la sesión se guardan en el navegador y permiten **replay** del
mapa térmico con línea de tiempo y reproducción automática.

```bash
cd frontend
npm.cmd install
npm.cmd run dev     # Vite con proxy a /api y /socket.io -> localhost:3000
```

## Qué se eliminó

En `0ad1655` se eliminó por completo el firmware Arduino (PlatformIO): `TIA.ino`, `src/`, `include/`, `test/`, `platformio.ini`, `sensors/`, `utils/`, `config.h`. El simulador backend replica su lógica (modelo térmico, estados de nodo, manejo de lecturas fallidas) sin hardware.