# WAItt - Simulador de Temperatura

WAItt es el acrónimo del **Sistema de cuidado del agua mediante técnicas de inteligencia artificial y estrangulamiento térmico**.

Simulador de monitorización térmica que replica el comportamiento del antiguo sistema de firmware Arduino con sensores DS18B20: modelo térmico, nodos (general + trabajadores) con estados y fallos, colas de prioridad de tareas con pool global, pila LIFO de eventos y reglas reactivas que se pueden editar en caliente.

## Composición

| Componente | Tecnología | Carpeta |
|---|---|---|
| Backend (simulador) | Node.js/TypeScript, Express + Socket.IO | `backend/` |
| Frontend (panel) | React (Vite) | `frontend/` |

No hay hardware ni código Arduino: el GitHub Actions / histórico lo conserva, pero el árbol actual es 100 % simulado.

## Backend

Ver [backend/README.md](backend/README.md) para API REST, eventos WebSocket, modelo térmico, reglas e integración con el frontend.

```bash
cd backend
pnpm.cmd install
pnpm.cmd dev        # http://localhost:3000
pnpm.cmd run test   # 47 tests vitest
pnpm.cmd run build
```

## Base de datos (BD time-series)

El backend puede persistir la telemetría y los eventos de la simulación en MariaDB/MySQL
(tablas `telemetry` y `events`, ver [docs/guia-tecnica.md](docs/guia-tecnica.md)). Con Docker:

```bash
docker compose up -d     # MariaDB (localhost:3306) + phpMyAdmin (http://localhost:8080)
```

Credenciales de desarrollo: BD/usuario `waitt`/`waitt` (root: `root`). El escritor se activa
con `DB_ENABLED=true` (por defecto) y escribe por lotes; si la BD no responde, solo se loguea
y la simulación continúa. `DB_ENABLED=false` desactiva la conexión por completo.

## Frontend

```bash
cd frontend
npm.cmd install
npm.cmd run dev     # Vite con proxy a /api y /socket.io -> localhost:3000
```

## Qué se eliminó

En `0ad1655` se eliminó por completo el firmware Arduino (PlatformIO): `TIA.ino`, `src/`, `include/`, `test/`, `platformio.ini`, `sensors/`, `utils/`, `config.h`. El simulador backend replica su lógica (modelo térmico, estados de nodo, manejo de lecturas fallidas) sin hardware.