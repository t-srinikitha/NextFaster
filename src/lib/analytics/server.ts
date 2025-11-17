// lib/analytics/server.ts
// Server-side analytics tracking using outbox pattern

import { randomUUID } from "crypto";
import { db } from "@/db";
import { outboxEvents } from "@/db/schema";
import { headers } from "next/headers";

interface ServerAnalyticsEvent {
  event_type: string;
  user_id?: string;
  product_id?: string;
  category?: string;
  price?: number;
  page?: string;
  referrer?: string;
  device_family?: string;
  country?: string;
  properties?: Record<string, unknown>;
}

export async function trackEventServer(event: ServerAnalyticsEvent) {
  try {
    const headersList = await headers();
    const referrer = headersList.get("referer") || "";
    const userAgent = headersList.get("user-agent") || "";
    
    // Simple device detection
    let deviceFamily = "unknown";
    if (/mobile/i.test(userAgent)) deviceFamily = "mobile";
    else if (/tablet/i.test(userAgent)) deviceFamily = "tablet";
    else if (userAgent) deviceFamily = "desktop";

    const eventId = randomUUID();
    const payload = {
      event_id: eventId,
      event_type: event.event_type,
      user_id: event.user_id || "",
      session_id: "", // Session tracking is client-side
      product_id: event.product_id || "",
      category: event.category || "",
      price: event.price || 0,
      page: event.page || "",
      referrer: event.referrer || referrer,
      device_family: event.device_family || deviceFamily,
      country: event.country || "",
      created_at: new Date().toISOString(),
      ...event.properties,
    };

    await db.insert(outboxEvents).values({
      eventId,
      eventType: event.event_type,
      payload,
    });
  } catch (error) {
    console.error("Failed to track server event:", error);
    // Don't throw - analytics failures shouldn't break the app
  }
}

export async function trackPurchaseServer(
  userId: string,
  productId: string,
  price: number,
  category?: string,
  additionalData?: Record<string, unknown>
) {
  return trackEventServer({
    event_type: "purchase",
    user_id: userId,
    product_id: productId,
    price,
    category,
    properties: additionalData,
  });
}


