// app/api/analytics/top-products/route.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const eventType = searchParams.get("event_type") || "product_view";
  const days = parseInt(searchParams.get("days") || "7");

  if (!isClickHouseConfigured()) {
    return Response.json({ products: [] });
  }

  try {
    const query = `
      SELECT 
        product_id,
        count() as event_count,
        sum(price) as total_revenue,
        avg(price) as avg_price,
        uniq(user_id) as unique_users
      FROM ${getClickHouseDatabase()}.events
      WHERE event_type = {eventType:String}
        AND event_time >= now() - INTERVAL {days:UInt32} DAY
        AND product_id != ''
      GROUP BY product_id
      ORDER BY event_count DESC
      LIMIT {limit:UInt32}
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: {
        eventType,
        days,
        limit,
      },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        product_id: string;
        event_count: string;
        total_revenue: string;
        avg_price: string;
        unique_users: string;
      }>;
    };

    return Response.json({
      products: (data?.data || []).map((p) => ({
        product_id: p.product_id,
        event_count: Number(p.event_count),
        total_revenue: Number(p.total_revenue),
        avg_price: Number(p.avg_price),
        unique_users: Number(p.unique_users),
      })),
    });
  } catch (err) {
    console.error("ClickHouse query error:", err);
    return Response.json({ products: [] });
  }
}

