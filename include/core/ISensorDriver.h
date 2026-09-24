#ifndef I_SENSOR_DRIVER_H
#define I_SENSOR_DRIVER_H

#include <string>
#include <cstdint>

class ISensorDriver {
public:
    virtual ~ISensorDriver() = default;
    virtual bool begin() = 0;
    virtual bool read(float& temperature) = 0;
    virtual std::string getId() const = 0;
    virtual bool isConnected() const = 0;
    virtual uint8_t getFailureCount() const = 0;
    virtual uint8_t getConsecutiveFailures() const = 0;
};

#endif