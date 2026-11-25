# Tasks

## 1. Progreso y persistencia

- [x] 1.1 Crear `frontend/src/tutorial/progress.js` con `clampIndex`, `parseProgress`, `nextIndex`, `previousIndex`, `reset`, `toggle` y `serializeProgress`, con storage inyectable y clave `waitt-tutorial`; verificar que `npm.cmd test` pasa con los tests `node:test` que cubren valores válidos, corruptos, fuera de rango y límites de navegación
- [x] 1.2 Crear `frontend/src/hooks/useTutorial.js` con estado `{ index, visible }`, acciones y efecto de escritura en `localStorage` con fallback en memoria; verificar que `npm.cmd run lint` y `npm.cmd run build` pasan

## 2. Catálogo de pasos y marcadores

- [x] 2.1 Crear `frontend/src/tutorial/steps.js` con la secuencia ordenada de pasos que cubre HUD, escena, dock, leyenda, replay, eventos, detalle de nodo y las cuatro pestañas del centro de control, con `target`, `title`, `description` y `view` opcional; verificar que cada `target` coincide con un `data-tutorial-id` existente y que `npm.cmd run lint` pasa
- [x] 2.2 Añadir `data-tutorial-id` en `Hud.jsx`, `NodeDock.jsx`, `Legend.jsx`, `ReplayBar.jsx`, `EventPanel.jsx`, `App.jsx` (lanzador y capa 3D), `NodeDrawer.jsx`, `NodeDetailPanel.jsx` y `ControlCenter.jsx`; verificar que `npm.cmd run build` pasa y que todos los selectores del catálogo resuelven en la interfaz con el backend arrancado

## 3. Overlay y controles

- [x] 3.1 Crear `frontend/src/components/TutorialOverlay.jsx` con resaltado por `getBoundingClientRect`, tarjeta de misión numerada, barra de progreso y botones `avanzar`, `retroceder`, `reiniciar`, con recálculo en `resize` y `ResizeObserver` y fallback centrado si falta el objetivo; verificar que los tres controles cambian el paso observado y que `npm.cmd run lint` pasa
- [x] 3.2 Añadir el icono `help` en `Icon.jsx` y el botón flotante `?` que oculta y reanuda sin perder el paso; verificar el toggle en navegador con el recorrido visible y oculto, y que no solapa el FAB de eventos en móvil
- [x] 3.3 Añadir estilos del recorrido en `index.css` y `App.css` usando variables de tema, `pointer-events` selectivo, animaciones y desactivación por `prefers-reduced-motion`; verificar que `npm.cmd run build` pasa y que la tarjeta se ve en temas claro y oscuro

## 4. Integración en la aplicación

- [x] 4.1 Conectar `useTutorial` y `TutorialOverlay` en `App.jsx`, permitir `children` en `ControlCenter.jsx` para montar el overlay dentro del `<dialog>`, y abrir cajón, pestaña del centro de control o panel de eventos según el paso activo; verificar el recorrido completo en navegador, incluida la recarga que conserva el paso y el estado de visibilidad
- [x] 4.2 Comprobar accesibilidad del recorrido: navegación con Tab, Intro y Espacio, nombres accesibles, foco visible, `prefers-reduced-motion` y diseño móvil; verificar en DevTools que no hay controles inalcanzables ni desbordes del viewport

## 5. Verificación final

- [x] 5.1 Ejecutar `npm.cmd test`, `npm.cmd run lint` y `npm.cmd run build`; verificar salida limpia y que la escena 3D sigue en su propio chunk de Vite
- [x] 5.2 Recorrer los pasos en temas claro y oscuro y en pantalla móvil, comprobando que cada elemento de la spec queda visible y explicado antes de archivar el change

## Workflow follow-up

- Archivar el change después de la revisión; la spec base de `interactive-tutorial` se crea desde el delta.
