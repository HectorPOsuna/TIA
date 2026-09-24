#include "SerialTelemetryPublisher.h"
#include <Arduino.h>
#include <vector>
#include <string>

bool SerialTelemetryPublisher::publish(const SensorReading& reading) {
    Serial.print("{\"id\":\"");
    Serial.print(reading.id.c_str());
    Serial.print("\",");
    
    if (reading.ok) {
        Serial.print("\"temp\":");
        Serial.print(reading.temperature, 2);
        Serial.print(",\"ok\":true");
    } else {
        Serial.print("\"temp\":null,\"ok\":false");
    }
    
    Serial.print(",\"failures\":");
    Serial.print(reading.failures);
    Serial.print(",\"consec_failures\":");
    Serial.print(reading.consecutiveFailures);
    Serial.print(",\"ts\":");
    Serial.print(reading.timestamp);
    Serial.println("}");
    
    return true;
}

bool SerialTelemetryPublisher::publishBatch(const std::vector<SensorReading>& readings) {
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
    
    return true;
}

void SerialTelemetryPublisher::flush() {
    Serial.flush();
}