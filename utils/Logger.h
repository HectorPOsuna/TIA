#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>
#include <vector>
#include "sensors/TemperatureSensor.h"

class Logger {
public:
  static void logText(const std::vector<TemperatureSensor*>& sensors) {
    unsigned long ts = millis();
    Serial.print("[");
    Serial.print(ts);
    Serial.print("] ");
    
    for (size_t i = 0; i < sensors.size(); ++i) {
      TemperatureSensor* s = sensors[i];
      Serial.print(s->getId());
      Serial.print("=");
      
      if (s->isConnected()) {
        float temp;
        if (s->readTemperature(temp)) {
          Serial.print(temp, 2);
          Serial.print("C");
        } else {
          Serial.print("ERR");
        }
      } else {
        Serial.print("DESCONECTADO");
      }
      
      if (i < sensors.size() - 1) {
        Serial.print("  ");
      }
    }
    Serial.println();
  }

  static void logJson(const std::vector<TemperatureSensor*>& sensors) {
    unsigned long ts = millis();
    Serial.print("{\"ts\":");
    Serial.print(ts);
    Serial.print(",\"sensors\":[");
    
    for (size_t i = 0; i < sensors.size(); ++i) {
      TemperatureSensor* s = sensors[i];
      Serial.print("{\"id\":\"");
      Serial.print(s->getId());
      Serial.print("\",");
      
      if (s->isConnected()) {
        float temp;
        bool ok = s->readTemperature(temp);
        Serial.print("\"temp\":");
        Serial.print(ok ? String(temp, 2) : "null");
        Serial.print(",\"ok\":");
        Serial.print(ok ? "true" : "false");
      } else {
        Serial.print("\"temp\":null,\"ok\":false");
      }
      
      Serial.print(",\"failures\":");
      Serial.print(s->getFailureCount());
      Serial.print(",\"consec_failures\":");
      Serial.print(s->getConsecutiveFailures());
      Serial.print("}");
      
      if (i < sensors.size() - 1) {
        Serial.print(",");
      }
    }
    Serial.println("]}");
  }
};

#endif