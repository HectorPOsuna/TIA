# Proposal

## Why

El backend escucha por defecto en `3000`, pero el working tree tiene `frontend/vite.config.js` apuntando a `3001`. Con el backend arrancado con sus valores por defecto, Vite devuelve `ECONNREFUSED` en `/api` y Socket.IO no conecta. Las guías además muestran `3001` como «ejemplo local», lo que invita a repetir el desajuste.

El usuario eligió `3000` como puerto canónico. El frontend sigue escuchando en `5173`; lo que debe coincidir es el destino del proxy, no el puerto de Vite.

## What Changes

- Restaurar los targets de `/api` y `/socket.io` en `frontend/vite.config.js` a `http://localhost:3000`. Esto revierte el cambio sin commitear que había en ese archivo, con autorización explícita del usuario.
- Confirmar sin cambios el default `PORT=3000` en `backend/src/config.ts` y `backend/.env.example`; `CORS_ORIGIN` sigue siendo `http://localhost:5173`.
- Quitar los ejemplos concretos con `3001` de `docs/guia-junior.md`, `docs/guia-usuario.md` y `docs/guia-tecnica.md`, y dejar la regla general: si se cambia `PORT` a propósito, se cambia también el proxy y se conserva CORS.
- Verificar arranque con ambos lados en defaults: `GET /api/system` responde y Socket.IO conecta sin `ECONNREFUSED`.
- No añadir dependencias, variables nuevas ni cambios al backend.

**Supuestos**: `3000` es el puerto canónico por decisión del usuario; `3001` no se usa como ejemplo recomendado; el puerto del frontend (`5173`) no cambia.

## Capabilities

### New Capabilities

- `frontend-backend-connectivity`: contrato de conectividad local entre el proxy de Vite, el puerto HTTP/WebSocket del backend y CORS.

### Modified Capabilities

- Ninguna. No hay specs base en el proyecto (`openspec list --specs` devuelve vacío).

## Impact

- `frontend/vite.config.js`: targets del proxy a `3000`.
- `docs/guia-junior.md`, `docs/guia-usuario.md`, `docs/guia-tecnica.md`: tablas y ejemplos de puertos.
- Sin cambios en `backend/src/config.ts`, `backend/.env.example`, `README.md`, `backend/README.md` ni en dependencias.
- Sin cambios en el contrato HTTP/WebSocket; el backend sigue exponiendo API y eventos en `3000`.
