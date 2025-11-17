// scripts/test-purchase.ts
// Quick script to insert a test purchase event into the outbox

import "../drizzle/envConfig";
import { db } from "../src/db";
import { outboxEvents } from "../src/db/schema";
import { randomUUID } from "crypto";

async function insertTestPurchase() {
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

    console.log("✅ Test purchase event inserted into outbox");
    console.log(`   Event ID: ${eventId}`);
    console.log(`   User ID: ${testPayload.user_id}`);
    console.log(`   Product ID: ${testPayload.product_id}`);
    console.log("\n⏳ Wait <2 seconds for outbox worker to process...");
    console.log(
      "   Then verify with: curl -s -u default:MyLocalSecret123 'http://127.0.0.1:8123/?query=SELECT count() FROM analytics.events WHERE event_type=\\'purchase\\' FORMAT JSON'"
    );
  } catch (error) {
    console.error("❌ Error inserting test purchase:", error);
    process.exit(1);
  }
}

insertTestPurchase();

