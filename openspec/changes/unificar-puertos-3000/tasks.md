# Tasks

## 1. Configuración de puertos

- [x] 1.1 Restaurar los targets de `/api` y `/socket.io` en `frontend/vite.config.js` a `http://localhost:3000`, revirtiendo el cambio sin commitear; verificar que `git diff -- frontend/vite.config.js` queda vacío y que `npm.cmd run build` pasa
- [x] 1.2 Confirmar que `backend/src/config.ts` y `backend/.env.example` mantienen `PORT=3000` y `CORS_ORIGIN=http://localhost:5173` sin editarlos; verificar con búsqueda en ambos archivos

## 2. Documentación

- [x] 2.1 Reescribir la sección «La regla de puertos» de `docs/guia-junior.md` con `3000` como único valor por defecto y la regla general para cambios voluntarios; verificar que no queda `3001` en esa sección
- [x] 2.2 Reescribir la sección de puertos y el apartado de resolución de problemas de `docs/guia-usuario.md`; verificar que los fragmentos de `vite.config.js` y el arranque del backend usan el mismo puerto
- [x] 2.3 Reescribir el «Contrato de puertos» y el ejemplo de backend en `docs/guia-tecnica.md`; verificar que tabla, regla y fragmentos coinciden en `3000`

## 3. Verificación de integración

- [x] 3.1 Arrancar el backend sin variable `PORT` y el frontend en modo desarrollo; verificar que `GET /api/system` responde `200` a través del proxy y que Socket.IO conecta, sin `ECONNREFUSED` en la terminal de Vite
- [x] 3.2 Buscar referencias residuales a `3001` en contexto de puertos dentro de `frontend/`, `backend/` y `docs/`; verificar que no queda ninguna que recomiende mezclar backend y proxy, y ejecutar `npm.cmd test` y `npm.cmd run lint` en `frontend/`

## Workflow follow-up

- Archivar el change después de la revisión; la spec base de `frontend-backend-connectivity` se crea desde el delta.
