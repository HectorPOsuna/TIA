# Pruebas, calibración y tolerancia a fallos (S10)

Documento de evidencia de la etapa S10: qué se probó, con qué criterios, qué resultados se obtuvieron y qué límites quedan.

## Entorno de ejecución

| Elemento | Valor |
|---|---|
| Sistema | Windows, Node.js v24.21.0 |
| CPU | 13th Gen Intel Core i5-13450HX |
| Memoria | 32 GB |
| Backend | pnpm 12.4.1, vitest 2.1.9 |
| Frontend | npm, `node --test` |
| ML | Python 3.14.7, pytest 9.1.1 |

Los números de rendimiento son de esta máquina. En otro hardware cambian; el criterio de aceptación no.

## Comandos de verificación

```powershell
cd backend
pnpm.cmd run typecheck
pnpm.cmd run test
pnpm.cmd run build

cd ../frontend
npm.cmd test
npm.cmd run build
npm.cmd run lint

cd ..
ml\.venv\Scripts\python -m pytest ml
```

## 1. Pruebas de estrés

Archivo: `backend/test/stress.test.ts`.

Metodología: motor de simulación con `stepOnce()` y `dt` fijo de 1000 ms. Se miden 1000 ticks por tamaño de nodo. Cada caso se repite tres veces y se reporta la mediana. El presupuesto es p95 < 500 ms, la mitad del `TICK_MS` por defecto (1000 ms).

| Nodos | Media (ms) | p95 (ms) | Máximo (ms) | RSS delta (MB) |
|---:|---:|---:|---:|---:|
| 10 | 0.02 | 0.03 | 0.70 | -0.1 |
| 50 | 0.03 | 0.04 | 0.47 | -0.4 |
| 100 | 0.05 | 0.08 | 0.44 | 0.2 |
| 200 | 0.09 | 0.13 | 0.80 | 0.1 |

Resultado: 200 nodos quedan muy por debajo del presupuesto. El delta de RSS es ruido de medición, no una fuga detectable en 1000 ticks.

Otros escenarios del mismo archivo:

| Escenario | Criterio | Resultado |
|---|---|---|
| Cola local de capacidad 10 con 100 tareas | Acepta 10, rechaza 90, sin excepción | Cumple |
| Pool global de capacidad 10 con 100 tareas | Acepta 10, rechaza 90, sin excepción | Cumple |
| Ráfaga de 7 eventos con probabilidad 1 durante 500 ticks | Sin crash, disparos acotados | Cumple |

`INITIAL_NODES` subió de 50 a 200 en `backend/src/config.ts` para que el estrés sea alcanzable en runtime. `backend/test/config.test.ts` cubre el límite nuevo.

## 2. Calibración del modelo térmico

Archivo: `backend/test/thermal-calibration.test.ts`.

Parámetros actuales (`backend/src/domain/thermal.ts`):

| Parámetro | Valor |
|---|---:|
| `timeConstantMs` | 20 000 |
| `loadHeatGain` | 0.35 |
| `dissipationRate` | 0.002 |
| `fanDissipationMultiplier` | 3 |
| `COMPUTE_DEMAND_HEAT` | 0.07 por unidad |
| `COOLDOWN_TASK_COOLING` | 0.07 por unidad |
| `INACTIVE_COOLING_TIME_MS` | 60 000 |

Escenarios y cotas:

| Escenario | Valor esperado | Tolerancia | Resultado |
|---|---:|---:|---|
| Nodo inactivo de 40 °C a ambiente 20 °C, 240 s | 20.37 °C | ±0.05 | Cumple, descenso monótono |
| Nodo activo, `workload=0`, target 30 °C | 29.62 °C | ±0.05 | Cumple |
| Nodo activo, `workload=0.3`, target 30 °C | 31.63 °C | ±0.05 | Cumple |
| Inercia: 25 a 30 °C, tras 20 s | 28.16 °C | ±0.3 | Cumple |
| Ventilador con `workload=0.3` | Baja el equilibrio 0.83 °C | ≥0.5 y ±0.1 | Cumple |
| Tarea `computeDemand=5` | Sube el equilibrio 6.73 °C | ±0.2 | Cumple |
| Tarea `cooldown`, `computeDemand=5` | Baja el equilibrio 6.73 °C | ±0.2 | Cumple |
| 10 000 ticks | Sin `NaN`, rango [-60, 150] | — | Cumple |
| Motor completo, carga por defecto, 600 ticks | 31.63 °C | ±0.1 | Cumple |

Lectura: el objetivo no es el punto de equilibrio exacto. La carga y la disipación desplazan el equilibrio. Con `workload=0` el nodo queda en 29.62 °C; con el valor por defecto 0.3 queda en 31.63 °C. El ventilador solo baja 0.83 °C con la carga por defecto. Son propiedades del modelo, no fallos. Quedan documentadas y cubiertas por tests.

## 3. Tolerancia a fallos

| Fallo | Prueba | Comportamiento verificado |
|---|---|---|
| Fallos consecutivos de nodo | `backend/test/faults.test.ts` | Tras el máximo configurable pasa a `error`; `recover` limpia el contador |
| Recuperación de nodo | `backend/test/events.test.ts` | `node_recovery` reactiva y limpia fallos |
| Fallo de ventilador | `backend/test/events.test.ts` | `fan_failure` apaga el ventilador |
| Worker de inferencia que rechaza | `backend/test/inference-failure.test.ts` | El servicio devuelve `{ok:false}`, avisa y no emite `inference:completed` |
| Timeout de inferencia | `backend/test/inference-failure.test.ts` | Devuelve `{ok:false, error:'timeout'}` sin emitir evento |
| Base de datos caída | `backend/test/timeseries-sink.test.ts` | El sink no lanza, reporta `onError` y descarta el buffer pendiente |
| Caída y reconexión WebSocket | `backend/test/ws.test.ts` | El cliente recibe `state:update` antes y después de reconectar, sin listeners duplicados |
| Reglas en conflicto | `backend/test/rules-conflict.test.ts` | Orden determinista, cooldown respetado, pool acotado |

Bug corregido durante S10: `InferenceService.request` no capturaba el rechazo de `InferenceWorker.predict` cuando el proceso Python moría. Ese rechazo quedaba sin manejar en `run()`. Ahora se normaliza a `{ok:false, error}` en el límite del servicio. Regresión cubierta por `inference-failure.test.ts`.

## 4. Pruebas de frontend

Runner nativo `node --test`, sin dependencias nuevas. Script `npm.cmd test` en `frontend/package.json`.

| Archivo | Casos |
|---|---|
| `frontend/src/lib/recommendation.test.js` | Sin datos, estable en ±1 °C, enfriar, subir carga, target no finito |
| `frontend/src/three/layout.test.js` | Solo general, rejilla 2x2, modo retrato, posiciones únicas, distancia de cámara |

Resultado: 11 tests verdes.

## 5. Resultado global

| Suite | Tests |
|---|---:|
| Backend vitest | 146 |
| Frontend `node --test` | 11 |
| ML pytest | 18 |
| **Total** | **175** |

Verificación final: `typecheck`, `build`, `lint` y las tres suites en verde.

## 6. Límites conocidos

- El estrés mide el motor y la serialización del snapshot, no el rendimiento de la escena 3D. Para la UI se recomienda seguir en 50 nodos o menos.
- El test de WebSocket cubre entrega y reconexión, no throughput sostenido con 200 nodos y clientes reales.
- La prueba de base de datos usa un driver falso. No simula una caída real de MariaDB ni reconexión del pool.
- La prueba de worker de inferencia usa un stub que rechaza. No mata un proceso Python real.
- No hay prueba de soak de horas. El caso de 10 000 ticks cubre estabilidad numérica del modelo, no fugas de memoria de larga duración.
- La calibración usa `dt` fijo de 1000 ms. El motor real usa `Date.now()` con delta acotado a 5000 ms; la variación de jitter no se prueba.
