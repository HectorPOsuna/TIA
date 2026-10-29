# Changelog

Todas las notas significativas de los cambios de WAItt se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
## [1.7.0](https://github.com/HectorPOsuna/TIA/compare/v1.6.0...v1.7.0) (2026-10-29)

### Añadido

* **frontend:** rediseña la interfaz como escaparate inmersivo ([e2510ee](https://github.com/HectorPOsuna/TIA/commit/e2510eebcd6434b2c2d2eadd708cc8898865949d))

### Corregido

* **frontend:** estabiliza las etiquetas 3D y el encuadre de la escena ([3162a61](https://github.com/HectorPOsuna/TIA/commit/3162a615bfed0aba46986df638800e80ba7cd24f))
* **frontend:** mantiene el avance del replay entre renders ([9040239](https://github.com/HectorPOsuna/TIA/commit/904023945888e204c273e62584eeccc3720e02db))

### Documentación

* documenta el escaparate inmersivo y el quirk de StrictMode ([401cec0](https://github.com/HectorPOsuna/TIA/commit/401cec07d32e9542f933cf98472ec53e1ffced1e))

## [1.6.0](https://github.com/HectorPOsuna/TIA/compare/v1.5.0...v1.6.0) (2026-10-28)

### Añadido

* **backend:** añade métricas predictivas a las reglas ([cda4cc4](https://github.com/HectorPOsuna/TIA/commit/cda4cc44db7bd0ee3ea775e630847f083e6700a1))
* **backend:** registra el resultado de las acciones de reglas ([e1a6d72](https://github.com/HectorPOsuna/TIA/commit/e1a6d7296a85cca9520e0864f1c6a0ca3cb9cfa0))
* **frontend:** muestra el resultado de las reglas disparadas ([45cdc8b](https://github.com/HectorPOsuna/TIA/commit/45cdc8b323729a4b65a206a4c2dbd7ce489f29a7))

### Corregido

* **backend:** propaga las capacidades de cola a los workers ([3eac4e2](https://github.com/HectorPOsuna/TIA/commit/3eac4e2d744c080d2a32c430d353c3a1c48c195e))

### Documentación

* documenta las reglas reactivas con inferencia ([142333c](https://github.com/HectorPOsuna/TIA/commit/142333cb9c1e4badbdd33eaaed13a575ca2ed2cb))
* segmenta los commits por bloque funcional ([a17616d](https://github.com/HectorPOsuna/TIA/commit/a17616de316783311b64a5e9ba58fe3abe45b39f))

## [1.5.0](https://github.com/HectorPOsuna/TIA/compare/v1.4.0...v1.5.0) (2026-10-22)

### Añadido

* añade control IA en lazo cerrado sobre las predicciones ([85518c0](https://github.com/HectorPOsuna/TIA/commit/85518c0a5f02ffdbda2a4e394994033912aed1cc))
* **backend:** reenvía inference:completed por Socket.IO ([283b32c](https://github.com/HectorPOsuna/TIA/commit/283b32ccd001870e2aac3f389ea641751dc1fd74))
* **frontend:** integra los paneles S8 en el dashboard ([2b769b7](https://github.com/HectorPOsuna/TIA/commit/2b769b73360db128b55f5878672ca50d5163282d))
* **frontend:** modelo IA, eficiencia, pilas y actividad de reglas ([c153d63](https://github.com/HectorPOsuna/TIA/commit/c153d632d45b1accb0a5b0a86237113331abc0b1))

### Corregido

* **frontend:** corrige el historial, el replay y las gráficas de sesión ([3647b57](https://github.com/HectorPOsuna/TIA/commit/3647b576ed2809b8fc455e65bcffc5541eb3f2a5))
* **frontend:** corrige el layout de la barra lateral y las filas del modelo ([c108357](https://github.com/HectorPOsuna/TIA/commit/c10835764e3919264ab99ac5fa9ad70ca4b8ef47))

### Documentación

* documenta los paneles de modelo IA y eficiencia del S8 ([133dc77](https://github.com/HectorPOsuna/TIA/commit/133dc776bf388f85c08fdc34e0abd6cb058298fd))

## [1.4.0](https://github.com/HectorPOsuna/TIA/compare/v1.3.0...v1.4.0) (2026-10-15)

### Añadido

* **backend:** servicio de inferencia IA integrado al EventBus, endpoints y persistencia ([8df129e](https://github.com/HectorPOsuna/TIA/commit/8df129e4b529f65fadb5652dd90206a463c51c0e))
* **ml:** worker Python JSON para inferencia persistente ([7455bb0](https://github.com/HectorPOsuna/TIA/commit/7455bb0018fbd13c3f31ff4fa6f284a1503582aa))

### Corregido

* **inference:** features de inferencia sin target y versionado por hash del modelo ([0fd2f76](https://github.com/HectorPOsuna/TIA/commit/0fd2f7670692d14ddbe28f6377189117cbd12fa4))

### Mantenimiento

* **db:** añade tabla inferences al esquema inicial ([830f553](https://github.com/HectorPOsuna/TIA/commit/830f5534616241b04e362996fc70e23dd3086395))
* **frontend:** sincroniza pnpm-lock con three, fiber y drei ([92b20ad](https://github.com/HectorPOsuna/TIA/commit/92b20ad357e82eb1d7fac9ecc6e712622c9859be))
* **ml:** permitir python -m ml.worker ([21b298f](https://github.com/HectorPOsuna/TIA/commit/21b298fd7416635debbf06b1fd3f5da1d8e4e0da))

### Documentación

* inferencia en vivo S7 (worker, endpoints, EventBus y persistencia) ([fcfdf58](https://github.com/HectorPOsuna/TIA/commit/fcfdf58550ba19918b0f2ceaf3a618cfaf8347d8))

### Pruebas

* **inference:** cubre servicio, persistencia y worker Python; fix config worker ([f35b813](https://github.com/HectorPOsuna/TIA/commit/f35b8137596167eb305e22ab62dcb2a068bddb4c))

## [1.3.0](https://github.com/HectorPOsuna/TIA/compare/v1.2.0...v1.3.0) (2026-10-08)

### Añadido

* **frontend:** dashboard 3D cenital con Three.js y nodos modulares ([17480dd](https://github.com/HectorPOsuna/TIA/commit/17480ddd2afea69b47cd7c76a789b8f7e96bd5aa))
* **frontend:** historial en sesión y replay de temperaturas ([f8e80eb](https://github.com/HectorPOsuna/TIA/commit/f8e80eb61d8c1308fa169e670d1a22f814df847f))

### Mantenimiento

* **frontend:** dependencias three, @react-three/fiber y drei ([e75863d](https://github.com/HectorPOsuna/TIA/commit/e75863d58cdc7879e13131801593c351d639f1de))

### Documentación

* dashboard 3D, replay y arquitectura frontend documentados ([0390705](https://github.com/HectorPOsuna/TIA/commit/0390705c15d5024b22207d8610eab88e0d96a8ad))

## [1.2.0](https://github.com/HectorPOsuna/TIA/compare/v1.1.0...v1.2.0) (2026-10-08)

### Añadido

* **backend:** capa Database estilo PDO (conexión única, inserts preparados y transacciones) ([0baf4b7](https://github.com/HectorPOsuna/TIA/commit/0baf4b710e1c5eff33ea807c3bdb317ecfa8c9f0))
* **backend:** escritor time-series a MariaDB vía EventBus con env DB_* ([3c14a44](https://github.com/HectorPOsuna/TIA/commit/3c14a44312a93408134970798b323ddf15d42fb2))
* **infra:** docker compose con MariaDB 11, phpMyAdmin y esquema time-series ([2f2d410](https://github.com/HectorPOsuna/TIA/commit/2f2d410afa8bd34ee8f80106f9afd9c3e2a062c6))
* **ml:** pipeline analítico S6 (preprocesado, modelo, métricas, anomalías y explicación con Ollama) ([a51cc1c](https://github.com/HectorPOsuna/TIA/commit/a51cc1cfcaea2653cd2e1f80e73dbd54f14f2945))

### Mantenimiento

* ignora ficheros .env locales ([d0c323d](https://github.com/HectorPOsuna/TIA/commit/d0c323d8db797c69356a9d63c57c9fb8af6a1f66))

### Documentación

* capa de base de datos y flujo de .env raíz documentados ([d3783b0](https://github.com/HectorPOsuna/TIA/commit/d3783b08b21fdcc54ab6bd1262c64600d5e4a0e1))
* persistencia time-series documentada (BD vía docker compose) ([fe7f42a](https://github.com/HectorPOsuna/TIA/commit/fe7f42a6902adde81ea8a02730bc49f0ead9d15d))
* pipeline analítico S6 documentado ([783f0d1](https://github.com/HectorPOsuna/TIA/commit/783f0d15ff86f34b12f87213340a27acf6a8b11e))

## [1.1.0](https://github.com/HectorPOsuna/TIA/compare/v1.0.1...v1.1.0) (2026-10-01)

### Añadido

* **backend:** cola de prioridad, pool global y dispatcher ([f14cf89](https://github.com/HectorPOsuna/TIA/commit/f14cf89a6949eb91bf72c12904324ff5f144db0e))
* **backend:** logs en consola, telemetría periódica y peticiones HTTP ([d875f2e](https://github.com/HectorPOsuna/TIA/commit/d875f2e1912cd8210e54e7f70e4dc39f6bb1b747))
* **backend:** persistencia S5 - log JSONL en LOG_FILE y reglas sincronizadas con RULES_FILE ([a6ff7dc](https://github.com/HectorPOsuna/TIA/commit/a6ff7dc0ef8943ce950bbed39e1e8fdaf19be18a))
* **frontend:** pool global y formularios de tarea en la UI ([033994e](https://github.com/HectorPOsuna/TIA/commit/033994e2c747b67a6252c931bf841c00783f570f))

### Documentación

* afina AGENTS.md con contexto de WAItt, release y tags ([20ba8de](https://github.com/HectorPOsuna/TIA/commit/20ba8ded6a9f0d3d0f1f0b2f99fb33b12f0660da))
* documentos de colas, dispatcher, persistencia S5 y AGENTS actualizados ([2763830](https://github.com/HectorPOsuna/TIA/commit/2763830a3e31211882ad58a567bd6ae4cc71eaa8))
* salida a consola y nuevas env de logging documentadas ([4ad1985](https://github.com/HectorPOsuna/TIA/commit/4ad198540f39d019da390c8aae0837150dec48e3))

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