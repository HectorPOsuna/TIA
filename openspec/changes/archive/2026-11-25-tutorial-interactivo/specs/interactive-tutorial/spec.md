# Spec Delta

## Purpose

Permite que cualquier visitante recorra y comprenda la interfaz completa de WAItt desde la propia aplicación, con una guía visual enérgica que se puede pausar, reanudar y retomar donde se dejó.

## ADDED Requirements

### Requirement: Recorrido guiado de la interfaz

El sistema SHALL mostrar una secuencia ordenada de pasos que cubra el HUD, la escena 3D, el dock de nodos, la leyenda térmica, la barra de replay, el lanzador y panel de eventos, el cajón de detalle de nodo y las cuatro pestañas del centro de control. Cada paso SHALL presentar un título, una descripción y un indicador `paso de total`.

#### Scenario: Primera visita

- **WHEN** una persona abre la aplicación sin progreso guardado
- **THEN** el sistema muestra el primer paso del recorrido con su título, descripción e indicador de progreso

#### Scenario: Cobertura completa

- **WHEN** una persona avanza desde el primer paso hasta el último
- **THEN** el recorrido ha mostrado todos los elementos de la interfaz enumerados en este requisito

### Requirement: Navegación por pasos

El sistema SHALL ofrecer controles para avanzar, retroceder y reiniciar el recorrido desde el primer paso.

#### Scenario: Avanzar

- **WHEN** una persona pulsa `avanzar` estando en el paso N con N menor que el total
- **THEN** el sistema muestra el paso N+1

#### Scenario: Retroceder

- **WHEN** una persona pulsa `retroceder` estando en el paso N con N mayor que 1
- **THEN** el sistema muestra el paso N-1

#### Scenario: Retroceder desde el inicio

- **WHEN** una persona pulsa `retroceder` estando en el primer paso
- **THEN** el sistema permanece en el primer paso

#### Scenario: Reiniciar

- **WHEN** una persona pulsa `reiniciar`
- **THEN** el sistema muestra el primer paso y guarda esa posición como progreso actual

### Requirement: Foco visual y estética de videojuego

El sistema SHALL resaltar el elemento correspondiente al paso activo, atenuar el resto de la interfaz y presentar la información como una tarjeta de misión numerada con barra de progreso, usando los colores del tema activo. La capa SHALL dejar utilizable el elemento resaltado y los controles del recorrido.

#### Scenario: Cambio de paso

- **WHEN** el recorrido pasa de un paso a otro
- **THEN** el resaltado y la tarjeta se mueven al nuevo elemento y la barra de progreso refleja la nueva posición

#### Scenario: Interacción con la escena

- **WHEN** el recorrido está visible
- **THEN** la capa no bloquea los controles del recorrido ni el elemento resaltado

### Requirement: Ocultar y reanudar el recorrido

El sistema SHALL mantener un botón `?` accesible que oculta el recorrido cuando está visible y lo reanuda en el mismo paso cuando está oculto.

#### Scenario: Ocultar

- **WHEN** una persona pulsa el botón `?` con el recorrido visible
- **THEN** el sistema retira la capa y la tarjeta sin cambiar el paso activo

#### Scenario: Reanudar

- **WHEN** una persona pulsa el botón `?` con el recorrido oculto
- **THEN** el sistema muestra el recorrido en el paso que estaba activo antes de ocultarlo

### Requirement: Persistencia local del progreso

El sistema SHALL guardar el índice del paso y el estado de visibilidad en `localStorage` bajo la clave `waitt-tutorial`, y SHALL restaurarlos al cargar la aplicación.

#### Scenario: Recarga con progreso previo

- **WHEN** una persona recarga la página tras avanzar tres pasos
- **THEN** el recorrido se muestra en el cuarto paso, con el mismo estado de visibilidad que antes de recargar

#### Scenario: Recarga con recorrido oculto

- **WHEN** una persona oculta el recorrido en el paso cinco y recarga la página
- **THEN** el botón `?` permanece disponible y el recorrido sigue oculto hasta que se pulsa

#### Scenario: Datos guardados inválidos

- **WHEN** el valor almacenado en `waitt-tutorial` no es válido o está corrupto
- **THEN** el sistema usa el primer paso con el recorrido visible y sobrescribe el valor inválido

### Requirement: Apertura de vistas necesarias para cada paso

El sistema SHALL abrir la vista que contiene el elemento del paso activo cuando dicha vista esté cerrada: el cajón de detalle de nodo, el centro de control en la pestaña correspondiente o el panel de eventos.

#### Scenario: Paso del detalle de nodo

- **WHEN** el recorrido llega a un paso situado dentro del cajón de detalle
- **THEN** el sistema selecciona un nodo y muestra el cajón con el elemento del paso visible

#### Scenario: Paso del centro de control

- **WHEN** el recorrido llega a un paso situado en una pestaña del centro de control
- **THEN** el sistema abre el centro de control en esa pestaña

#### Scenario: Paso del panel de eventos

- **WHEN** el recorrido llega a un paso situado dentro del panel de eventos
- **THEN** el sistema abre el panel de eventos

### Requirement: Accesibilidad y adaptación

El sistema SHALL permitir completar el recorrido con teclado, SHALL exponer nombres accesibles en los controles y SHALL respetar `prefers-reduced-motion` y los tamaños de pantalla móviles.

#### Scenario: Navegación con teclado

- **WHEN** una persona usa Tab, Intro o Espacio para recorrer los controles
- **THEN** puede avanzar, retroceder, reiniciar y ocultar o reanudar el recorrido sin ratón

#### Scenario: Movimiento reducido

- **WHEN** el sistema operativo solicita `prefers-reduced-motion`
- **THEN** las animaciones y transiciones del recorrido se desactivan

#### Scenario: Pantalla móvil

- **WHEN** la aplicación se abre en una pantalla estrecha
- **THEN** la tarjeta del recorrido y sus controles permanecen visibles y dentro del viewport
