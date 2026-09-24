#include "DS18B20Driver.h"
#include "config.h"
#include <DallasTemperature.h>
#include <cstring>
#include <cstdio>

DS18B20Driver::DS18B20Driver(OneWireBus* bus, const uint8_t* address, uint8_t index)
    : bus_(bus), index_(index), connected_(false), failureCount_(0), 
      consecutiveFailures_(0), lastTemperature_(0.0f), lastReadValid_(false), dallasTemp_(nullptr) {
    
    std::memcpy(address_, address, 8);
    dallasTemp_ = new DallasTemperature(static_cast<OneWire*>(bus_->getOneWire()));
    
    char idxStr[4];
    snprintf(idxStr, sizeof(idxStr), "%d", index_);
    id_ = "DS18B20_" + std::string(idxStr) + "_" + addressToString(address_ + 4);
}

DS18B20Driver::~DS18B20Driver() {
    delete static_cast<DallasTemperature*>(dallasTemp_);
}

bool DS18B20Driver::begin() {
    auto* dallas = static_cast<DallasTemperature*>(dallasTemp_);
    dallas->begin();
    dallas->setResolution(address_, TEMPERATURE_PRECISION);
    
    if (dallas->getDeviceCount() > 0 && dallas->isConnected(address_)) {
        connected_ = true;
        consecutiveFailures_ = 0;
        return true;
    }
    connected_ = false;
    return false;
}

bool DS18B20Driver::read(float& temperature) {
    if (!connected_) {
        return false;
    }

    auto* dallas = static_cast<DallasTemperature*>(dallasTemp_);
    dallas->requestTemperaturesByAddress(address_);
    float t = dallas->getTempC(address_);

    if (t == DEVICE_DISCONNECTED_C || t == -127.0f || t == 85.0f) {
        handleFailure();
        return false;
    }

    lastTemperature_ = t;
    lastReadValid_ = true;
    consecutiveFailures_ = 0;
    temperature = t;
    return true;
}

std::string DS18B20Driver::getId() const {
    return id_;
}

bool DS18B20Driver::isConnected() const {
    return connected_;
}

uint8_t DS18B20Driver::getFailureCount() const {
    return failureCount_;
}

uint8_t DS18B20Driver::getConsecutiveFailures() const {
    return consecutiveFailures_;
}

std::string DS18B20Driver::addressToString(const uint8_t* addr) const {
    char buf[9];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X", addr[0], addr[1], addr[2], addr[3]);
    return std::string(buf);
}

void DS18B20Driver::handleFailure() {
    failureCount_++;
    consecutiveFailures_++;
    lastReadValid_ = false;
    
    if (consecutiveFailures_ >= MAX_CONSECUTIVE_FAILURES) {
        connected_ = false;
    }
}