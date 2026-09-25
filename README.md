# TIA - Simulador de Temperatura

Simulador de monitorización térmica que replica el comportamiento del antiguo sistema de firmware Arduino con sensores DS18B20: modelo térmico, nodos (general + trabajadores) con estados y fallos, cola FIFO de tareas, pila LIFO de eventos y reglas reactivas que se pueden editar en caliente.

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
pnpm.cmd run test   # 19 tests vitest
pnpm.cmd run build
```

## Frontend

```bash
cd frontend
npm.cmd install
npm.cmd run dev     # Vite con proxy a /api y /socket.io -> localhost:3000
```

## Qué se eliminó

En `0ad1655` se eliminó por completo el firmware Arduino (PlatformIO): `TIA.ino`, `src/`, `include/`, `test/`, `platformio.ini`, `sensors/`, `utils/`, `config.h`. El simulador backend replica su lógica (modelo térmico, estados de nodo, manejo de lecturas fallidas) sin hardware.