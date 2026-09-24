#ifndef SERIAL_TELEMETRY_PUBLISHER_H
#define SERIAL_TELEMETRY_PUBLISHER_H

#include "core/TelemetryPublisher.h"
#include "core/SensorReading.h"

class SerialTelemetryPublisher : public TelemetryPublisher {
public:
    bool publish(const SensorReading& reading) override;
    bool publishBatch(const std::vector<SensorReading>& readings) override;
    void flush() override;
};

#endif