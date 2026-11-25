# Design

## Context

Ver `proposal.md` para la motivación y `specs/frontend-backend-connectivity/spec.md` para el contrato.

`backend/src/config.ts` y `backend/.env.example` definen `PORT=3000` por defecto; `CORS_ORIGIN` vale `http://localhost:5173`. Vite escucha en `5173` y redirige `/api` y `/socket.io` mediante `frontend/vite.config.js`. El working tree tiene ese proxy en `3001`, valor que también aparece como «ejemplo local» en tres guías. No hay `backend/.env` que justifique el cambio.

## Goals / Non-Goals

**Goals:**

- Dejar un único valor por defecto para backend y proxy: `3000`.
- Eliminar ejemplos documentados que inviten a mezclar puertos.
- Verificar arranque real con ambos lados en defaults.

**Non-Goals:**

- No cambiar el puerto de Vite (`5173`) ni CORS.
- No introducir variables de entorno compartidas ni detección automática del puerto.
- No modificar la lógica del backend ni el contrato HTTP/WebSocket.

## Decisions

### 1. Canonicalizar `3000` en lugar de `3001`

El backend y casi toda la documentación ya usan `3000`. Cambiar el default del backend a `3001` obligaría a tocar `config.ts`, `.env.example`, README, `backend/README.md` y el mensaje de la interfaz, además de contradecir las guías. El usuario eligió `3000`; el diff queda reducido al proxy y a las guías.

- Alternativa descartada: mantener `3001` como estándar. Más cambios y sin beneficio funcional.
- Alternativa descartada: una variable compartida leída por backend y Vite. Añadiría configuración de build y no cubre CORS, que depende del origen del frontend.

### 2. Revertir solo el cambio local del proxy

`frontend/vite.config.js` tiene una modificación sin commitear que cambia ambos targets a `3001`. Se revierte con autorización explícita del usuario. No se tocan `backend/src/config.ts` ni `backend/.env.example` porque ya contienen el valor deseado.

### 3. Documentar la regla, no el ejemplo

En `docs/guia-junior.md`, `docs/guia-usuario.md` y `docs/guia-tecnica.md` se sustituyen las columnas y fragmentos con `3001` por la regla general: el proxy apunta al mismo `PORT` del backend; si se cambia uno, se cambia el otro. Así se evita que un lector copie un ejemplo con puertos mezclados.

### 4. Verificación sin tests nuevos

Es un cambio de configuración, no de lógica. La comprobación es arrancar backend con defaults, arrancar Vite, pedir `GET /api/system` a través del proxy y confirmar la conexión Socket.IO; además, buscar referencias residuales a `3001` en contexto de puertos.

- Alternativa descartada: test que compare archivos de configuración. Añade fricción para un único valor y no comprueba la conexión real.

## Risks / Trade-offs

- El cambio local en `vite.config.js` puede reaparecer → las guías dejan claro que backend y proxy deben moverse juntos.
- Una persona con `PORT=3001` intencional debe actualizar el proxy a mano → la regla documentada lo exige explícitamente.
- Vite no recarga el proxy sin reinicio → la verificación incluye reiniciar `npm.cmd run dev` tras editar la configuración.
- Confundir puerto del frontend (`5173`) con puerto del backend (`3000`) → el contrato distingue ambos valores.

## Migration Plan

Sin migración de datos ni despliegue: afecta al entorno de desarrollo local. Rollback consiste en fijar `PORT=3001` en el backend y actualizar el proxy a `3001` de forma deliberada, conservando `CORS_ORIGIN=http://localhost:5173`.

## Open Questions

Ninguna. El puerto canónico quedó resuelto por decisión del usuario.
