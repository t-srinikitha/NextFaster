// lib/clickhouse.ts
// Shared ClickHouse client with lazy initialization

import { createClient, ClickHouseClient } from "@clickhouse/client";

let ch: ClickHouseClient | null = null;

export function isClickHouseConfigured(): boolean {
  return !!(
    process.env.CLICKHOUSE_URL &&
    process.env.CLICKHOUSE_USER &&
    process.env.CLICKHOUSE_PASSWORD
  );
}

export function getClickHouseClient(): ClickHouseClient {
  if (!ch) {
    const url = process.env.CLICKHOUSE_URL;
    const username = process.env.CLICKHOUSE_USER;
    const password = process.env.CLICKHOUSE_PASSWORD;

    if (!url || !username || !password) {
      throw new Error(
        "ClickHouse environment variables not set: CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD"
      );
    }

    ch = createClient({
      url,
      username,
      password,
    } as any);
  }
  return ch;
}

export function getClickHouseDatabase(): string {
  return process.env.CLICKHOUSE_DATABASE || "analytics";
}

