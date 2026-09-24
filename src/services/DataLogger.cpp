#include "DataLogger.h"
#include <Arduino.h>
#include <string>

DataLogger::DataLogger(TelemetryPublisher& publisher, SensorRegistry& registry)
    : publisher_(publisher), registry_(registry) {}

void DataLogger::logText() const {
    auto readings = registry_.getAllReadings();
    unsigned long ts = millis();
    
    Serial.print("[");
    Serial.print(ts);
    Serial.print("] ");
    
    for (size_t i = 0; i < readings.size(); ++i) {
        const auto& r = readings[i];
        Serial.print(r.id.c_str());
        Serial.print("=");
        
        if (r.ok) {
            Serial.print(r.temperature, 2);
            Serial.print("C");
        } else {
            Serial.print("ERR");
        }
        
        if (i < readings.size() - 1) {
            Serial.print("  ");
        }
    }
    Serial.println();
}

void DataLogger::logJson() const {
    auto readings = registry_.getAllReadings();
    unsigned long ts = millis();
    
    Serial.print("{\"ts\":");
    Serial.print(ts);
    Serial.print(",\"sensors\":[");
    
    for (size_t i = 0; i < readings.size(); ++i) {
        const auto& r = readings[i];
        Serial.print("{\"id\":\"");
        Serial.print(r.id.c_str());
        Serial.print("\",");
        
        if (r.ok) {
            Serial.print("\"temp\":");
            Serial.print(r.temperature, 2);
            Serial.print(",\"ok\":true");
        } else {
            Serial.print("\"temp\":null,\"ok\":false");
        }
        
        Serial.print(",\"failures\":");
        Serial.print(r.failures);
        Serial.print(",\"consec_failures\":");
        Serial.print(r.consecutiveFailures);
        Serial.print("}");
        
        if (i < readings.size() - 1) {
            Serial.print(",");
        }
    }
    Serial.println("]}");
}