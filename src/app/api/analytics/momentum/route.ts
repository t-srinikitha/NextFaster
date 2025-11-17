// app/api/analytics/momentum/route.ts
// Live Shopping Momentum Tracker - Real-time trending products

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const lookbackHours = parseInt(searchParams.get("lookback_hours") || "1");

  if (!isClickHouseConfigured()) {
    return Response.json({
      trending_products: [],
      generated_at: new Date().toISOString(),
      lookback_hours: lookbackHours,
    });
  }

  try {
    // This query runs in milliseconds even on billions of events
    const query = `
      SELECT 
        product_id,
        count() as events_last_hour,
        countIf(event_time > now() - INTERVAL 10 MINUTE) as events_last_10min,
        uniq(user_id) as unique_users,
        sum(price) as total_revenue,
        avg(price) as avg_price,
        min(event_time) as first_seen,
        max(event_time) as last_seen,
        dateDiff('second', min(event_time), max(event_time)) as time_span_seconds,
        if(time_span_seconds > 0, events_last_hour / time_span_seconds, 0) as events_per_second
      FROM ${getClickHouseDatabase()}.events
      WHERE event_time > now() - INTERVAL {lookbackHours:UInt32} HOUR
        AND product_id != ''
        AND event_type IN ('product_view', 'add_to_cart', 'purchase')
      GROUP BY product_id
      HAVING events_last_hour > 0
      ORDER BY events_last_10min DESC, events_per_second DESC
      LIMIT {limit:UInt32}
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: {
        lookbackHours,
        limit,
      },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        product_id: string;
        events_last_hour: string;
        events_last_10min: string;
        unique_users: string;
        total_revenue: string;
        avg_price: string;
        first_seen: string;
        last_seen: string;
        time_span_seconds: string;
        events_per_second: string;
      }>;
    };

    const products = (data?.data || []).map((p) => {
      const eventsLastHour = Number(p.events_last_hour);
      const eventsLast10Min = Number(p.events_last_10min);
      const momentum = eventsLast10Min / 10; // events per minute in last 10 min

      // Calculate trend: positive if accelerating, negative if slowing
      const hourlyRate = eventsLastHour / lookbackHours;
      const recentRate = eventsLast10Min / (10 / 60); // events per hour in last 10 min
      const trend = recentRate > hourlyRate ? "accelerating" : "slowing";

      return {
        product_id: p.product_id,
        events_last_hour: eventsLastHour,
        events_last_10min: eventsLast10Min,
        unique_users: Number(p.unique_users),
        total_revenue: Number(p.total_revenue),
        avg_price: Number(p.avg_price),
        events_per_second: Number(p.events_per_second),
        momentum: momentum, // events per minute
        trend,
        trend_percentage: hourlyRate > 0 
          ? ((recentRate - hourlyRate) / hourlyRate) * 100 
          : 0,
      };
    });

    return Response.json({
      trending_products: products,
      generated_at: new Date().toISOString(),
      lookback_hours: lookbackHours,
    });
  } catch (err) {
    console.error("ClickHouse momentum query error:", err);
    return Response.json({
      trending_products: [],
      generated_at: new Date().toISOString(),
      lookback_hours: lookbackHours,
    });
  }
}

