#include "OneWireBus.h"
#include <OneWire.h>

OneWireBus::OneWireBus(PinNumber pin) : pin_(pin), oneWire_(nullptr) {
    oneWire_ = new OneWire(pin);
}

OneWireBus::~OneWireBus() {
    delete static_cast<OneWire*>(oneWire_);
}

void OneWireBus::begin() {
    static_cast<OneWire*>(oneWire_)->begin(pin_);
}

void OneWireBus::resetSearch() {
    static_cast<OneWire*>(oneWire_)->reset_search();
}

bool OneWireBus::search(uint8_t* address) {
    return static_cast<OneWire*>(oneWire_)->search(address);
}

uint8_t OneWireBus::crc8(const uint8_t* addr, uint8_t len) {
    return OneWire::crc8(addr, len);
}

void OneWireBus::reset() {
    static_cast<OneWire*>(oneWire_)->reset();
}

void OneWireBus::select(const uint8_t* address) {
    static_cast<OneWire*>(oneWire_)->select(address);
}

void OneWireBus::write(uint8_t data, bool power) {
    static_cast<OneWire*>(oneWire_)->write(data, power);
}

uint8_t OneWireBus::read() {
    return static_cast<OneWire*>(oneWire_)->read();
}

void OneWireBus::writeBytes(const uint8_t* data, uint8_t len) {
    static_cast<OneWire*>(oneWire_)->write_bytes(data, len);
}

void OneWireBus::readBytes(uint8_t* data, uint8_t len) {
    static_cast<OneWire*>(oneWire_)->read_bytes(data, len);
}

void* OneWireBus::getOneWire() const {
    return oneWire_;
}