# TIA - Sistema de Monitoreo Térmico con Arduino

Sistema para lectura de múltiples sensores de temperatura DS18B20 conectados en bus 1-Wire, con salida en consola serie (texto plano o JSON).

## Características

- **Detección automática** de sensores DS18B20 al inicio
- **Lectura periódica** configurable (por defecto 2 segundos)
- **Salida dual**: texto plano legible o JSON estructurado
- **Manejo robusto de errores**: reintentos, conteo de fallos, marca de desconectado
- **Compatible** con Arduino Uno / Nano

## Hardware Requerido

| Componente | Cantidad | Notas |
|------------|----------|-------|
| Arduino Uno / Nano | 1 | |
| DS18B20 (waterproof o TO-92) | 2-4 | Código familia 0x28 |
| Resistencia 4.7kΩ | 1 | Pull-up entre DQ y VCC |
| Protoboard / cables | - | |

## Esquemático de Conexiones

```
                    DS18B20 (x2-4)
                   ┌─────┐
            5V  ───┤ VDD │
                   │     │
            D2  ───┤ DQ  │───┬── 4.7kΩ ── 5V
                   │     │   │
            GND ───┤ GND │   │
                   └─────┘   │
                             │
         Arduino Uno/Nano    │
       ┌─────────────────────┤
       │  5V  ───────────────┘
       │  GND ───────────────┘
       │  D2  (1-Wire Bus)
       └─────────────────────┘
```

**Importante**: La resistencia pull-up de 4.7kΩ entre DQ y VCC es **obligatoria** para comunicación 1-Wire estable.

## Librerías Necesarias

Instalar desde el Gestor de Librerías de Arduino IDE:

1. **OneWire** por Paul Stoffregen
2. **DallasTemperature** por Miles Burton

## Configuración

Edita `config.h` para ajustar parámetros:

```cpp
#define ONE_WIRE_BUS 2                 // Pin digital para bus 1-Wire
#define TEMPERATURE_PRECISION 12       // Resolución 9-12 bits (0.5°C a 0.0625°C)
#define READ_INTERVAL_MS 2000          // Intervalo entre lecturas (ms)
#define MAX_RETRIES 3                  // Reintentos por lectura fallida
#define MAX_CONSECUTIVE_FAILURES 5     // Fallos consecutivos para marcar desconectado
#define OUTPUT_FORMAT_JSON false       // true = JSON, false = Texto plano
#define SERIAL_BAUD 115200             // Baudrate monitor serie
```

## Formato de Salida

### Texto Plano (`OUTPUT_FORMAT_JSON = false`)

```
[123456] DS18B20_0_A1B2=23.44C  DS18B20_1_C3D4=24.12C  DS18B20_2_E5F6=DESCONECTADO
```

- Timestamp en ms desde inicio (`millis()`)
- ID del sensor + temperatura con 2 decimales
- `DESCONECTADO` si supera `MAX_CONSECUTIVE_FAILURES`

### JSON (`OUTPUT_FORMAT_JSON = true`)

```json
{"ts":123456,"sensors":[
  {"id":"DS18B20_0_A1B2","temp":23.44,"ok":true,"failures":0,"consec_failures":0},
  {"id":"DS18B20_1_C3D4","temp":24.12,"ok":true,"failures":0,"consec_failures":0},
  {"id":"DS18B20_2_E5F6","temp":null,"ok":false,"failures":12,"consec_failures":5}
]}
```

Campos:
- `ts`: timestamp (ms)
- `id`: identificador único (índice + 4 últimos bytes ROM)
- `temp`: temperatura en °C o `null` si error
- `ok`: `true` si lectura válida
- `failures`: total de fallos acumulados
- `consec_failures`: fallos consecutivos actuales

## Estructura del Proyecto

```
TIA/
├── TIA.ino                    # Programa principal
├── config.h                   # Configuración central
├── sensors/
│   ├── TemperatureSensor.h    # Interfaz base
│   ├── DS18B20Sensor.h        # Driver DS18B20
│   └── SensorManager.h        # Gestor multi-sensor
└── utils/
    └── Logger.h               # Formateo salida (texto/JSON)
```

## Uso

1. Abre `TIA.ino` en Arduino IDE
2. Instala las librerías requeridas
3. Selecciona tu placa (Arduino Uno / Nano) y puerto
4. Compila y sube
5. Abre **Monitor Serie** a **115200 baud**
6. Observa las lecturas periódicas

## Manejo de Errores

| Situación | Comportamiento |
|-----------|----------------|
| CRC inválido en descubrimiento | Sensor ignorado, mensaje en consola |
| Lectura = -127°C / 85°C / DEVICE_DISCONNECTED | Incrementa contadores de fallo |
| `consec_failures >= MAX_CONSECUTIVE_FAILURES` | Sensor marcado `DESCONECTADO` |
| Lectura exitosa tras fallos | Contadores de fallo consecutivo a 0 |

## Extensibilidad

La interfaz `TemperatureSensor` permite añadir otros tipos de sensores (LM35, termistores, etc.) implementando la misma API. El `SensorManager` gestiona cualquier sensor que herede de `TemperatureSensor`.

## Licencia

MIT