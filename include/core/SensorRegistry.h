#ifndef SENSOR_REGISTRY_H
#define SENSOR_REGISTRY_H

#include <vector>
#include <string>
#include "SensorReading.h"

class SensorRegistry {
public:
    virtual ~SensorRegistry() = default;

    virtual bool registerSensor(const std::string& id) = 0;
    virtual bool updateReading(const SensorReading& reading) = 0;
    virtual bool getReading(const std::string& id, SensorReading& out) const = 0;
    virtual std::vector<SensorReading> getAllReadings() const = 0;
    virtual std::vector<std::string> getSensorIds() const = 0;
    virtual size_t count() const = 0;
    virtual bool hasSensor(const std::string& id) const = 0;
    virtual void clear() = 0;
};

#endif