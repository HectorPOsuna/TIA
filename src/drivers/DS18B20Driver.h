#ifndef DS18B20_DRIVER_H
#define DS18B20_DRIVER_H

#include <string>
#include <cstdint>
#include "ISensorDriver.h"
#include "OneWireBus.h"

class DS18B20Driver : public ISensorDriver {
public:
    DS18B20Driver(OneWireBus* bus, const uint8_t* address, uint8_t index);
    ~DS18B20Driver();

    bool begin() override;
    bool read(float& temperature) override;
    std::string getId() const override;
    bool isConnected() const override;
    uint8_t getFailureCount() const override;
    uint8_t getConsecutiveFailures() const override;

private:
    std::string addressToString(const uint8_t* addr) const;
    void handleFailure();

    OneWireBus* bus_;
    uint8_t address_[8];
    uint8_t index_;
    std::string id_;
    bool connected_;
    uint8_t failureCount_;
    uint8_t consecutiveFailures_;
    float lastTemperature_;
    bool lastReadValid_;
    void* dallasTemp_;
};

#endif