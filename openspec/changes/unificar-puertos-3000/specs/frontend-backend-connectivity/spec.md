# Spec Delta

## Purpose

Define la conexión local entre el frontend y el backend de WAItt, de modo que el proxy de desarrollo, el puerto HTTP/WebSocket del backend y CORS usen valores coherentes y la simulación arranque sin errores de conexión.

## ADDED Requirements

### Requirement: Proxy de desarrollo apunta al puerto por defecto del backend

El proxy de desarrollo SHALL dirigir `/api` y `/socket.io` al backend en el puerto `3000` cuando no se haya configurado otro puerto a propósito.

#### Scenario: Arranque con valores por defecto

- **WHEN** se inicia el backend sin configuración de puerto y se abre el frontend en modo desarrollo
- **THEN** las peticiones a `/api` y la conexión WebSocket llegan al backend en `3000` sin `ECONNREFUSED`

#### Scenario: Consulta de salud a través del proxy

- **WHEN** el frontend solicita `GET /api/system` usando la ruta relativa del proxy
- **THEN** la respuesta es `200` y contiene el estado de la simulación

### Requirement: Origen permitido por CORS

El backend SHALL permitir solicitudes desde el origen del frontend en `http://localhost:5173` cuando se usa la configuración por defecto.

#### Scenario: Petición desde el frontend

- **WHEN** el frontend en `http://localhost:5173` consume la API del backend
- **THEN** el navegador acepta la respuesta sin error de CORS

#### Scenario: Cambio intencional del puerto del frontend

- **WHEN** se cambia el puerto del frontend
- **THEN** `CORS_ORIGIN` debe actualizarse al nuevo origen antes de que el navegador acepte las respuestas

### Requirement: Documentación coherente de puertos

La documentación SHALL presentar `3000` como puerto por defecto del backend y SHALL NO recomendar mezclar un backend en `3000` con un proxy en `3001`.

#### Scenario: Consulta de la guía rápida

- **WHEN** una persona sigue las instrucciones de arranque de las guías del proyecto
- **THEN** el puerto mostrado para el backend y el del proxy coincide en `3000`

#### Scenario: Cambio de puerto voluntario

- **WHEN** una persona decide usar un puerto distinto
- **THEN** la guía indica cambiar a la vez el puerto del backend y el target del proxy, manteniendo CORS en el origen del frontend
