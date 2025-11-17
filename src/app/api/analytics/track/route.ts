// app/api/analytics/track/route.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { events } = body;

  if (!Array.isArray(events) || events.length === 0) {
    return Response.json({ error: "no events" }, { status: 400 });
  }

  // If ClickHouse is not configured, silently succeed (don't break the app)
  if (!isClickHouseConfigured()) {
    return Response.json({ ok: true, inserted: 0, skipped: true });
  }

  const rows = events.map((e) => ({
    event_id: e.event_id,
    event_time: e.event_time
      ? e.event_time.replace("T", " ").replace("Z", "")
      : new Date().toISOString().slice(0, 19).replace("T", " "),
    event_date: (e.event_time || new Date().toISOString()).slice(0, 10),
    user_id: e.user_id || "",
    session_id: e.session_id || "",
    event_type: e.event_type || "",
    product_id: e.product_id || "",
    category: e.category || "",
    price: e.price || 0,
    page: e.page || "",
    referrer: e.referrer || "",
    device_family: e.device_family || "",
    country: e.country || "",
    properties: JSON.stringify(e.properties || {}),
  }));

  try {
    const ch = getClickHouseClient();
    await ch.insert({
      table: `${getClickHouseDatabase()}.events`,
      format: "JSONEachRow",
      values: rows,
    });
    return Response.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("ClickHouse insert error:", err);
    // Still return success to not break the app if analytics fails
    return Response.json({ ok: true, inserted: 0, error: "insert failed" });
  }
}

