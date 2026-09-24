#ifndef ARDUINO_PLATFORM_H
#define ARDUINO_PLATFORM_H

#include "PlatformTypes.h"

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
    virtual size_t serialWrite(uint8_t c) const;
    virtual size_t serialPrint(const char* str) const;
    virtual size_t serialPrintln(const char* str) const;
    virtual size_t serialPrint(float val, int digits) const;
    virtual size_t serialPrintln(float val, int digits) const;
    
    virtual PinNumber getOneWireBusPin() const;
};

#endif