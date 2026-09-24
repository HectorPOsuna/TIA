#include "SensorManager.h"
#include "config.h"
#include <Arduino.h>

SensorManager::SensorManager(SensorRegistry& registry, ArduinoPlatform& platform)
    : registry_(registry), platform_(platform), bus_(nullptr), sensorCount_(0) {}

SensorManager::~SensorManager() {
    for (auto* driver : drivers_) {
        delete driver;
    }
    delete bus_;
}

bool SensorManager::begin() {
    bus_ = new OneWireBus(platform_.getOneWireBusPin());
    bus_->begin();
    
    discoverSensors();
    return sensorCount_ > 0;
}

void SensorManager::update() {
    for (auto* driver : drivers_) {
        float temp = 0.0f;
        bool ok = driver->read(temp);
        
        SensorReading reading(
            driver->getId(),
            temp,
            ok,
            driver->getFailureCount(),
            driver->getConsecutiveFailures(),
            platform_.millis()
        );
        registry_.updateReading(reading);
    }
}

std::vector<SensorReading> SensorManager::getReadings() const {
    return registry_.getAllReadings();
}

void SensorManager::discoverSensors() {
    for (auto* driver : drivers_) {
        delete driver;
    }
    drivers_.clear();
    sensorCount_ = 0;
    
    uint8_t addr[8];
    while (bus_->search(addr)) {
        if (OneWireBus::crc8(addr, 7) != addr[7]) {
            platform_.serialPrintln("CRC invalido, dispositivo ignorado");
            continue;
        }
        
        if (addr[0] != 0x28) {
            continue;
        }
        
        auto* driver = new DS18B20Driver(bus_, addr, sensorCount_);
        if (driver->begin()) {
            registry_.registerSensor(driver->getId());
            drivers_.push_back(driver);
            sensorCount_++;
        } else {
            delete driver;
        }
    }
    
    bus_->resetSearch();
}

void SensorManager::printAddress(const uint8_t* addr) const {
    for (uint8_t i = 0; i < 8; i++) {
        if (addr[i] < 16) platform_.serialPrint("0");
        platform_.serialPrint(addr[i], 16);
        if (i < 7) platform_.serialPrint(":");
    }
}