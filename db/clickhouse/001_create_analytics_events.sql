CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
  event_id String,
  event_time DateTime64(3),
  event_date Date,
  user_id String,
  session_id String,
  event_type String,
  product_id String,
  category String,
  price Float64,
  page String,
  referrer String,
  device_family String,
  country String,
  properties String
) ENGINE = ReplacingMergeTree(event_time)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, product_id);

