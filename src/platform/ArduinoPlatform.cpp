#include "ArduinoPlatform.h"
#include "config.h"
#include <Arduino.h>

Millis ArduinoPlatform::millis() const {
    return ::millis();
}

void ArduinoPlatform::delay(Millis ms) const {
    ::delay(ms);
}

void ArduinoPlatform::delayMicroseconds(uint32_t us) const {
    ::delayMicroseconds(us);
}

void ArduinoPlatform::serialBegin(BaudRate baud) const {
    Serial.begin(baud);
}

void ArduinoPlatform::serialEnd() const {
    Serial.end();
}

int ArduinoPlatform::serialAvailable() const {
    return Serial.available();
}

int ArduinoPlatform::serialRead() const {
    return Serial.read();
}

std::size_t ArduinoPlatform::serialWrite(uint8_t c) const {
    return Serial.write(c);
}

std::size_t ArduinoPlatform::serialPrint(const char* str) const {
    return Serial.print(str);
}

std::size_t ArduinoPlatform::serialPrintln(const char* str) const {
    return Serial.println(str);
}

std::size_t ArduinoPlatform::serialPrint(float val, int digits) const {
    return Serial.print(val, digits);
}

std::size_t ArduinoPlatform::serialPrintln(float val, int digits) const {
    return Serial.println(val, digits);
}

std::size_t ArduinoPlatform::serialPrint(int val) const {
    return Serial.print(val);
}

std::size_t ArduinoPlatform::serialPrintln(int val) const {
    return Serial.println(val);
}

std::size_t ArduinoPlatform::serialPrint(unsigned int val) const {
    return Serial.print(val);
}

std::size_t ArduinoPlatform::serialPrintln(unsigned int val) const {
    return Serial.println(val);
}

std::size_t ArduinoPlatform::serialPrint(unsigned long val) const {
    return Serial.print(val);
}

std::size_t ArduinoPlatform::serialPrintln(unsigned long val) const {
    return Serial.println(val);
}

PinNumber ArduinoPlatform::getOneWireBusPin() const {
    return ONE_WIRE_BUS;
}