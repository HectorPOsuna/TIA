# AGENTS.md - TIA Simulador de Temperatura

TIA es un simulador de monitoreo térmico: un backend en Node.js/TypeScript (Express + Socket.IO) que replica la lógica del antiguo firmware Arduino (modelo térmico, nodos con estados, colas FIFO, pila LIFO de eventos y reglas reactivas hot-editable) y una interfaz React (Vite) que lo consume. No hay hardware ni código Arduino en el repo (eliminados en `0ad1655`).

## Build & Run
- `pnpm`/`npm` PowerShell shims están bloqueados por la policy de ejecución: usa siempre `pnpm.cmd`/`npm.cmd`.
- Backend (`backend/`):
  - `pnpm.cmd install` — dependencias
  - `pnpm.cmd dev` — servidor con recarga (`tsx watch`), `http://localhost:3000`
  - `pnpm.cmd exec tsc --noEmit -p tsconfig.json` — chequeo de tipos
  - `pnpm.cmd run test` — tests vitest (19 tests: térmico, colas/pila, reglas)
  - `pnpm.cmd run build` / `pnpm.cmd start` — build de producción (`dist/`)
- Frontend (`frontend/`, sin trackear): `npm.cmd run dev`; `npm.cmd run build`; `npm.cmd run lint`.

## Arquitectura backend (`backend/src/`)
- `domain/` — lógica pura sin I/O: modelo térmico, cola FIFO, pila LIFO, nodos, sistema, store + evaluación de reglas y acciones.
- `engine/` — `EventBus` tipado y `SimulationEngine` (tick: térmico → colas → reglas).
- `api/` — routers Express con validación zod y contexto compartido.
- `infra/` — config de entorno, persistencia, loader de reglas, logs, Socket.IO.
- El transporte (API/WS) se suscribe al mismo `EventBus<SimEventMap>`; el dominio no depende de Express.

## Convenciones de código backend
- ESM (`"type": "module"`), `moduleResolution` NodeNext, strict; los imports relativos llevan sufijo `.js`.
- Validación con zod (`src/api/validation.ts`): usa `parseBody<S extends z.ZodTypeAny>` que devuelve `z.output<S>` (los campos con `.default()` en schemas `.refine()` no pierden el tipo requerido si NO se usa `z.ZodType<T>`).
- Sin comentarios en el código.

## Repo quirks
- `frontend/` es WIP sin trackear (tiene `pnpm-lock.yaml` y `package-lock.json`; no añadir un tercer lockfile). Backend usa pnpm.
- `pnpm` 12 exige aprobar builds en `backend/pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`); `pnpm.onlyBuiltDependencies` en `package.json` se ignora.
- `data/default-rules.json` se carga al arranque y las reglas se pueden editar en caliente vía API.
- No hay hardware: el "estado en error" de un nodo es un contador de fallos consecutivos simulado.

## Config
Variable de entorno en `backend/.env` (ver `backend/.env.example`): `PORT`, `TICK_MS`, `INITIAL_NODES`, `TARGET_TEMP`, `AMBIENT_TEMP`, `CORS_ORIGIN`, `NODE_QUEUE_CAPACITY`, `STACK_CAPACITY`, `LOG_CAPACITY`, `MAX_CONSECUTIVE_FAILURES`, `RULES_FILE`.

## Commits
Todos los commits en español, imperativo: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Nunca commitees artefactos de build (`node_modules/`, `dist/`, `.pio/` — ignorados).