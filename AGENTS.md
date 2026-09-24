# AGENTS.md - TIA Arduino Temperature Monitoring

## Project Type
PlatformIO project for DS18B20 temperature sensors (1-Wire bus) on Arduino Uno/Nano.

## Build & Run
- `pio run -e uno` — compile
- `pio run -e uno -t upload` — upload to board
- `pio device monitor -b 115200` — open Serial Monitor
- `pio test -e native_test` — run unit tests (requires gcc/MinGW)

## Key Files
| File | Purpose |
|------|---------|
| `src/main.ino` | Entry point: setup, loop, periodic reads |
| `src/config.h` | All tunable params (pin, precision, interval, JSON toggle) |
| `src/core/` | Pure C++ interfaces (no Arduino deps) — SensorReading, SensorRegistry, TelemetryPublisher, ISensorDriver |
| `src/platform/` | Arduino abstraction — ArduinoPlatform, PlatformTypes |
| `src/drivers/` | Hardware abstraction — OneWireBus, DS18B20Driver |
| `src/services/` | Application services — SensorManager, DataLogger, ArduinoSensorRegistry, SerialTelemetryPublisher |
| `test/` | Unit tests with Unity + mocks |

## Config (edit `src/config.h`)
```cpp
#define ONE_WIRE_BUS 2              // Pin D2
#define TEMPERATURE_PRECISION 12    // 9-12 bits
#define READ_INTERVAL_MS 2000       // Read interval
#define MAX_RETRIES 3               // Retries per read
#define MAX_CONSECUTIVE_FAILURES 5  // Mark disconnected after N fails
#define OUTPUT_FORMAT_JSON false    // true = JSON, false = text
#define SERIAL_BAUD 115200
```

## Hardware
- 2-4× DS18B20 (waterproof or TO-92)
- 1× 4.7kΩ pull-up between DQ and VCC (required)
- Wiring: VCC→5V, GND→GND, DQ→D2 + pull-up to 5V

## Output Formats
**Text:** `[timestamp] DS18B20_0_AB12=23.44C  DS18B20_1_CD34=DESCONECTADO`  
**JSON:** `{"ts":1234,"sensors":[{"id":"DS18B20_0_AB12","temp":23.44,"ok":true,...}]}`

## Commit Convention
**All commits in Spanish** (imperative mood): `feat: ...`, `fix: ...`, `docs: ...`, `init: ...`

## Architecture Notes
- **Layered architecture**: `core/` (interfaces) → `platform/` (Arduino) → `drivers/` (HW) → `services/` (app logic)
- Dependency injection: services receive interfaces, not concrete types
- `core/` compiles on host for unit tests; `platform/`/`drivers/` are Arduino-specific
- Auto-discovery runs once in `begin()` via `OneWire::search()`; ignores invalid CRC / non-0x28 family
- Failure handling: increments `consecutiveFailures` on bad read (-127°C, 85°C, disconnected); marks `connected=false` after `MAX_CONSECUTIVE_FAILURES`; resets on success
- ArduinoSTL provides std::vector, std::map, std::string on AVR

## PlatformIO Environments
- `uno` — Arduino Uno target (AVR)
- `native_test` — Host unit tests with Unity (requires gcc)