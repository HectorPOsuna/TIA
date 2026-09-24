#include <unity.h>
#include "src/core/SensorReading.h"

void setUp() {}
void tearDown() {}

void test_sensor_reading_default_constructor() {
    SensorReading r;
    TEST_ASSERT_EQUAL_STRING("", r.id.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001, 0.0f, r.temperature);
    TEST_ASSERT_FALSE(r.ok);
    TEST_ASSERT_EQUAL_UINT8(0, r.failures);
    TEST_ASSERT_EQUAL_UINT8(0, r.consecutiveFailures);
    TEST_ASSERT_EQUAL_UINT32(0, r.timestamp);
    TEST_ASSERT_FALSE(r.isValid());
}

void test_sensor_reading_param_constructor() {
    SensorReading r("DS18B20_0_AB12", 23.44f, true, 0, 0, 123456);
    TEST_ASSERT_EQUAL_STRING("DS18B20_0_AB12", r.id.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001, 23.44f, r.temperature);
    TEST_ASSERT_TRUE(r.ok);
    TEST_ASSERT_EQUAL_UINT8(0, r.failures);
    TEST_ASSERT_EQUAL_UINT8(0, r.consecutiveFailures);
    TEST_ASSERT_EQUAL_UINT32(123456, r.timestamp);
    TEST_ASSERT_TRUE(r.isValid());
}

void test_sensor_reading_invalid_when_not_ok() {
    SensorReading r("DS18B20_0_AB12", 23.44f, false, 0, 0, 123456);
    TEST_ASSERT_FALSE(r.isValid());
}

void test_sensor_reading_copy() {
    SensorReading r1("DS18B20_0_AB12", 23.44f, true, 1, 2, 123456);
    SensorReading r2 = r1;
    TEST_ASSERT_EQUAL_STRING(r1.id.c_str(), r2.id.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001, r1.temperature, r2.temperature);
    TEST_ASSERT_EQUAL(r1.ok, r2.ok);
    TEST_ASSERT_EQUAL_UINT8(r1.failures, r2.failures);
    TEST_ASSERT_EQUAL_UINT8(r1.consecutiveFailures, r2.consecutiveFailures);
    TEST_ASSERT_EQUAL_UINT32(r1.timestamp, r2.timestamp);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_sensor_reading_default_constructor);
    RUN_TEST(test_sensor_reading_param_constructor);
    RUN_TEST(test_sensor_reading_invalid_when_not_ok);
    RUN_TEST(test_sensor_reading_copy);
    return UNITY_END();
}