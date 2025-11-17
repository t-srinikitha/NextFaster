// scripts/test-prod-purchase.ts
// Production-safe script to insert a test purchase event into the outbox
// ⚠️ This script includes safety checks for production environments

import "../drizzle/envConfig";
import { db } from "../src/db";
import { outboxEvents } from "../src/db/schema";
import { randomUUID } from "crypto";
import * as readline from "readline";

const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://localhost:8123";

// Production detection
function isProductionEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const dbUrl = PG_CONNECTION_STRING?.toLowerCase() || "";
  const clickhouseUrl = CLICKHOUSE_URL.toLowerCase();

  return (
    nodeEnv === "production" ||
    vercelEnv === "production" ||
    dbUrl.includes("prod") ||
    dbUrl.includes("production") ||
    clickhouseUrl.includes("prod") ||
    clickhouseUrl.includes("production")
  );
}

// Confirmation prompt
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

const TEST_PREFIX = "TEST-PROD";

async function insertTestPurchase() {
  const isProd = isProductionEnvironment();

  console.log("\n" + "=".repeat(60));
  console.log("📝 PRODUCTION-SAFE TEST PURCHASE INSERTION");
  console.log("=".repeat(60));

  if (isProd) {
    console.log("\n⚠️  PRODUCTION ENVIRONMENT DETECTED ⚠️");
    console.log("\nThis script will insert a test purchase event with:");
    console.log("  - TEST-PROD prefix for easy identification");
    console.log("  - Minimal price ($0.01)");
    console.log("  - Test flag marker");
    console.log("\nEnvironment detected as production based on:");
    if (process.env.NODE_ENV === "production") console.log("  - NODE_ENV=production");
    if (process.env.VERCEL_ENV === "production") console.log("  - VERCEL_ENV=production");
    if (PG_CONNECTION_STRING?.toLowerCase().includes("prod")) console.log("  - Database URL contains 'prod'");
    if (CLICKHOUSE_URL.toLowerCase().includes("prod")) console.log("  - ClickHouse URL contains 'prod'");

    const confirmed = await askConfirmation("\n⚠️  Do you want to proceed with inserting test data in PRODUCTION?");
    if (!confirmed) {
      console.log("\n❌ Test cancelled by user");
      process.exit(0);
    }
  } else {
    console.log("\nℹ️  Development environment detected");
    console.log("   Test data will be tagged with TEST-PROD prefix");
  }

  const eventId = randomUUID();
  const timestamp = Date.now();
  const testPayload = {
    event_id: randomUUID(),
    user_id: `${TEST_PREFIX}-USER-${timestamp}`,
    product_id: `${TEST_PREFIX}-PRODUCT-${timestamp}`,
    price: 0.01, // Minimal price for test
    created_at: new Date().toISOString(),
    event_type: "purchase",
    test_flag: true, // Explicit test marker
    test_timestamp: timestamp,
  };

  try {
    await db.insert(outboxEvents).values({
      eventId,
      eventType: "purchase",
      payload: testPayload,
    });

    console.log("\n✅ Test purchase event inserted into outbox");
    console.log(`   Event ID: ${eventId}`);
    console.log(`   User ID: ${testPayload.user_id}`);
    console.log(`   Product ID: ${testPayload.product_id}`);
    console.log(`   Price: $${testPayload.price} (test value)`);
    console.log("\n⏳ Wait <2 seconds for outbox worker to process...");

    console.log("\n" + "=".repeat(60));
    console.log("🧹 CLEANUP INSTRUCTIONS");
    console.log("=".repeat(60));
    console.log("\nTo remove this test event from ClickHouse:");
    console.log(`DELETE FROM analytics.events WHERE user_id = '${testPayload.user_id}';`);
    console.log("\nTo remove from PostgreSQL outbox:");
    console.log(`DELETE FROM outbox_events WHERE event_id = '${eventId}';`);
    console.log("\nOr remove all test events:");
    console.log(`DELETE FROM analytics.events WHERE user_id LIKE '${TEST_PREFIX}-%';`);
    console.log(`DELETE FROM outbox_events WHERE payload->>'user_id' LIKE '${TEST_PREFIX}-%';`);
    console.log("\n" + "=".repeat(60));

    console.log(
      "\n💡 Verify with:",
      `curl -s -u ${process.env.CLICKHOUSE_USER || "default"}:${process.env.CLICKHOUSE_PASSWORD || "password"} '${CLICKHOUSE_URL}/?query=SELECT count() FROM analytics.events WHERE user_id='${testPayload.user_id}' FORMAT JSON'`
    );
  } catch (error) {
    console.error("\n❌ Error inserting test purchase:", error);
    process.exit(1);
  }
}

insertTestPurchase();

