# Proposal

## Why

La interfaz de WAItt concentra escena 3D, HUD, dock, replay, eventos, detalle de nodo y centro de control con cuatro pestañas. Un visitante nuevo no sabe qué significa cada pieza ni por dónde empezar, y el proyecto se usa también como escaparate público. Hoy no existe ninguna guía dentro de la app: hay que explicarla fuera de ella.

Un recorrido interactivo, integrado y visualmente enérgico permite mostrar la interfaz completa sin salir de la simulación y retomar la explicación donde se dejó.

## What Changes

- Añadir un recorrido guiado por pasos que recorre todos los elementos visibles de la interfaz: HUD, escena 3D y etiquetas de nodo, dock, leyenda térmica, barra de replay, lanzador y panel de eventos, cajón de detalle de nodo y las cuatro pestañas del centro de control.
- Dar al recorrido estética de videojuego: capa oscurecida con foco sobre el elemento, tarjeta de misión numerada, barra de progreso, acentos del tema claro/oscuro y animaciones respetuosas con `prefers-reduced-motion`.
- Añadir tres controles explícitos: avanzar, retroceder y reiniciar desde el primer paso.
- Añadir un botón flotante `?` que oculta y reanuda el recorrido; al reanudar se conserva el paso activo.
- Guardar el progreso (índice de paso y visibilidad) en `localStorage` bajo `waitt-tutorial`, sin dependencias ni llamadas al backend.
- Hacer que los pasos que afectan a zonas normalmente cerradas (cajón de nodo, centro de control, panel de eventos) abran la vista necesaria para que el elemento se vea.
- Añadir navegación por teclado, foco visible, `aria` adecuado y diseño responsive, incluida la hoja inferior en móvil.
- Añadir tests unitarios de la lógica de progreso y persistencia; verificar `npm.cmd test`, `npm.cmd run lint` y `npm.cmd run build`.

**Supuestos** (decisiones menores): el recorrido arranca activo en la primera visita y puede cerrarse con `?`; el progreso es por navegador, no por usuario; no se traduce a otros idiomas; no se modifica el backend ni el pipeline ML.

## Capabilities

### New Capabilities

- `interactive-tutorial`: recorrido guiado de la interfaz, con navegación por pasos, foco visual sobre elementos, control de visibilidad y persistencia local del progreso.

### Modified Capabilities

- Ninguna. El proyecto aún no tiene especificaciones (`openspec list --specs` devuelve vacío).

## Impact

- `frontend/src/App.jsx`: montaje del recorrido, estado de visibilidad/paso y apertura controlada de vistas.
- Archivos nuevos en `frontend/src/components/` y `frontend/src/hooks/`: overlay, tarjeta de paso y lógica de progreso/persistencia.
- `frontend/src/index.css` / `frontend/src/App.css`: estilos del recorrido con las variables de tema existentes.
- `frontend/src/components/Icon.jsx`: icono `?` si no se reutiliza un glifo textual.
- `frontend/src/`: tests node:test de progreso y persistencia.
- Sin cambios en `backend/`, `ml/`, contratos HTTP ni dependencias de `package.json`.
- Riesgo bajo: la capa del tutorial debe usar `pointer-events` selectivo para no bloquear la escena 3D ni los controles cuando esté oculto.
