#ifndef ARDUINO_PLATFORM_H
#define ARDUINO_PLATFORM_H

#include "PlatformTypes.h"
#include <cstddef>

class ArduinoPlatform {
public:
    ArduinoPlatform() = default;
    virtual ~ArduinoPlatform() = default;

    virtual Millis millis() const;
    virtual void delay(Millis ms) const;
    virtual void delayMicroseconds(uint32_t us) const;
    
    virtual void serialBegin(BaudRate baud) const;
    virtual void serialEnd() const;
    virtual int serialAvailable() const;
    virtual int serialRead() const;
    virtual std::size_t serialWrite(uint8_t c) const;
    virtual std::size_t serialPrint(const char* str) const;
    virtual std::size_t serialPrintln(const char* str) const;
    virtual std::size_t serialPrint(float val, int digits) const;
    virtual std::size_t serialPrintln(float val, int digits) const;
    virtual std::size_t serialPrint(int val) const;
    virtual std::size_t serialPrintln(int val) const;
    virtual std::size_t serialPrint(unsigned int val) const;
    virtual std::size_t serialPrintln(unsigned int val) const;
    virtual std::size_t serialPrint(unsigned long val) const;
    virtual std::size_t serialPrintln(unsigned long val) const;
    
    virtual PinNumber getOneWireBusPin() const;
};

#endif