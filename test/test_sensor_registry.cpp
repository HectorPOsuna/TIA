#include <unity.h>
#include "src/core/SensorRegistry.h"
#include "src/core/SensorReading.h"
#include "test/mocks/MockPlatform.h"

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

void test_sensor_registry_register_and_count() {
    TestSensorRegistry reg;
    TEST_ASSERT_EQUAL(0, reg.count());
    TEST_ASSERT_TRUE(reg.registerSensor("sensor1"));
    TEST_ASSERT_EQUAL(1, reg.count());
    TEST_ASSERT_TRUE(reg.registerSensor("sensor2"));
    TEST_ASSERT_EQUAL(2, reg.count());
    TEST_ASSERT_FALSE(reg.registerSensor("sensor1")); // duplicate
    TEST_ASSERT_EQUAL(2, reg.count());
}

void test_sensor_registry_update_and_get() {
    TestSensorRegistry reg;
    reg.registerSensor("sensor1");
    
    SensorReading reading("sensor1", 25.5f, true, 0, 0, 1000);
    TEST_ASSERT_TRUE(reg.updateReading(reading));
    
    SensorReading out;
    TEST_ASSERT_TRUE(reg.getReading("sensor1", out));
    TEST_ASSERT_EQUAL_STRING("sensor1", out.id.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001, 25.5f, out.temperature);
    TEST_ASSERT_TRUE(out.ok);
}

void test_sensor_registry_get_nonexistent() {
    TestSensorRegistry reg;
    SensorReading out;
    TEST_ASSERT_FALSE(reg.getReading("nonexistent", out));
}

void test_sensor_registry_get_all() {
    TestSensorRegistry reg;
    reg.registerSensor("sensor1");
    reg.registerSensor("sensor2");
    reg.updateReading(SensorReading("sensor1", 20.0f, true, 0, 0, 1000));
    reg.updateReading(SensorReading("sensor2", 21.0f, true, 0, 0, 1001));
    
    auto all = reg.getAllReadings();
    TEST_ASSERT_EQUAL(2, all.size());
}

void test_sensor_registry_get_ids() {
    TestSensorRegistry reg;
    reg.registerSensor("sensor1");
    reg.registerSensor("sensor2");
    
    auto ids = reg.getSensorIds();
    TEST_ASSERT_EQUAL(2, ids.size());
    TEST_ASSERT_TRUE(reg.hasSensor("sensor1"));
    TEST_ASSERT_TRUE(reg.hasSensor("sensor2"));
    TEST_ASSERT_FALSE(reg.hasSensor("sensor3"));
}

void test_sensor_registry_clear() {
    TestSensorRegistry reg;
    reg.registerSensor("sensor1");
    reg.clear();
    TEST_ASSERT_EQUAL(0, reg.count());
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_sensor_registry_register_and_count);
    RUN_TEST(test_sensor_registry_update_and_get);
    RUN_TEST(test_sensor_registry_get_nonexistent);
    RUN_TEST(test_sensor_registry_get_all);
    RUN_TEST(test_sensor_registry_get_ids);
    RUN_TEST(test_sensor_registry_clear);
    return UNITY_END();
}