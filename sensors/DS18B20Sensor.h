#ifndef DS18B20_SENSOR_H
#define DS18B20_SENSOR_H

#include <OneWire.h>
#include <DallasTemperature.h>
#include "TemperatureSensor.h"

class DS18B20Sensor : public TemperatureSensor {
private:
  OneWire* oneWire;
  DallasTemperature* dallas;
  DeviceAddress address;
  uint8_t index;
  String id;
  bool connected;
  uint8_t failureCount;
  uint8_t consecutiveFailures;
  float lastTemperature;
  bool lastReadValid;

public:
  DS18B20Sensor(OneWire* ow, DeviceAddress addr, uint8_t idx)
    : oneWire(ow), address{}, index(idx), connected(false),
      failureCount(0), consecutiveFailures(0), lastTemperature(0), lastReadValid(false) {
    
    memcpy(this->address, addr, 8);
    dallas = new DallasTemperature(oneWire);
    id = "DS18B20_" + String(index) + "_" + getAddressSuffix();
  }

  ~DS18B20Sensor() {
    delete dallas;
  }

  bool begin() override {
    dallas->begin();
    dallas->setResolution(address, TEMPERATURE_PRECISION);
    
    if (dallas->getDeviceCount() > 0 && dallas->isConnected(address)) {
      connected = true;
      consecutiveFailures = 0;
      return true;
    }
    connected = false;
    return false;
  }

  bool readTemperature(float& temp) override {
    if (!connected) {
      return false;
    }

    dallas->requestTemperaturesByAddress(address);
    float t = dallas->getTempC(address);

    if (t == DEVICE_DISCONNECTED_C || t == -127.0f || t == 85.0f) {
      handleFailure();
      return false;
    }

    lastTemperature = t;
    lastReadValid = true;
    consecutiveFailures = 0;
    temp = t;
    return true;
  }

  String getId() const override {
    return id;
  }

  bool isConnected() const override {
    return connected;
  }

  uint8_t getFailureCount() const override {
    return failureCount;
  }

  uint8_t getConsecutiveFailures() const override {
    return consecutiveFailures;
  }

  float getLastTemperature() const {
    return lastTemperature;
  }

  bool hasValidReading() const {
    return lastReadValid;
  }

  const DeviceAddress* getAddress() const {
    return &address;
  }

private:
  String getAddressSuffix() const {
    char buf[9];
    sprintf(buf, "%02X%02X%02X%02X", address[4], address[5], address[6], address[7]);
    return String(buf);
  }

  void handleFailure() {
    failureCount++;
    consecutiveFailures++;
    lastReadValid = false;
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      connected = false;
    }
  }
};

#endif