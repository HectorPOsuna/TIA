#ifndef DATA_LOGGER_H
#define DATA_LOGGER_H

#include <vector>
#include "core/SensorRegistry.h"
#include "core/TelemetryPublisher.h"
#include "core/SensorReading.h"

class DataLogger {
public:
    DataLogger(TelemetryPublisher& publisher, SensorRegistry& registry);
    ~DataLogger() = default;

    void logText() const;
    void logJson() const;

private:
    TelemetryPublisher& publisher_;
    SensorRegistry& registry_;
};

#endif