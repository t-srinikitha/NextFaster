// app/api/analytics/funnel/route.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

const emptyFunnel = {
  funnel: [
    { step: "Page Views", count: 0, percentage: 100 },
    { step: "Product Views", count: 0, percentage: 0 },
    { step: "Add to Cart", count: 0, percentage: 0 },
    { step: "Purchases", count: 0, percentage: 0 },
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  if (!isClickHouseConfigured()) {
    return Response.json(emptyFunnel);
  }

  try {
    // Funnel: page_view -> product_view -> add_to_cart -> purchase
    const query = `
      WITH 
        page_views AS (
          SELECT uniq(session_id) as count
          FROM ${getClickHouseDatabase()}.events
          WHERE event_type = 'page_view'
            AND event_time >= now() - INTERVAL {days:UInt32} DAY
        ),
        product_views AS (
          SELECT uniq(session_id) as count
          FROM ${getClickHouseDatabase()}.events
          WHERE event_type = 'product_view'
            AND event_time >= now() - INTERVAL {days:UInt32} DAY
        ),
        add_to_carts AS (
          SELECT uniq(session_id) as count
          FROM ${getClickHouseDatabase()}.events
          WHERE event_type = 'add_to_cart'
            AND event_time >= now() - INTERVAL {days:UInt32} DAY
        ),
        purchases AS (
          SELECT uniq(session_id) as count
          FROM ${getClickHouseDatabase()}.events
          WHERE event_type = 'purchase'
            AND event_time >= now() - INTERVAL {days:UInt32} DAY
        )
      SELECT 
        (SELECT count FROM page_views) as page_views,
        (SELECT count FROM product_views) as product_views,
        (SELECT count FROM add_to_carts) as add_to_carts,
        (SELECT count FROM purchases) as purchases
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: { days },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        page_views: string;
        product_views: string;
        add_to_carts: string;
        purchases: string;
      }>;
    };

    const funnel = data?.data?.[0];
    if (!funnel) {
      return Response.json(emptyFunnel);
    }

    const pageViews = Number(funnel.page_views || 0);
    const productViews = Number(funnel.product_views || 0);
    const addToCarts = Number(funnel.add_to_carts || 0);
    const purchases = Number(funnel.purchases || 0);

    return Response.json({
      funnel: [
        {
          step: "Page Views",
          count: pageViews,
          percentage: 100,
        },
        {
          step: "Product Views",
          count: productViews,
          percentage: pageViews > 0 ? (productViews / pageViews) * 100 : 0,
        },
        {
          step: "Add to Cart",
          count: addToCarts,
          percentage: pageViews > 0 ? (addToCarts / pageViews) * 100 : 0,
        },
        {
          step: "Purchases",
          count: purchases,
          percentage: pageViews > 0 ? (purchases / pageViews) * 100 : 0,
        },
      ],
    });
  } catch (err) {
    console.error("ClickHouse query error:", err);
    return Response.json(emptyFunnel);
  }
}

