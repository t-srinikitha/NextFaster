// lib/analytics/outbox.ts

import { randomUUID } from "crypto";
import { db } from "@/db";
import { outboxEvents } from "@/db/schema";
// import { orders } from "@/db/schema"; // Uncomment once orders table is added

// Note: This function requires an 'orders' table in your schema.
// Add the orders table to src/db/schema.ts and import it above.

export async function createOrderWithOutbox(
  orderData: any,
  userId: string,
) {
  // This uses Drizzle's transaction helper; adapt if your setup differs
  return await db.transaction(async (tx) => {
    // TODO: Uncomment once orders table is added to schema:
    // const inserted = await tx.insert(orders).values(orderData).returning();
    // const order = Array.isArray(inserted) ? inserted[0] : inserted;

    // Placeholder - replace with actual order insert above
    const order = {
      id: 0, // Will be set from actual insert
      ...orderData,
    };

    const event = {
      event_id: randomUUID(),
      event_type: "purchase",
      payload: {
        order_id: order.id,
        user_id: userId,
        product_id: orderData.product_id,
        price: orderData.price,
        created_at: new Date().toISOString(),
      },
    };

    await tx.insert(outboxEvents).values({
      eventId: event.event_id,
      eventType: event.event_type,
      payload: event.payload,
    });

    return order;
  });
}

// How to use: replace any existing order creation call with createOrderWithOutbox(...).
// If you can't adapt Drizzle, use raw SQL with BEGIN; ... COMMIT;.

