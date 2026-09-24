#ifndef MOCK_PLATFORM_H
#define MOCK_PLATFORM_H

#include <cstdint>
#include <string>
#include <vector>
#include "src/platform/PlatformTypes.h"

class MockPlatform {
public:
    MockPlatform() : millis_(0) {}
    
    Millis millis() const { return millis_; }
    void advanceMillis(Millis ms) { millis_ += ms; }
    void setMillis(Millis ms) { millis_ = ms; }
    
    void delay(Millis ms) const { millis_ += ms; }
    void delayMicroseconds(uint32_t us) const {}
    
    void serialBegin(uint32_t baud) { lastBaud_ = baud; }
    void serialEnd() {}
    int serialAvailable() const { return 0; }
    int serialRead() const { return -1; }
    std::size_t serialWrite(uint8_t c) { return 1; }
    std::size_t serialPrint(const char* str) { 
        serialOutput_ += str; 
        return strlen(str); 
    }
    std::size_t serialPrintln(const char* str) { 
        serialOutput_ += str; 
        serialOutput_ += "\n"; 
        return strlen(str) + 1; 
    }
    std::size_t serialPrint(float val, int digits) { 
        char buf[32];
        snprintf(buf, sizeof(buf), "%.*f", digits, val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrintln(float val, int digits) { 
        char buf[32];
        snprintf(buf, sizeof(buf), "%.*f\n", digits, val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrint(int val) { 
        char buf[16];
        snprintf(buf, sizeof(buf), "%d", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrintln(int val) { 
        char buf[16];
        snprintf(buf, sizeof(buf), "%d\n", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrint(unsigned int val) { 
        char buf[16];
        snprintf(buf, sizeof(buf), "%u", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrintln(unsigned int val) { 
        char buf[16];
        snprintf(buf, sizeof(buf), "%u\n", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrint(unsigned long val) { 
        char buf[24];
        snprintf(buf, sizeof(buf), "%lu", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    std::size_t serialPrintln(unsigned long val) { 
        char buf[24];
        snprintf(buf, sizeof(buf), "%lu\n", val);
        serialOutput_ += buf;
        return strlen(buf);
    }
    
    uint8_t getOneWireBusPin() const { return 2; }
    
    std::string getSerialOutput() const { return serialOutput_; }
    void clearSerialOutput() { serialOutput_.clear(); }
    uint32_t getLastBaud() const { return lastBaud_; }

private:
    mutable Millis millis_;
    mutable std::string serialOutput_;
    uint32_t lastBaud_ = 0;
};

#endif