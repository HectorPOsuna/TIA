# Tasks

## 1. Datos y persistencia

- [x] 1.1 Ampliar `frontend/src/tutorial/progress.js` con `explored`, normalización de ids válidos, compatibilidad con valores sin ese campo y `reset()` que lo vacía; verificar con `node:test` que `npm.cmd test` pasa incluyendo migración, filtrado, recarga y reinicio
- [x] 1.2 Añadir `prompt`, `hint`, `module` y override `interactive` a los 26 pasos de `frontend/src/tutorial/steps.js`, y exportar `TUTORIAL_STEP_IDS`; verificar que todos los pasos tienen los campos nuevos y que `npm.cmd run lint` pasa
- [x] 1.3 Ampliar `frontend/src/hooks/useTutorial.js` para aceptar ids válidos y exponer `explored`, `markExplored` y el `goTo` existente sin cambiar `index` ni `visible`; verificar que `npm.cmd run lint` y `npm.cmd run build` pasan

## 2. Overlay interactivo

- [x] 2.1 Añadir en `TutorialOverlay.jsx` detección delegada de clic dentro del objetivo y de hover sostenido 500 ms, con llamada a `markExplored` y confirmación breve sin avanzar; verificar en navegador que marcar no cambia el paso y que `npm.cmd run lint` pasa
- [x] 2.2 Añadir la pista por inactividad de ~6 s y tras clic fuera del objetivo, manteniendo `prompt` visible; verificar en navegador que aparece la pista sin bloquear los tres botones
- [x] 2.3 Marcar automáticamente los pasos informativos al mostrarse, usando `requestAnimationFrame` para cumplir la regla de ESLint; verificar en navegador que logo, métricas y leyenda quedan explorados sin intervención
- [x] 2.4 Añadir el apoyo plegable por módulos con contadores y botones de salto que llaman a `goTo` sin marcar; verificar en navegador que el contador sube, que saltar no marca y que la tarjeta sigue dentro del viewport

## 3. Estilos e integración

- [x] 3.1 Añadir estilos de pista, confirmación y apoyo en `App.css` e `index.css` con tokens de tema, `pointer-events` selectivo y desactivación por reduced motion; verificar que `npm.cmd run build` pasa y que los estados se ven en tema claro y oscuro
- [x] 3.2 Conectar `App.jsx` con `TUTORIAL_STEP_IDS` y las nuevas props del overlay; verificar que `npm.cmd run build` pasa y que el recorrido completo sigue abriendo paneles con `step.view`

## 4. Verificación de integración

- [x] 4.1 Verificar en navegador con CDP: clic y hover marcan, paso informativo se marca solo, pista por inactividad, salto sin marcar, recarga conserva `explored`, reinicio lo limpia y «avanzar» sigue siendo manual
- [x] 4.2 Ejecutar `npm.cmd test`, `npm.cmd run lint` y `npm.cmd run build`; verificar salida limpia, chunk de escena separado y tarjeta dentro del viewport en 1440x900 y 390x844

## Workflow follow-up

- Archivar el change después de la revisión; la spec base de `interactive-tutorial` se actualiza desde el delta.
