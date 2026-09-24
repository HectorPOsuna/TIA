#ifndef SENSOR_READING_H
#define SENSOR_READING_H

#include <string>
#include <cstdint>

struct SensorReading {
    std::string id;
    float temperature;
    bool ok;
    uint8_t failures;
    uint8_t consecutiveFailures;
    uint32_t timestamp;

    SensorReading() 
        : temperature(0.0f), ok(false), failures(0), consecutiveFailures(0), timestamp(0) {}

    SensorReading(const std::string& id_, float temp_, bool ok_, uint8_t fail_, uint8_t consec_, uint32_t ts_)
        : id(id_), temperature(temp_), ok(ok_), failures(fail_), consecutiveFailures(consec_), timestamp(ts_) {}

    bool isValid() const {
        return ok && failures < 255;
    }
};

#endif