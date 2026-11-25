# Design

## Context

Ver `proposal.md` para la motivación y `specs/interactive-tutorial/spec.md` para el contrato.

El tutorial actual tiene 26 pasos en `steps.js`, una capa que resalta por `getBoundingClientRect`, un hook `useTutorial` con `{ index, visible }` persistido en `waitt-tutorial`, y un efecto en `App.jsx` que abre paneles según `step.view`. La tarjeta ya deja pasar clics al elemento resaltado; hoy nadie detecta esos clics.

Restricción: `React` 19 sin TypeScript, `node:test`, ESLint con `react-hooks/set-state-in-effect`, sin comentarios en código y sin dependencias nuevas. Los estados derivados deben calcularse en render o programarse con `requestAnimationFrame`, nunca con `setState` síncrono dentro de un efecto.

## Goals / Non-Goals

**Goals:**

- Que el tutorial reaccione a la interacción sin quitar control al usuario.
- Dar pistas concretas a quien no conoce la interfaz.
- Mostrar qué queda por explorar sin convertirlo en misiones.
- Conservar compatibilidad con el progreso ya guardado.

**Non-Goals:**

- No avanzar automáticamente ni bloquear botones.
- No añadir pasos, dependencias ni lógica de backend.
- No convertir el apoyo en un checklist obligatorio.
- No alterar el contrato HTTP ni el pipeline ML.

## Decisions

### 1. Metadatos por paso

Cada entrada de `steps.js` gana `prompt`, `hint` y `module` (agrupación para el apoyo). La interactividad se deriva del DOM: el paso es interactivo si su objetivo o un descendiente coincide con `button, input, select, textarea, a[href], [role="button"], [role="tab"]`. Se permite un override `interactive: true|false` para casos sin semántica HTML, como el lienzo 3D y las etiquetas de nodo.

- Alternativa descartada: marcar a mano los 26 pasos como interactivos. Duplica información que el DOM ya expone y se desincroniza al cambiar un control.
- `module` se derivaría de `eyebrow`, pero varios pasos comparten etiqueta con significados distintos; un campo explícito mantiene estable el apoyo.

### 2. Detección de interacción

`TutorialOverlay` instala un listener delegado de `click` y otro de `pointerover`/`pointerout` en `document`. Un clic cuenta cuando `event.target.closest(step.target)` existe y el destino no pertenece a la tarjeta (`[data-tutorial-ui]` ni `.tutorial-card`). El hover inicia un temporizador de 500 ms sobre el objetivo y se cancela al salir; en pantallas táctiles el clic cubre el caso. Cualquier interacción válida llama a `onMark(step.id)`.

- Alternativa descartada: attach por elemento. Los pasos abren paneles después de montarse, así que los nodos cambian durante el recorrido; la delegación evita reenganchar.
- Alternativa descartada: contar cualquier clic en pantalla. Marcaría pasos por error al usar otros controles.

### 3. Pasos informativos y confirmación

Si el paso no es interactivo, se marca al mostrarse. El cálculo se hace en un efecto con `requestAnimationFrame`, igual que el medidor actual, para cumplir la regla de ESLint. Al marcar, `useTutorial` actualiza `explored` y la tarjeta muestra una confirmación breve durante ~2,5 s además del segmento chequeado. El paso activo no cambia.

### 4. Pistas

Un temporizador de ~6 s se reinicia al entrar en cada paso y al marcarlo. Si vence, la tarjeta muestra `step.hint`. Un clic fuera del objetivo también la muestra. La pista es texto adicional bajo la descripción; no sustituye al `prompt`, que siempre está visible.

### 5. Apoyo compacto

Dentro de la tarjeta, bajo los segmentos, un botón plegable muestra «Explorados X/26» y, al abrirse, una fila por `module` con contador `explorados/total` y un botón por paso. Elegir un paso llama a `goTo(index)` del hook; no lo marca. El estado plegado es local de la tarjeta, no se persiste.

- Alternativa descartada: panel lateral flotante. Compite con el dock, el panel de eventos y el cajón de nodo; además hace la tarjeta más grande en móvil.

### 6. Persistencia

`progress.js` pasa a manejar `{ index, visible, explored }`. `parseProgress(raw, total, validIds)` filtra ids desconocidos y acepta valores sin `explored` como conjunto vacío. `serializeProgress` escribe los tres campos. `reset()` limpia `explored`; `toggle()` lo conserva. `steps.js` exporta `TUTORIAL_STEP_IDS` para no recrear el array en cada render. `useTutorial(total, validIds)` expone `explored`, `markExplored` y `goTo`.

- Alternativa descartada: clave de almacenamiento nueva. Dejaría el progreso anterior huérfano.

### 7. Pruebas y verificación

Se amplían los tests de `progress.js` para migración, filtrado de ids y reset. La verificación de interacción se hace en navegador con CDP: clic y hover marcán, los pasos informativos se marcan al mostrarse, saltar no marca, y la recarga conserva `explored`.

## Risks / Trade-offs

- Hover involuntario → pausa de 500 ms y cancelación al salir del elemento.
- Elementos sin semántica → override explícito en `steps.js`.
- Paneles que se abren después del montaje → delegación en `document`.
- Respecto a `set-state-in-effect` → marcas informativas programadas con `requestAnimationFrame`.
- Tarjeta más alta por pista y apoyo → apoyo plegado por defecto y `clamp` del viewport ya existente.
- Datos antiguos sin `explored` → normalizados a conjunto vacío al leer.

## Migration Plan

Sin migración de backend. Los valores actuales de `waitt-tutorial` siguen siendo válidos y se enriquecen al primer cambio de estado. Rollback: retirar los campos nuevos y volver a serializar sólo `index` y `visible`.

## Open Questions

Ninguna. La combinación A+C, el significado de «explorado», la pausa del hover y el no avance automático quedaron decididos con el usuario.
