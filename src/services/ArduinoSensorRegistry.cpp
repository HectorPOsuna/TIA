#include "ArduinoSensorRegistry.h"

bool ArduinoSensorRegistry::registerSensor(const std::string& id) {
    if (readings_.find(id) == readings_.end()) {
        readings_[id] = SensorReading();
        return true;
    }
    return false;
}

bool ArduinoSensorRegistry::updateReading(const SensorReading& reading) {
    auto it = readings_.find(reading.id);
    if (it != readings_.end()) {
        it->second = reading;
        return true;
    }
    return false;
}

bool ArduinoSensorRegistry::getReading(const std::string& id, SensorReading& out) const {
    auto it = readings_.find(id);
    if (it != readings_.end()) {
        out = it->second;
        return true;
    }
    return false;
}

std::vector<SensorReading> ArduinoSensorRegistry::getAllReadings() const {
    std::vector<SensorReading> result;
    result.reserve(readings_.size());
    for (const auto& pair : readings_) {
        result.push_back(pair.second);
    }
    return result;
}

std::vector<std::string> ArduinoSensorRegistry::getSensorIds() const {
    std::vector<std::string> ids;
    ids.reserve(readings_.size());
    for (const auto& pair : readings_) {
        ids.push_back(pair.first);
    }
    return ids;
}

size_t ArduinoSensorRegistry::count() const {
    return readings_.size();
}

bool ArduinoSensorRegistry::hasSensor(const std::string& id) const {
    return readings_.find(id) != readings_.end();
}

void ArduinoSensorRegistry::clear() {
    readings_.clear();
}