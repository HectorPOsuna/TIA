# Spec Delta

## ADDED Requirements

### Requirement: Guía adaptativa por paso

El sistema SHALL mostrar, junto a cada paso, una sugerencia de qué probar y SHALL ofrecer una pista más concreta cuando el usuario no interactúa durante un intervalo breve o cuando pulsa fuera del elemento resaltado.

#### Scenario: Sugerencia al mostrar el paso

- **WHEN** el recorrido muestra un paso
- **THEN** la tarjeta incluye una sugerencia específica sobre qué hacer con el elemento resaltado

#### Scenario: Pista por inactividad

- **WHEN** el usuario permanece sin interactuar con el paso activo durante unos segundos
- **THEN** la tarjeta muestra una pista concreta sin avanzar ni bloquear los controles

#### Scenario: Pista tras pulsar fuera del objetivo

- **WHEN** el usuario pulsa una zona distinta del elemento resaltado
- **THEN** la tarjeta muestra una pista que dirige la atención al elemento correcto

### Requirement: Respuesta a la interacción del usuario

El sistema SHALL marcar un paso como explorado cuando el usuario pulsa dentro del elemento resaltado y SHALL confirmarlo visualmente sin avanzar automáticamente. En pasos interactivos, un hover sostenido sobre el elemento SHALL marcarlo también; en pasos no interactivos, mostrar el paso SHALL marcarlo.

#### Scenario: Clic en el elemento resaltado

- **WHEN** el usuario pulsa dentro del elemento resaltado de un paso interactivo
- **THEN** el paso queda marcado como explorado, la tarjeta muestra una confirmación breve y el paso activo no cambia

#### Scenario: Hover sostenido

- **WHEN** el usuario mantiene el cursor sobre el elemento resaltado de un paso interactivo durante medio segundo
- **THEN** el paso queda marcado como explorado

#### Scenario: Paso informativo

- **WHEN** el recorrido muestra un paso cuyo elemento no admite interacción
- **THEN** el paso queda marcado como explorado en cuanto se muestra

#### Scenario: Avance manual preservado

- **WHEN** el usuario marca un paso como explorado
- **THEN** el recorrido sigue requiriendo el botón `avanzar` para cambiar de paso

### Requirement: Apoyo de exploración por módulos

El sistema SHALL ofrecer un indicador compacto, agrupado por módulos de la interfaz, que muestre cuántos pasos del módulo han sido explorados y permita saltar a cualquier paso. Saltar a un paso SHALL NO marcarlo como explorado.

#### Scenario: Estado del recorrido

- **WHEN** el usuario abre el indicador de apoyo
- **THEN** ve los módulos agrupados con el número de pasos explorados sobre el total de cada módulo

#### Scenario: Salto a un paso

- **WHEN** el usuario elige un paso desde el indicador
- **THEN** el recorrido muestra ese paso sin marcarlo como explorado

#### Scenario: Indicador plegable

- **WHEN** el usuario pliega el indicador
- **THEN** la tarjeta del recorrido conserva sus controles y la navegación por pasos sigue disponible

## MODIFIED Requirements

### Requirement: Persistencia local del progreso

El sistema SHALL guardar el índice del paso, el estado de visibilidad y los pasos explorados en `localStorage` bajo la clave `waitt-tutorial`, y SHALL restaurarlos al cargar la aplicación.

#### Scenario: Recarga con progreso previo

- **WHEN** una persona recarga la página tras avanzar tres pasos
- **THEN** el recorrido se muestra en el cuarto paso, con el mismo estado de visibilidad que antes de recargar

#### Scenario: Recarga con recorrido oculto

- **WHEN** una persona oculta el recorrido en el paso cinco y recarga la página
- **THEN** el botón `?` permanece disponible y el recorrido sigue oculto hasta que se pulsa

#### Scenario: Datos guardados inválidos

- **WHEN** el valor almacenado en `waitt-tutorial` no es válido o está corrupto
- **THEN** el sistema usa el primer paso con el recorrido visible, sin pasos explorados, y sobrescribe el valor inválido

#### Scenario: Recarga con pasos explorados

- **WHEN** una persona marca varios pasos como explorados y recarga la página
- **THEN** el indicador de apoyo muestra esos mismos pasos como explorados

#### Scenario: Compatibilidad con progreso anterior

- **WHEN** el valor guardado contiene índice y visibilidad pero no pasos explorados
- **THEN** el sistema lo carga y trata el conjunto de pasos explorados como vacío

#### Scenario: Reinicio limpia la exploración

- **WHEN** una persona pulsa `reiniciar`
- **THEN** el recorrido vuelve al primer paso y el conjunto de pasos explorados queda vacío
