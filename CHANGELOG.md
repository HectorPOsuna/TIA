# Changelog

Todas las notas significativas de los cambios de WAItt se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
## [1.0.1](https://github.com/HectorPOsuna/TIA/compare/v1.0.0...v1.0.1) (2026-09-25)

### Mantenimiento

* renombra el proyecto de TIA a WAItt ([63764b0](https://github.com/HectorPOsuna/TIA/commit/63764b0b5379f20d88c871cc3a60b0ab7385b14d))

### Documentación

* documenta el flujo de release y el changelog generado ([42cd8f8](https://github.com/HectorPOsuna/TIA/commit/42cd8f894d9e7890b24f690ac33c80a2e9f542d9))
* renombra el proyecto a WAItt en README, AGENTS y guias ([fef44e6](https://github.com/HectorPOsuna/TIA/commit/fef44e620f1e8a86e8627ce4a97e51d9f2f9c8fa))

## 1.0.0 (2026-09-24)

### Añadido

* **backend:** API REST con validacion zod, httpServer y bootstrap ([5bd7210](https://github.com/HectorPOsuna/TIA/commit/5bd7210898c73046dc41307fa496c073794bf331))
* **backend:** capa dominio - nodos, colas FIFO, pila LIFO, modelo termico, reglas y acciones ([92499e2](https://github.com/HectorPOsuna/TIA/commit/92499e21bcd962e5e382818aa28579bbea9a3fc4))
* **backend:** capa motor - bus de eventos y motor de simulacion con tick, colas y reglas ([b1ccade](https://github.com/HectorPOsuna/TIA/commit/b1ccadead3dec5d40531c63046c9578f2faf92e4))
* **backend:** infraestructura - config de entorno, persistencia, loader de reglas y eventos socket.io ([076b970](https://github.com/HectorPOsuna/TIA/commit/076b97085cbefadb734fecd3748dc8ca867a2f0d))
* **backend:** reglas reactivas por defecto cargadas al arranque ([557a41a](https://github.com/HectorPOsuna/TIA/commit/557a41aa62aadc8b584c6f18bdb4713cc7f8ed45))
* **frontend:** panel de monitoreo con hooks socket.io y proxy de Vite al backend ([20f92e9](https://github.com/HectorPOsuna/TIA/commit/20f92e9898322702a1c97ac30cb6bd8c5772a3c4))

### Corregido

* **backend:** emitir task:queued cuando una regla encola una tarea ([9dac035](https://github.com/HectorPOsuna/TIA/commit/9dac035410a48024f6ca2b44005d9fc876f19ad3))

### Mantenimiento

* **backend:** release tooling con commit-and-tag-version ([80402a5](https://github.com/HectorPOsuna/TIA/commit/80402a5fd8bcd8581faea952979b117690c9e599))
* **backend:** scaffolding base del simulador TIA ([d9a605b](https://github.com/HectorPOsuna/TIA/commit/d9a605b0a6339eb0642bc4e7c1bd9bbcf7aaf8d2))
* eliminar firmware Arduino y arquitectura legacy raiz ([0ad1655](https://github.com/HectorPOsuna/TIA/commit/0ad165528ac8a0c1fd9a3f81b8b4c9698935a7dc))

### Documentación

* actualiza AGENTS/README y anade guias de usuario y tecnica ([49a95b5](https://github.com/HectorPOsuna/TIA/commit/49a95b5e5c887d5d4a543de920f8dfddb81838a1))
* **backend:** documenta API REST, eventos WebSocket e integracion con el frontend ([4b7e2ed](https://github.com/HectorPOsuna/TIA/commit/4b7e2eda996425b70a97d84c630a5a437c42cc34))
* documentar proyecto simulador y eliminar referencias al firmware Arduino ([186c856](https://github.com/HectorPOsuna/TIA/commit/186c856d5765726fbed0ac3a9157a83887009e13))

### Pruebas

* **backend:** tests unitarios de modelo termico, colas/pila y reglas reactivas ([54002bb](https://github.com/HectorPOsuna/TIA/commit/54002bb9b6cfcbb5e9a2c9b86f7743e688873fa0))