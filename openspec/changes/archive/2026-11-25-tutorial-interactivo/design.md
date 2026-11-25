# Design

## Context

Ver `proposal.md` para la motivación y `specs/interactive-tutorial/spec.md` para el contrato de comportamiento.

El frontend es React 19 + Vite, JSX sin TypeScript, sin librería de UI ni gestor de estado global. `App.jsx` ya posee el estado de la vista (`selectedId`, `controlTab`, `eventsOpen`, `hintVisible`) y compone HUD, escena 3D, dock, leyenda, replay, eventos, cajón de detalle y centro de control. Los colores viven en variables CSS de `index.css` con temas claro/oscuro; `useReducedMotion` ya existe; `Icon.jsx` centraliza los SVG. No hay comentarios en el código y las pruebas usan `node:test`.

Restricción relevante: el centro de control es un `<dialog>` con `showModal()`, por lo que vive en la capa superior y un overlay normal del documento no puede cubrirlo.

## Goals / Non-Goals

**Goals:**

- Definir el recorrido como datos, no como ramas condicionales repartidas por la UI.
- Reutilizar tokens de tema, botones e iconos existentes.
- Mantener la lógica de progreso pura y probatable sin DOM ni React.
- Permitir que cualquier paso resalte un elemento real de la interfaz, incluidos los que están dentro de vistas cerradas.

**Non-Goals:**

- No añadir dependencias, backend, API ni persistencia remota.
- No traducir el recorrido ni añadir perfiles de usuario.
- No restaurar el estado previo de paneles al ocultar el recorrido.
- No modificar la física, el modelo ML ni la semilla de reglas.

## Decisions

### 1. Estado único y lógica pura

`useTutorial` mantiene `{ index, visible }` y expone `next`, `previous`, `reset`, `toggle` y `goTo`. Las funciones puras `clampIndex`, `parseProgress`, `nextIndex`, `previousIndex` y `serializeProgress` viven en un módulo separado con storage inyectable.

- Alternativa descartada: Context global. La app es un solo árbol y sólo `App.jsx` necesita el estado.
- Alternativa descartada: guardar el paso en la URL. Añadiría ruido sin beneficio y no conservaría la visibilidad.
- Persistencia: `localStorage` con clave `waitt-tutorial`, lectura en el inicializador del hook y escritura en un efecto. `try/catch` ante `localStorage` bloqueado o JSON corrupto; fallback en memoria con paso 0 y visible.

### 2. Catálogo de pasos como datos

`frontend/src/tutorial/steps.js` exporta un array de pasos con `id`, `eyebrow`, `title`, `description`, `target` (selector `data-tutorial-id`) y `view` opcional (`{ drawer: true }`, `{ controlTab: 'ia' }`, `{ events: true }`). Añadir o reordenar pasos no requiere tocar componentes.

Los elementos reciben `data-tutorial-id` en sus componentes: HUD (marca, métricas, IA, objetivo, tema, pausa, alertas, panel), escena y etiquetas de nodo, dock, leyenda, replay, lanzador de eventos, panel de eventos, cajón de detalle y pestañas/subpaneles del centro de control. Los racks 3D se señalan mediante el contenedor `.scene-canvas`, porque un mesh de Three.js no expone un rect DOM; las etiquetas sí se señalan mediante `.node-label`.

### 3. Resaltado sin dependencias

`TutorialOverlay` lee `getBoundingClientRect()` del objetivo activo y dibuja una caja de contorno con `box-shadow: 0 0 0 9999px var(--tutorial-dim)`, más un borde animado. La tarjeta de misión se coloca en el lado con más espacio y se fija a los bordes del viewport mediante `clamp`.

- Alternativa descartada: librería de tour. Añadiría una dependencia y estilos ajenos al tema.
- Alternativa descartada: `clip-path` sobre toda la pantalla. Funciona peor con elementos que cambian de tamaño durante la simulación.
- Recálculo: `useLayoutEffect` al cambiar de paso, más listeners de `resize` y `ResizeObserver`. Si el objetivo no existe (snapshot aún no cargado), la tarjeta aparece centrada; nunca se bloquea el recorrido.

### 4. Capa y capa superior del diálogo

El overlay raíz y su capa de oscurecido usan `pointer-events: none`; sólo la tarjeta y sus botones capturan clics. Así el elemento resaltado sigue siendo utilizable.

Cuando `controlTab` está abierto, el overlay se monta dentro del `<dialog>` del centro de control; en el resto de pasos se monta en `.app`. `ControlCenter` acepta `children` y los renderiza tras el contenido del diálogo. Esto evita que el overlay quede debajo del `::backdrop` del diálogo.

### 5. Apertura de vistas

Un efecto en `App.jsx` reacciona al paso activo mientras el recorrido está visible: si el paso pide cajón, fija `selectedId` al primer worker disponible; si pide centro de control, fija `controlTab`; si pide eventos, fija `eventsOpen`. No se guarda ni se restaura el estado previo.

- Alternativa descartada: pedir al usuario que abra cada panel. Rompe el ritmo del recorrido y deja pasos sin elemento visible.
- Alternativa descartada: restaurar la vista al ocultar. Añade estado y puede cerrar paneles que el usuario abrió por su cuenta.

### 6. Controles y estética

Tarjeta con eyebrow `MISIÓN NN / TOTAL`, título, descripción, barra de segmentos y tres botones con las clases `.btn` existentes: `avanzar`, `retroceder`, `reiniciar`. En el último paso `avanzar` queda deshabilitado; el cierre se hace con el botón flotante `?`. El botón `?` se añade a `Icon.jsx` como icono `help` y se coloca junto al FAB de eventos sin solaparlo (en móvil se reubica con media queries).

Animaciones: halo pulsante, entrada de tarjeta y relleno de progreso, desactivadas por `useReducedMotion` y por la regla global de `prefers-reduced-motion` en `index.css`.

### 7. Pruebas

Los tests cubren `parseProgress` (valor válido, corrupto, fuera de rango), `nextIndex`/`previousIndex` (límites), `reset`, `toggle` y lectura/escritura con storage simulado. Se ejecutan con `npm.cmd test`; además `npm.cmd run lint` y `npm.cmd run build`.

## Risks / Trade-offs

- Selectores `data-tutorial-id` pueden quedar desincronizados si se renombra un componente → catálogo centralizado y fallback centrado cuando falte el objetivo.
- El centro de control está en la capa superior → overlay portal dentro del diálogo; ver decisión 4.
- Abrir paneles durante el recorrido modifica la vista del usuario → decisión consciente; el usuario cierra los paneles con sus controles habituales.
- `localStorage` puede estar bloqueado → fallback en memoria y escritura protegida.
- La escena 3D se redibuja constantemente → el resaltado se calcula sobre el contenedor, no sobre meshes; se evita observar cada frame.
- `npm.cmd run build` ya avisa de chunk grande por Three.js; el tutorial no debe añadir imports de Three.js ni empeorar el chunk.

## Migration Plan

Sin migración de datos: la clave `waitt-tutorial` es nueva. Despliegue puramente de frontend; rollback consiste en retirar el componente, el hook y sus estilos, sin tocar datos persistidos. Al archivar el change, OpenSpec crea la spec base de `interactive-tutorial` a partir del delta.

## Open Questions

Ninguna que pueda resolverse después sin cambiar el contrato de comportamiento o la desglose de tareas.
