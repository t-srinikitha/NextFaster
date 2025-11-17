// scripts/test-e2e.ts
// End-to-end test script for the analytics pipeline

import "../drizzle/envConfig";
import { createClient } from "@clickhouse/client";
import { Client } from "pg";
import { db } from "../src/db";
import { outboxEvents } from "../src/db/schema";
import { randomUUID } from "crypto";

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://localhost:8123";
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || "MyLocalSecret123";
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "analytics";
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!PG_CONNECTION_STRING) {
  console.error("❌ PG_CONNECTION_STRING, DATABASE_URL, or POSTGRES_URL environment variable is required");
  process.exit(1);
}

const ch = createClient({
  url: CLICKHOUSE_URL,
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
});

const pg = new Client({ connectionString: PG_CONNECTION_STRING });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testClickHouseConnection() {
  console.log("🔍 Testing ClickHouse connection...");
  try {
    const result = await ch.query({
      query: "SELECT 1 as test",
      format: "JSON",
    });
    const data = await result.json();
    console.log("✅ ClickHouse connection successful");
    return true;
  } catch (error) {
    console.error("❌ ClickHouse connection failed:", error);
    return false;
  }
}

async function testPostgresConnection() {
  console.log("🔍 Testing Postgres connection...");
  try {
    await pg.connect();
    const result = await pg.query("SELECT 1 as test");
    console.log("✅ Postgres connection successful");
    return true;
  } catch (error) {
    console.error("❌ Postgres connection failed:", error);
    return false;
  }
}

async function checkClickHouseTable() {
  console.log("🔍 Checking analytics.events table...");
  try {
    const result = await ch.query({
      query: `SELECT count() as count FROM ${CLICKHOUSE_DATABASE}.events`,
      format: "JSON",
    });
    const data = (await result.json()) as { data?: Array<{ count?: string }> };
    const count = Number(data?.data?.[0]?.count || 0);
    console.log(`✅ Table exists. Current event count: ${count}`);
    return true;
  } catch (error) {
    console.error("❌ Table check failed:", error);
    return false;
  }
}

async function insertTestPurchase() {
  console.log("📝 Inserting test purchase event...");
  const eventId = randomUUID();
  const testPayload = {
    event_id: randomUUID(),
    user_id: `test-user-${Date.now()}`,
    product_id: `test-product-${Date.now()}`,
    price: 29.99,
    created_at: new Date().toISOString(),
    event_type: "purchase",
  };

  try {
    await db.insert(outboxEvents).values({
      eventId,
      eventType: "purchase",
      payload: testPayload,
    });
    console.log(`✅ Test purchase inserted. Event ID: ${eventId}`);
    return { eventId, testPayload };
  } catch (error) {
    console.error("❌ Failed to insert test purchase:", error);
    throw error;
  }
}

async function waitForProcessing(eventId: string, maxWait = 5000) {
  console.log(`⏳ Waiting for outbox worker to process (max ${maxWait}ms)...`);
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < maxWait) {
    const result = await pg.query(
      `SELECT COUNT(*) as count FROM outbox_events WHERE event_id = $1 AND sent = true`,
      [eventId]
    );
    const sentCount = Number(result.rows[0].count);

    if (sentCount > 0) {
      console.log("✅ Event processed by outbox worker");
      return true;
    }

    await sleep(checkInterval);
  }

  console.log("⚠️  Event not processed within timeout. Is the outbox worker running?");
  return false;
}

async function verifyInClickHouse() {
  console.log("🔍 Verifying event in ClickHouse...");
  try {
    // Wait a bit more to ensure ClickHouse has the data
    await sleep(1000);

    const result = await ch.query({
      query: `SELECT count() as count FROM ${CLICKHOUSE_DATABASE}.events WHERE event_type='purchase' AND event_time >= now() - INTERVAL 1 DAY`,
      format: "JSON",
    });
    const data = (await result.json()) as { data?: Array<{ count?: string }> };
    const count = Number(data?.data?.[0]?.count || 0);

    if (count > 0) {
      console.log(`✅ Found ${count} purchase event(s) in ClickHouse`);
      return true;
    } else {
      console.log("⚠️  No purchase events found in ClickHouse");
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to verify in ClickHouse:", error);
    return false;
  }
}

async function testKPIsEndpoint() {
  console.log("🔍 Testing KPIs endpoint...");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/analytics/kpis`);
    if (!response.ok) {
      console.error(`❌ KPIs endpoint returned ${response.status}`);
      return false;
    }
    const data = await response.json();
    console.log("✅ KPIs endpoint response:", JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("❌ KPIs endpoint test failed:", error);
    console.log("   (This is expected if Next.js server is not running)");
    return false;
  }
}

async function cleanup() {
  try {
    await pg.end();
    await ch.close();
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function runTests() {
  console.log("🚀 Starting end-to-end test...\n");

  const results = {
    clickhouse: false,
    postgres: false,
    table: false,
    insert: false,
    processing: false,
    clickhouseVerify: false,
    kpis: false,
  };

  try {
    results.clickhouse = await testClickHouseConnection();
    if (!results.clickhouse) {
      console.log("\n❌ ClickHouse connection failed. Aborting.");
      return;
    }

    results.postgres = await testPostgresConnection();
    if (!results.postgres) {
      console.log("\n❌ Postgres connection failed. Aborting.");
      return;
    }

    results.table = await checkClickHouseTable();
    if (!results.table) {
      console.log("\n❌ Table check failed. Aborting.");
      return;
    }

    const testEvent = await insertTestPurchase();
    results.insert = true;

    results.processing = await waitForProcessing(testEvent.eventId);
    results.clickhouseVerify = await verifyInClickHouse();
    results.kpis = await testKPIsEndpoint();

    console.log("\n📊 Test Results:");
    console.log(`   ClickHouse Connection: ${results.clickhouse ? "✅" : "❌"}`);
    console.log(`   Postgres Connection: ${results.postgres ? "✅" : "❌"}`);
    console.log(`   Table Check: ${results.table ? "✅" : "❌"}`);
    console.log(`   Insert Test Event: ${results.insert ? "✅" : "❌"}`);
    console.log(`   Event Processing: ${results.processing ? "✅" : "❌"}`);
    console.log(`   ClickHouse Verification: ${results.clickhouseVerify ? "✅" : "❌"}`);
    console.log(`   KPIs Endpoint: ${results.kpis ? "✅" : "❌"}`);

    const allPassed = Object.values(results).every((v) => v);
    if (allPassed) {
      console.log("\n🎉 All tests passed!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed. Check the output above.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTests();

