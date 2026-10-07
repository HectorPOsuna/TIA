# AGENTS.md - WAItt Simulador de Temperatura

WAItt (acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**) es un simulador de monitoreo térmico: un backend en Node.js/TypeScript (Express + Socket.IO) que replica la lógica del antiguo firmware Arduino (modelo térmico, nodos con estados, colas de prioridad, pila LIFO y reglas reactivas hot-editable) y una interfaz React (Vite) que lo consume. No hay hardware ni código Arduino (eliminados en `0ad1655`).

## Comandos
- Los shims `pnpm`/`npm` de PowerShell están bloqueados por la policy de ejecución: usa siempre `pnpm.cmd`/`npm.cmd`.
- Backend (`backend/`): `pnpm.cmd install` · `pnpm.cmd dev` (tsx watch, `http://localhost:3000`) · verificación con `pnpm.cmd run typecheck` + `pnpm.cmd run test` (vitest, 38 tests) + `pnpm.cmd run build` (emite a `dist/`). No hay lint. Un solo archivo de test: `pnpm.cmd run test test/<archivo>.test.ts` (los flags no se reenvían con `run`; los argumentos posicionales sí).
- `typecheck` falla si hay locals/parámetros sin usar (`noUnusedLocals`/`noUnusedParameters` en tsconfig).
- Frontend (`frontend/`, JSX sin TypeScript, sin tests): `npm.cmd run dev` · `npm.cmd run build` · `npm.cmd run lint`.
- Releases: `pnpm.cmd run release` en `backend/` valida (typecheck+test+build), computa la versión desde los commits convencionales, regenera el `CHANGELOG.md` de la raíz, commitea y crea el tag `vX.Y.Z`. `pnpm.cmd run release:dry` solo muestra lo que haría.

## Arquitectura backend (`backend/src/`)
- `domain/` — lógica pura sin I/O (modelo térmico, cola de prioridad con empate FIFO, pool global, dispatcher al nodo libre más frío, pila LIFO, nodos, sistema, reglas, acciones); `engine/` — `EventBus` tipado + `SimulationEngine`; `api/` — routers Express con validación zod; `infra/` — persistencia, loader de reglas, logs, Socket.IO, httpServer; `config/` — `database.ts` (`loadDatabaseSettings`, env `DB_*` → pool).
- El tick usa tiempo real `Date.now()` con delta acotado a `MAX_DT_MS = 5000` (`simulationEngine.ts`), no un dt fijo por `TICK_MS`.
- Las reglas se leen cada tick vía `rules.enabledList()` → se pueden editar en caliente por API sin reiniciar.
- Tareas: cada nodo tiene su cola de prioridad (`1`=menor … `5`=mayor) y existe un pool global (`PriorityTaskQueue`, `PENDING_POOL_CAPACITY`). `enqueue_task` de una regla con `subject=any|all` inyecta **una** tarea al pool; con `subject=system|node` a la cola del nodo. El dispatcher asigna cada tick la mayor prioridad del pool al worker activo libre más frío (cola local vacía) → `startExternalTask`.
- Persistencia: el log se vuelca a `LOG_FILE` (JSONL, misma capacidad que `LOG_CAPACITY`) y se restaura al arrancar; las reglas se sincronizan con `RULES_FILE` al crear/editar/eliminar por API (el `onChange` del `RuleStore` se engancha en `index.ts` tras construirlo para que el arranque no regrabe). La telemetría time-series se persiste en MariaDB/MySQL vía la capa `Database` (conexión única estilo PDO en `infra/database.ts`: statements preparados `execute`, inserts por objeto `insert`/`insertMany`, placeholders nombrados `:nombre`, `transaction` sobre una sola conexión; driver inyectable para tests) alimentada por `TimeSeriesSink` (suscrito al `EventBus` en `infra/timeseriesSink.ts`), cuando `DB_ENABLED`, con DDL idempotente desde `DB_SCHEMA_FILE` (`docker/mysql/init/01-schema.sql`); el snapshot de `PersistenceRepository` sigue en memoria.
- Campos de tarea: `priority`, `computeDemand` (1–5, calor extra `demanda × COMPUTE_DEMAND_HEAT[0.07]`) y `durationSecs` (1–10, canónico). `durationMs` sigue aceptándose en `actionParams` de reglas (retrocompatible), no en la API.
- IDs por prefijo con `createId`: `node-general` + `node-1..N`, `task-<id>`, `rule-<id>`. Las rutas y curl del README usan esos ids.

## Convenciones backend
- ESM (`"type": "module"`), `moduleResolution` NodeNext, strict; los imports relativos llevan sufijo `.js`.
- Toda validación pasa por `parseBody<S extends z.ZodTypeAny>` en `api/validation.ts`, que devuelve `z.output<S>`. NO uses `z.ZodType<T>`: hace que los campos con `.default()` dentro de schemas `.refine()` infieran `optional` y rompan la asignación a `RuleInput`/`TaskOptions` (bug real ya corregido).
- Sin comentarios en el código.

## Repo quirks
- El proyecto se llama **WAItt**. "TIA" solo sobrevive en las URLs de GitHub (`HectorPOsuna/TIA` en `.versionrc.json`/changelog), la env `INITIAL_*` y el `TIA.ino` histórico del README: no hay que renombrarlas.
- `frontend/` usa npm pero tiene `pnpm-lock.yaml` y `package-lock.json` AMBOS commiteados: no añadir un tercer lockfile e instala con `npm.cmd` para actualizar el lockfile real.
- `pnpm` 12 exige aprobar builds en `backend/pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`); `pnpm.onlyBuiltDependencies` en `package.json` se ignora.
- `data/default-rules.json` se carga al arranque (`RULES_FILE`); el "estado en error" de un nodo es un contador de fallos consecutivos simulado, no hardware.
- El frontend se conecta al backend por proxy de Vite (`/api` y `/socket.io` con `ws`) → hooks en `frontend/src/hooks/` (`useSimulation`, `useRules`).

## Config
Env en `backend/.env` (ver `backend/.env.example`): `PORT`, `TICK_MS`, `INITIAL_NODES`, `INITIAL_TEMP`, `TARGET_TEMP`, `AMBIENT_TEMP`, `CORS_ORIGIN`, `NODE_QUEUE_CAPACITY`, `STACK_CAPACITY`, `LOG_CAPACITY`, `LOG_FILE`, `LOG_CONSOLE`, `LOG_LEVEL`, `LOG_HTTP`, `LOG_TELEMETRY_EVERY`, `MAX_CONSECUTIVE_FAILURES`, `PENDING_POOL_CAPACITY`, `RULES_FILE`, `DB_ENABLED`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_FLUSH_MS`, `DB_MAX_BUFFER`, `DB_SCHEMA_FILE`. La BD MariaDB + phpMyAdmin se levanta con `docker compose up -d` en la raíz (`docker-compose.yml`; DDL en `docker/mysql/init/01-schema.sql`).

## Commits
Todos en español, imperativo: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Nunca commitees artefactos de build (`node_modules/`, `dist/`, `.pio/` — ignorados).

## Changelog
- `CHANGELOG.md` (raíz) se genera con `commit-and-tag-version` (config `.versionrc.json` de la raíz: header WAItt, secciones en español, URLs `HectorPOsuna/TIA`). No se edita a mano excepto limpieza histórica puntual.
- Los flags NO se reenvían con `pnpm.cmd run`: `release -- --first-release` descarta `--first-release` y puede bumpar mal la versión (incidente real: bumped a 1.1.0). Con flags usa `pnpm.cmd exec commit-and-tag-version --config ../.versionrc.json <flags>` (p. ej. `--first-release` o `--skip.commit --skip.tag` para regenerar sin commit/tag).
- Normalmente `release` solo prepende la sección nueva y conserva las anteriores. Solo sin tags previos barre toda la historia: así se generó `v1.0.0` y se limpió a mano la etapa clase/firmware pre-`d9a605b`, que no debe re-entrar al changelog.
- Las fechas se generan en UTC y pueden mostrar el día siguiente al local: no "corregirlas" a mano.
- Tags actuales: `v1.0.0`, `v1.0.1`. Ignora el tag `v1.0` suelto (apunta al merge `48e341b`); el tool usa el tag semver más cercano a HEAD.