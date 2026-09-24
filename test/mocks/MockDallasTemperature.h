#ifndef MOCK_DALLAS_TEMPERATURE_H
#define MOCK_DALLAS_TEMPERATURE_H

#include <cstdint>
#include <map>
#include "MockOneWire.h"

#define DEVICE_DISCONNECTED_C -127.0f

class MockDallasTemperature {
public:
    explicit MockDallasTemperature(MockOneWire* wire) : wire_(wire) {}
    
    void begin() {}
    void setResolution(const uint8_t* address, uint8_t precision) {
        resolutions_[addressToKey(address)] = precision;
    }
    void requestTemperaturesByAddress(const uint8_t* address) {
        lastRequested_ = addressToKey(address);
    }
    float getTempC(const uint8_t* address) {
        auto key = addressToKey(address);
        auto it = temperatures_.find(key);
        if (it != temperatures_.end()) {
            return it->second;
        }
        return DEVICE_DISCONNECTED_C;
    }
    bool isConnected(const uint8_t* address) {
        auto key = addressToKey(address);
        return temperatures_.find(key) != temperatures_.end();
    }
    uint8_t getDeviceCount() const {
        return temperatures_.size();
    }
    
    void setTemperature(const uint8_t* address, float temp) {
        temperatures_[addressToKey(address)] = temp;
    }
    
    void removeDevice(const uint8_t* address) {
        temperatures_.erase(addressToKey(address));
    }
    
    void clear() {
        temperatures_.clear();
        resolutions_.clear();
    }

private:
    MockOneWire* wire_;
    std::map<std::string, float> temperatures_;
    std::map<std::string, uint8_t> resolutions_;
    std::string lastRequested_;
    
    std::string addressToKey(const uint8_t* address) const {
        char buf[17];
        snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X%02X%02X",
                 address[0], address[1], address[2], address[3],
                 address[4], address[5], address[6], address[7]);
        return std::string(buf);
    }
};

#endif