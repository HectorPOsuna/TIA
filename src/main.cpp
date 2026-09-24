#include "config.h"
#include "sensors/SensorManager.h"
#include "utils/Logger.h"

SensorManager sensorManager;
unsigned long lastRead = 0;

void setup() {
  Serial.begin(SERIAL_BAUD);
  while (!Serial) {
    ;
  }
  
  Serial.println(F("=== Iniciando Sistema de Monitoreo Termico ==="));
  Serial.print(F("Pin 1-Wire: D"));
  Serial.println(ONE_WIRE_BUS);
  Serial.print(F("Precision: "));
  Serial.print(TEMPERATURE_PRECISION);
  Serial.println(F(" bits"));
  Serial.print(F("Intervalo lectura: "));
  Serial.print(READ_INTERVAL_MS);
  Serial.println(F(" ms"));
  Serial.print(F("Formato salida: "));
  Serial.println(OUTPUT_FORMAT_JSON ? F("JSON") : F("Texto plano"));
  Serial.println(F("------------------------------------------------"));
  
  if (sensorManager.begin()) {
    sensorManager.printDiscoveryInfo();
  } else {
    Serial.println(F("ERROR: No se encontraron sensores DS18B20"));
    Serial.println(F("Verifique conexiones y resistencia pull-up 4.7k"));
  }
  Serial.println(F("------------------------------------------------"));
}

void loop() {
  if (millis() - lastRead >= READ_INTERVAL_MS) {
    lastRead = millis();
    
    sensorManager.update();
    
    auto sensors = sensorManager.getSensors();
    
    #if OUTPUT_FORMAT_JSON
      Logger::logJson(sensors);
    #else
      Logger::logText(sensors);
    #endif
  }
}