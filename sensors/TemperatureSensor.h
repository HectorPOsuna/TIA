#ifndef TEMPERATURE_SENSOR_H
#define TEMPERATURE_SENSOR_H

#include <Arduino.h>

class TemperatureSensor {
public:
  virtual ~TemperatureSensor() = default;
  virtual bool begin() = 0;
  virtual bool readTemperature(float& temp) = 0;
  virtual String getId() const = 0;
  virtual bool isConnected() const = 0;
  virtual uint8_t getFailureCount() const = 0;
  virtual uint8_t getConsecutiveFailures() const = 0;
};

#endif