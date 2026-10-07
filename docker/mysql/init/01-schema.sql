CREATE TABLE IF NOT EXISTS telemetry (
  ts BIGINT NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  node_type VARCHAR(16) NOT NULL,
  current_temp DOUBLE NULL,
  target_temp DOUBLE NULL,
  ambient_temp DOUBLE NULL,
  workload DOUBLE NULL,
  status TINYINT NULL,
  fan_active TINYINT(1) NULL,
  queue_length INT NULL,
  stack_size INT NULL,
  INDEX idx_telemetry_node_ts (node_id, ts DESC)
);

CREATE TABLE IF NOT EXISTS events (
  ts BIGINT NOT NULL,
  node_id VARCHAR(64) NULL,
  kind VARCHAR(16) NOT NULL,
  type VARCHAR(16) NOT NULL,
  label VARCHAR(255) NULL,
  message TEXT NULL,
  meta JSON NULL,
  INDEX idx_events_ts (ts DESC)
);

CREATE OR REPLACE VIEW telemetry_minute AS
SELECT
  DATE_FORMAT(FROM_UNIXTIME(ts / 1000), '%Y-%m-%d %H:%i') AS minute,
  node_id,
  AVG(current_temp) AS avg_temp,
  MAX(current_temp) AS max_temp,
  MIN(current_temp) AS min_temp
FROM telemetry
GROUP BY minute, node_id;