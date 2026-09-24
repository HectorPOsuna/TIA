#include "config.h"
#include "services/SensorManager.h"
#include "services/ArduinoSensorRegistry.h"
#include "services/DataLogger.h"
#include "services/SerialTelemetryPublisher.h"
#include "platform/ArduinoPlatform.h"

ArduinoPlatform platform;
ArduinoSensorRegistry registry;
SerialTelemetryPublisher publisher;
SensorManager sensorManager(registry, platform);
DataLogger dataLogger(publisher, registry);

unsigned long lastRead = 0;

void setup() {
  platform.serialBegin(SERIAL_BAUD);
  while (platform.serialAvailable() < 0) {
    ;
  }
  
  platform.serialPrintln("=== Iniciando Sistema de Monitoreo Termico ===");
  platform.serialPrint("Pin 1-Wire: D");
  platform.serialPrintln(ONE_WIRE_BUS);
  platform.serialPrint("Precision: ");
  platform.serialPrint(TEMPERATURE_PRECISION);
  platform.serialPrintln(" bits");
  platform.serialPrint("Intervalo lectura: ");
  platform.serialPrint(READ_INTERVAL_MS);
  platform.serialPrintln(" ms");
  platform.serialPrint("Formato salida: ");
  platform.serialPrintln(OUTPUT_FORMAT_JSON ? "JSON" : "Texto plano");
  platform.serialPrintln("------------------------------------------------");
  
  if (sensorManager.begin()) {
    auto readings = sensorManager.getReadings();
    for (const auto& r : readings) {
      platform.serialPrint("  [");
      platform.serialPrint(r.id.c_str());
      platform.serialPrintln("]");
    }
  } else {
    platform.serialPrintln("ERROR: No se encontraron sensores DS18B20");
    platform.serialPrintln("Verifique conexiones y resistencia pull-up 4.7k");
  }
  platform.serialPrintln("------------------------------------------------");
}

void loop() {
  if (platform.millis() - lastRead >= READ_INTERVAL_MS) {
    lastRead = platform.millis();
    
    sensorManager.update();
    
    #if OUTPUT_FORMAT_JSON
      dataLogger.logJson();
    #else
      dataLogger.logText();
    #endif
  }
}