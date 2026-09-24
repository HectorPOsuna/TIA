#ifndef ARDUINO_SENSOR_REGISTRY_H
#define ARDUINO_SENSOR_REGISTRY_H

#include <vector>
#include <string>
#include <unordered_map>
#include "core/SensorRegistry.h"
#include "core/SensorReading.h"

class ArduinoSensorRegistry : public SensorRegistry {
public:
    bool registerSensor(const std::string& id) override;
    bool updateReading(const SensorReading& reading) override;
    bool getReading(const std::string& id, SensorReading& out) const override;
    std::vector<SensorReading> getAllReadings() const override;
    std::vector<std::string> getSensorIds() const override;
    size_t count() const override;
    bool hasSensor(const std::string& id) const override;
    void clear() override;

private:
    std::unordered_map<std::string, SensorReading> readings_;
};

#endif