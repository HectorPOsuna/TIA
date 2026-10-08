# WAItt - Pipeline analítico (S6)

Pipeline reproducible en Python para el monitoreo térmico de WAItt: preprocesa la
telemetría persistida en MariaDB, construye características, entrena un modelo de
predicción de temperatura, reporta métricas basales (MAE/RMSE) y detecta anomalías
cuyos avisos, opcionalmente, se explican con Ollama (qwen3) y se vuelcan a la tabla
`events` del simulador.

## Entorno

- Python 3.14, dependencias en `requirements.txt` (pandas, numpy, scikit-learn,
  pymysql, joblib, python-dotenv, pytest).
- Entorno virtual en `ml/.venv` (creado con `python -m venv .venv`). No se commitea.
- Los ajustes cargan el `.env` de la raíz (o el que apunte `ML_ENV_FILE`): `DB_*`,
  `OLLAMA_HOST`, `OLLAMA_MODEL` (default `qwen3:8b`), `OLLAMA_TIMEOUT_S`,
  `ML_HORIZON_MS` (15000), `ML_TEST_FRACTION` (0.2), `ML_THRESHOLD_SIGMA` (3.0),
  `ML_SEED` (42), `ML_TOP_K_ANOMALIES` (5).
- La BD debe tener telemetría (backend con `DB_ENABLED=true`): `docker compose up -d`
  y arrancar el backend unos minutos.
- Ollama es opcional: si no responde (`http://localhost:11434`), la explicación se
  omite con un warning y la alerta conserva solo el detalle numérico.

## Uso

```bash
cd ml
.\.venv\Scripts\python -m ml.train            # preprocesa, entrena y evalúa
.\.venv\Scripts\python -m ml.train --write-db # además inserta las alertas en events
.\.venv\Scripts\python -m ml.train --no-ollama
.\.venv\Scripts\python -m ml.predict --node node-1
.\.venv\Scripts\python -m pytest tests        # 10 tests
```

`train` genera en `ml/out/`:

- `model.joblib` — modelo serializado (GradientBoostingRegressor).
- `model.json` — metadatos: columnas, hiperparámetros, horizonte, umbral, métricas.
- `metrics.json` — MAE/RMSE globales y por nodo, baseline de persistencia, mejora, rechazo de anomalías.
- `alerts.jsonl` — alertas (formato de la tabla `events`) con `meta` JSON, incluida la explicación Ollama cuando existe.

También vuelca un snapshot de la telemetría usada en `ml/data/telemetry.csv`.

## Flujo del pipeline

1. **Export** (`export.py`): lee `telemetry` (ts, node_id, temperaturas, carga, estado, cola, pila) ordenado por nodo y timestamp.
2. **Features** (`features.py`): por nodo, lags de temperatura (t-1..t-8), delta, media/desviación móvil de 5, contexto (workload, fan, estado, cola, pila, setpoint, ambiente) y `rel_time_ms`. El **target es la temperatura horizonte ms en el futuro** (por defecto 15 s), calculada por `searchsorted`, así el horizonte es agnóstico a `TICK_MS`. Se descartan los `NaN` de la ventana de calentamiento y de la cola final.
3. **Split** (`model.py`): reparto **cronológico 80/20 por nodo** (sin mezclar tiempo), compatibiliza `temp_lag_1` como baseline de persistencia.
4. **Entrenamiento**: `GradientBoostingRegressor(seed=42)` sobre el tramo de entrenamiento.
5. **Métricas** (`metrics.py`): MAE/RMSE globales y por nodo en test; `mae_improvement_pct` = mejora relativa frente a la baseline.
6. **Anomalías** (`anomaly.py`): umbral `media + N·σ` de los residuos absolutos **de test** (σ por defecto 3.0); cada fila sobre el umbral genera una alerta.
7. **Explicación** (`ollama.py`): las N primeras alertas (`ML_TOP_K_ANOMALIES`) se explican con Ollama pidiendo JSON (`diagnostico`, `accion`), con la ventana de temperaturas recientes en el prompt. El fallo de Ollama no aborta el pipeline.
8. `--write-db`: las alertas se insertan en `events` (kind=`alert`, type=`ai`) con `meta` serializado como JSON.

## Notas y resultados

- El modelo térmico del simulador es muy suave: a un tick, "el último valor" (baseline)
  es casi perfecto y no hay nada que aprender. El pipeline predice a un **horizonte real
  de 15 s**, donde la baseline se degrada y el modelo aporta valor.
- Resultado de referencia (4 nodos, 1712 lecturas, horizonte 15 s): **MAE 0.078 °C**,
  **RMSE 0.087 °C** vs baseline MAE **0.301 °C** (~74 % de mejora).
- Con `ML_THRESHOLD_SIGMA=3` (por defecto) los datos nominales apenas generan alertas
  (0 en la muestra). Bajarlo (p. ej. `1.0`) captura la cola de residuos y demuestra el
  flujo completo: alertas, explicación Ollama y escritura en `events`.
- `ml/out/` y `ml/data/` están gitignoreados: el modelo y sus artefactos son regenerables
  con `ml.train`.