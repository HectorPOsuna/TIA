# AGENTS.md - TIA Simulador de Temperatura

TIA es un simulador de monitoreo térmico: un backend en Node.js/TypeScript (Express + Socket.IO) que replica la lógica del antiguo firmware Arduino (modelo térmico, nodos con estados, colas FIFO, pila LIFO y reglas reactivas hot-editable) y una interfaz React (Vite) que lo consume. No hay hardware ni código Arduino (eliminados en `0ad1655`).

## Comandos
- Los shims `pnpm`/`npm` de PowerShell están bloqueados por la policy de ejecución: usa siempre `pnpm.cmd`/`npm.cmd`.
- Backend (`backend/`): `pnpm.cmd install` · `pnpm.cmd dev` (tsx watch, `http://localhost:3000`) · verificación con `pnpm.cmd run typecheck` + `pnpm.cmd run test` (vitest, 19 tests) + `pnpm.cmd run build` (emite a `dist/`). No hay lint.
- `typecheck` falla si hay locals/parámetros sin usar (`noUnusedLocals`/`noUnusedParameters` en tsconfig).
- Frontend (`frontend/`, JSX sin TypeScript): `npm.cmd run dev` · `npm.cmd run build` · `npm.cmd run lint`.
- Releases: `pnpm.cmd run release` en `backend/` valida (typecheck+test+build), computa la versión desde los commits convencionales, regenera el `CHANGELOG.md` de la raíz, commitea y crea el tag `vX.Y.Z`. `pnpm.cmd run release:dry` solo muestra lo que haría.

## Arquitectura backend (`backend/src/`)
- `domain/` — lógica pura sin I/O (modelo térmico, cola FIFO, pila LIFO, nodos, sistema, reglas, acciones); `engine/` — `EventBus` tipado + `SimulationEngine`; `api/` — routers Express con validación zod; `infra/` — config, persistencia, loader de reglas, logs, Socket.IO, httpServer.
- El tick usa tiempo real `Date.now()` con delta acotado a `MAX_DT_MS = 5000` (`simulationEngine.ts`), no un dt fijo por `TICK_MS`.
- Las reglas se leen cada tick vía `rules.enabledList()` → se pueden editar en caliente por API sin reiniciar.
- IDs por prefijo con `createId`: `node-general` + `node-1..N`, `task-<id>`, `rule-<id>`. Las rutas y curl del README usan esos ids.

## Convenciones backend
- ESM (`"type": "module"`), `moduleResolution` NodeNext, strict; los imports relativos llevan sufijo `.js`.
- Toda validación pasa por `parseBody<S extends z.ZodTypeAny>` en `api/validation.ts`, que devuelve `z.output<S>`. NO uses `z.ZodType<T>`: hace que los campos con `.default()` dentro de schemas `.refine()` infieran `optional` y rompan la asignación a `RuleInput`/`TaskOptions` (bug real ya corregido).
- Sin comentarios en el código.

## Repo quirks
- `frontend/` usa npm pero tiene `pnpm-lock.yaml` y `package-lock.json` AMBOS commiteados: no añadir un tercer lockfile e instala con `npm.cmd` para actualizar el lockfile real.
- `pnpm` 12 exige aprobar builds en `backend/pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`); `pnpm.onlyBuiltDependencies` en `package.json` se ignora.
- `data/default-rules.json` se carga al arranque (`RULES_FILE`); el "estado en error" de un nodo es un contador de fallos consecutivos simulado, no hardware.
- El frontend se conecta al backend por proxy de Vite (`/api` y `/socket.io` con `ws`) → hooks en `frontend/src/hooks/` (`useSimulation`, `useRules`).

## Config
Env en `backend/.env` (ver `backend/.env.example`): `PORT`, `TICK_MS`, `INITIAL_NODES`, `TARGET_TEMP`, `AMBIENT_TEMP`, `CORS_ORIGIN`, `NODE_QUEUE_CAPACITY`, `STACK_CAPACITY`, `LOG_CAPACITY`, `MAX_CONSECUTIVE_FAILURES`, `RULES_FILE`.

## Commits
Todos en español, imperativo: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Nunca commitees artefactos de build (`node_modules/`, `dist/`, `.pio/` — ignorados).

## Changelog
- `CHANGELOG.md` (raíz) se genera con `commit-and-tag-version` (config en `.versionrc.json` de la raíz, secciones en español). No se edita a mano.
- Al no haber tags previos, la herramienta barre toda la historia: el release inicial `v1.0.0` se generó con `--first-release` y se limpió de la etapa clase/Arduino (commit `1488f4f`).
- Los commits convencionales de la etapa clase/firmware (anteriores a `d9a605b`) quedan fuera del changelog.