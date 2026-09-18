#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <OneWire.h>
#include <DallasTemperature.h>
#include <vector>
#include "DS18B20Sensor.h"
#include "TemperatureSensor.h"

class SensorManager {
private:
  OneWire* oneWire;
  DallasTemperature* dallas;
  std::vector<DS18B20Sensor*> sensors;
  uint8_t sensorCount;

public:
  SensorManager() : oneWire(nullptr), dallas(nullptr), sensorCount(0) {}

  ~SensorManager() {
    for (auto s : sensors) {
      delete s;
    }
    delete dallas;
    delete oneWire;
  }

  bool begin() {
    oneWire = new OneWire(ONE_WIRE_BUS);
    dallas = new DallasTemperature(oneWire);
    dallas->begin();
    
    discoverSensors();
    return sensorCount > 0;
  }

  void update() {
    for (auto sensor : sensors) {
      float temp;
      sensor->readTemperature(temp);
    }
  }

  std::vector<TemperatureSensor*> getSensors() {
    std::vector<TemperatureSensor*> result;
    for (auto s : sensors) {
      result.push_back(static_cast<TemperatureSensor*>(s));
    }
    return result;
  }

  uint8_t getSensorCount() const {
    return sensorCount;
  }

  DS18B20Sensor* getSensor(uint8_t index) {
    if (index < sensors.size()) {
      return sensors[index];
    }
    return nullptr;
  }

  void printDiscoveryInfo() {
    Serial.print("Sensores encontrados: ");
    Serial.println(sensorCount);
    for (uint8_t i = 0; i < sensorCount; ++i) {
      Serial.print("  [");
      Serial.print(i);
      Serial.print("] ");
      Serial.print(sensors[i]->getId());
      Serial.print(" - ");
      printAddress(sensors[i]->getAddress());
      Serial.println();
    }
  }

private:
  void discoverSensors() {
    sensors.clear();
    sensorCount = 0;
    
    DeviceAddress addr;
    while (oneWire->search(addr)) {
      if (OneWire::crc8(addr, 7) != addr[7]) {
        Serial.println("CRC invalido, dispositivo ignorado");
        continue;
      }
      
      if (addr[0] != 0x28) {
        continue;
      }
      
      DS18B20Sensor* sensor = new DS18B20Sensor(oneWire, addr, sensorCount);
      if (sensor->begin()) {
        sensors.push_back(sensor);
        sensorCount++;
      } else {
        delete sensor;
      }
    }
    
    oneWire->reset_search();
  }

  void printAddress(const DeviceAddress* addr) {
    for (uint8_t i = 0; i < 8; i++) {
      if ((*addr)[i] < 16) Serial.print("0");
      Serial.print((*addr)[i], HEX);
      if (i < 7) Serial.print(":");
    }
  }
};

#endif