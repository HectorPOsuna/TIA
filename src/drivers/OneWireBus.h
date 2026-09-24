#ifndef ONE_WIRE_BUS_H
#define ONE_WIRE_BUS_H

#include <cstdint>
#include "PlatformTypes.h"

class OneWireBus {
public:
    explicit OneWireBus(PinNumber pin);
    ~OneWireBus();

    void begin();
    void resetSearch();
    bool search(uint8_t* address);
    static uint8_t crc8(const uint8_t* addr, uint8_t len);
    void reset();
    void select(const uint8_t* address);
    void write(uint8_t data, bool power = false);
    uint8_t read();
    void writeBytes(const uint8_t* data, uint8_t len);
    void readBytes(uint8_t* data, uint8_t len);
    void* getOneWire() const;

private:
    PinNumber pin_;
    void* oneWire_;
};

#endif