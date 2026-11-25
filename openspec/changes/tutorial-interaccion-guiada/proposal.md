# Proposal

## Why

El tutorial actual recorre 26 elementos y responde a los botones, pero no reacciona a lo que el usuario hace: resalta un elemento y espera a que se pulse «avanzar». Para alguien que no conoce WAItt, eso no dice si debe pulsar, abrir un panel o limitarse a leer. El recorrido funciona, pero no guía la siguiente interacción útil.

Se quiere mantener la libertad de avance —sin misiones bloqueantes— y añadir pistas sobre dónde y cómo moverse, sin convertir la experiencia en un checklist.

## What Changes

- Añadir guía adaptativa por paso: un `prompt` que sugiere qué probar y una `hint` más concreta que aparece tras una inactividad breve o cuando el usuario toca fuera del elemento resaltado.
- Hacer que el tutorial responda al toque: un clic dentro del elemento resaltado marca el paso como explorado y muestra una confirmación breve sin avanzar automáticamente; un hover sostenido 500 ms también marca los pasos interactivos.
- Clasificar pasos interactivos e informativos. Los pasos informativos se marcan en cuanto se muestran, para que no queden pendientes imposibles como el logo o la leyenda térmica.
- Añadir un apoyo compacto dentro de la tarjeta, agrupado por módulos con conteo de pasos explorados, que permita saltar a un paso. Saltar no marca el paso; el avance sigue siendo manual.
- Ampliar la persistencia en `localStorage`: `waitt-tutorial` pasa a guardar también los pasos explorados, conservando compatibilidad con valores antiguos. «Reiniciar» limpia ese conjunto y vuelve al paso 0.
- Añadir tests de la lógica de marcado y de la persistencia extendida.

**Supuestos** (decididos con el usuario): A es primordial y C es apoyo; no hay misiones obligatorias ni avance automático; el hover requiere una pausa breve; en pantallas táctiles el clic cubre el hover; no se añaden dependencias ni cambios al backend.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `interactive-tutorial`: se añaden requisitos de guía adaptativa, respuesta a la interacción y apoyo de exploración; se amplía `Persistencia local del progreso` para incluir pasos explorados.

## Impact

- `frontend/src/tutorial/steps.js`: nuevos campos por paso y clasificación de interactividad.
- `frontend/src/components/TutorialOverlay.jsx`: pistas, confirmación y apoyo compacto.
- `frontend/src/hooks/useTutorial.js` y `frontend/src/tutorial/progress.js`: estado de explorado, detección de interacción y persistencia compatible.
- `frontend/src/App.css` e `index.css`: estilos del apoyo y de los estados de confirmación/pista.
- Tests `node:test` de progreso y marcado.
- Sin cambios en `backend/`, `ml/`, dependencias ni contratos HTTP.
