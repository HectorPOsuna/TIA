#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <vector>
#include "core/ISensorDriver.h"
#include "core/SensorRegistry.h"
#include "core/SensorReading.h"
#include "platform/ArduinoPlatform.h"
#include "drivers/OneWireBus.h"
#include "drivers/DS18B20Driver.h"

class SensorManager {
public:
    SensorManager(SensorRegistry& registry, ArduinoPlatform& platform);
    ~SensorManager();

    bool begin();
    void update();
    std::vector<SensorReading> getReadings() const;

private:
    void discoverSensors();
    void printAddress(const uint8_t* addr) const;

    SensorRegistry& registry_;
    ArduinoPlatform& platform_;
    OneWireBus* bus_;
    std::vector<ISensorDriver*> drivers_;
    uint8_t sensorCount_;
};

#endif