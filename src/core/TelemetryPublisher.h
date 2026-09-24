#ifndef TELEMETRY_PUBLISHER_H
#define TELEMETRY_PUBLISHER_H

#include "SensorReading.h"

class TelemetryPublisher {
public:
    virtual ~TelemetryPublisher() = default;
    virtual bool publish(const SensorReading& reading) = 0;
    virtual bool publishBatch(const std::vector<SensorReading>& readings) = 0;
    virtual void flush() = 0;
};

#endif