// app/api/analytics/stats/route.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

const emptyStats = {
  total_events: 0,
  unique_users: 0,
  unique_sessions: 0,
  purchases: 0,
  product_views: 0,
  add_to_carts: 0,
  total_revenue: 0,
  avg_order_value: 0,
  unique_products_viewed: 0,
  conversion_rate: 0,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  if (!isClickHouseConfigured()) {
    return Response.json(emptyStats);
  }

  try {
    const query = `
      SELECT 
        count() as total_events,
        uniq(user_id) as unique_users,
        uniq(session_id) as unique_sessions,
        countIf(event_type = 'purchase') as purchases,
        countIf(event_type = 'product_view') as product_views,
        countIf(event_type = 'add_to_cart') as add_to_carts,
        sum(price) as total_revenue,
        avg(price) as avg_order_value,
        uniqIf(product_id, event_type = 'product_view') as unique_products_viewed
      FROM ${getClickHouseDatabase()}.events
      WHERE event_time >= now() - INTERVAL {days:UInt32} DAY
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: { days },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        total_events: string;
        unique_users: string;
        unique_sessions: string;
        purchases: string;
        product_views: string;
        add_to_carts: string;
        total_revenue: string;
        avg_order_value: string;
        unique_products_viewed: string;
      }>;
    };

    const stats = data?.data?.[0];
    if (!stats) {
      return Response.json(emptyStats);
    }

    const purchases = Number(stats.purchases || 0);
    const productViews = Number(stats.product_views || 0);
    const conversionRate = productViews > 0 ? (purchases / productViews) * 100 : 0;

    return Response.json({
      total_events: Number(stats.total_events || 0),
      unique_users: Number(stats.unique_users || 0),
      unique_sessions: Number(stats.unique_sessions || 0),
      purchases,
      product_views: productViews,
      add_to_carts: Number(stats.add_to_carts || 0),
      total_revenue: Number(stats.total_revenue || 0),
      avg_order_value: Number(stats.avg_order_value || 0),
      unique_products_viewed: Number(stats.unique_products_viewed || 0),
      conversion_rate: conversionRate,
    });
  } catch (err) {
    console.error("ClickHouse query error:", err);
    return Response.json(emptyStats);
  }
}

