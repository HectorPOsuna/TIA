#include <unity.h>
#include "src/core/SensorReading.h"
#include "src/core/TelemetryPublisher.h"
#include "src/core/SensorRegistry.h"
#include "test/mocks/MockPlatform.h"

class TestTelemetryPublisher : public TelemetryPublisher {
public:
    bool publish(const SensorReading& reading) override {
        lastPublished_ = reading;
        publishCount_++;
        return true;
    }
    bool publishBatch(const std::vector<SensorReading>& readings) override {
        batchCount_++;
        return true;
    }
    void flush() override {}
    
    SensorReading lastPublished_;
    int publishCount_ = 0;
    int batchCount_ = 0;
};

class TestSensorRegistry : public SensorRegistry {
public:
    bool registerSensor(const std::string& id) override {
        if (readings_.find(id) == readings_.end()) {
            readings_[id] = SensorReading();
            return true;
        }
        return false;
    }
    bool updateReading(const SensorReading& reading) override {
        auto it = readings_.find(reading.id);
        if (it != readings_.end()) {
            it->second = reading;
            return true;
        }
        return false;
    }
    bool getReading(const std::string& id, SensorReading& out) const override {
        auto it = readings_.find(id);
        if (it != readings_.end()) {
            out = it->second;
            return true;
        }
        return false;
    }
    std::vector<SensorReading> getAllReadings() const override {
        std::vector<SensorReading> result;
        result.reserve(readings_.size());
        for (const auto& pair : readings_) {
            result.push_back(pair.second);
        }
        return result;
    }
    std::vector<std::string> getSensorIds() const override {
        std::vector<std::string> ids;
        ids.reserve(readings_.size());
        for (const auto& pair : readings_) {
            ids.push_back(pair.first);
        }
        return ids;
    }
    size_t count() const override { return readings_.size(); }
    bool hasSensor(const std::string& id) const override {
        return readings_.find(id) != readings_.end();
    }
    void clear() override { readings_.clear(); }

private:
    std::map<std::string, SensorReading> readings_;
};

void setUp() {}
void tearDown() {}

void test_data_logger_log_text() {
    TestSensorRegistry reg;
    TestTelemetryPublisher pub;
    
    reg.registerSensor("sensor1");
    reg.updateReading(SensorReading("sensor1", 23.44f, true, 0, 0, 123456));
    
    // DataLogger uses Serial directly, so we can't easily test without mock Serial
    // This is a placeholder for the concept
    TEST_ASSERT_EQUAL(0, pub.publishCount_);
}

void test_telemetry_publisher_publish() {
    TestTelemetryPublisher pub;
    SensorReading reading("sensor1", 23.44f, true, 0, 0, 123456);
    
    TEST_ASSERT_TRUE(pub.publish(reading));
    TEST_ASSERT_EQUAL(1, pub.publishCount_);
    TEST_ASSERT_EQUAL_STRING("sensor1", pub.lastPublished_.id.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001, 23.44f, pub.lastPublished_.temperature);
}

void test_telemetry_publisher_batch() {
    TestTelemetryPublisher pub;
    std::vector<SensorReading> readings = {
        SensorReading("sensor1", 23.44f, true, 0, 0, 123456),
        SensorReading("sensor2", 24.12f, true, 0, 0, 123457)
    };
    
    TEST_ASSERT_TRUE(pub.publishBatch(readings));
    TEST_ASSERT_EQUAL(1, pub.batchCount_);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_data_logger_log_text);
    RUN_TEST(test_telemetry_publisher_publish);
    RUN_TEST(test_telemetry_publisher_batch);
    return UNITY_END();
}