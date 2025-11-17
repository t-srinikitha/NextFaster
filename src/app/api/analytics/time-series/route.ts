// app/api/analytics/time-series/route.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");
  const eventType = searchParams.get("event_type") || null;
  const interval = searchParams.get("interval") || "hour"; // hour, day

  if (!isClickHouseConfigured()) {
    return Response.json({ series: [] });
  }

  try {
    let timeGroupBy = "toStartOfHour(event_time)";
    if (interval === "day") {
      timeGroupBy = "toDate(event_time)";
    }

    let whereClause = `event_time >= now() - INTERVAL {days:UInt32} DAY`;
    if (eventType) {
      whereClause += ` AND event_type = {eventType:String}`;
    }

    const query = `
      SELECT 
        ${timeGroupBy} as time,
        count() as event_count,
        uniq(user_id) as unique_users,
        sum(price) as total_revenue
      FROM ${getClickHouseDatabase()}.events
      WHERE ${whereClause}
      GROUP BY time
      ORDER BY time ASC
    `;

    const params: Record<string, unknown> = { days };
    if (eventType) {
      params.eventType = eventType;
    }

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: params,
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        time: string;
        event_count: string;
        unique_users: string;
        total_revenue: string;
      }>;
    };

    return Response.json({
      series: (data?.data || []).map((d) => ({
        time: d.time,
        event_count: Number(d.event_count),
        unique_users: Number(d.unique_users),
        total_revenue: Number(d.total_revenue),
      })),
    });
  } catch (err) {
    console.error("ClickHouse query error:", err);
    return Response.json({ series: [] });
  }
}

