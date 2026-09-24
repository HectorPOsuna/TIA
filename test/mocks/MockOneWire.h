#ifndef MOCK_ONEWIRE_H
#define MOCK_ONEWIRE_H

#include <cstdint>
#include <vector>
#include <cstring>

class MockOneWire {
public:
    MockOneWire(uint8_t pin = 2) : pin_(pin), searchIndex_(0) {}

    void begin(uint8_t pin = 2) { pin_ = pin; }
    void reset_search() { searchIndex_ = 0; }
    
    bool search(uint8_t* address) {
        if (searchIndex_ >= devices_.size()) {
            return false;
        }
        std::memcpy(address, devices_[searchIndex_].data(), 8);
        searchIndex_++;
        return true;
    }
    
    static uint8_t crc8(const uint8_t* addr, uint8_t len) {
        uint8_t crc = 0;
        for (uint8_t i = 0; i < len; i++) {
            uint8_t inbyte = addr[i];
            for (uint8_t j = 0; j < 8; j++) {
                uint8_t mix = (crc ^ inbyte) & 0x01;
                crc >>= 1;
                if (mix) crc ^= 0x8C;
                inbyte >>= 1;
            }
        }
        return crc;
    }
    
    void reset() {}
    void select(const uint8_t* address) {}
    void write(uint8_t data, bool power = false) {}
    uint8_t read() { return 0; }
    void write_bytes(const uint8_t* data, uint8_t len) {}
    void read_bytes(uint8_t* data, uint8_t len) {}
    
    void addDevice(const std::array<uint8_t, 8>& addr) {
        devices_.push_back(addr);
    }
    
    void clearDevices() {
        devices_.clear();
        searchIndex_ = 0;
    }

private:
    uint8_t pin_;
    size_t searchIndex_;
    std::vector<std::array<uint8_t, 8>> devices_;
};

#endif