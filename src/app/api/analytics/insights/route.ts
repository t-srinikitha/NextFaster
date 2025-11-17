// app/api/analytics/insights/route.ts
// AI-Powered Insights - Anomaly detection, predictions, recommendations

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

const emptyInsights = {
  insights: [],
  prediction: null,
  current_period: {
    add_to_carts: 0,
    purchases: 0,
    product_views: 0,
    unique_users: 0,
    revenue: 0,
    conversion_rate: 0,
  },
  previous_period: {
    add_to_carts: 0,
    purchases: 0,
    product_views: 0,
    unique_users: 0,
    revenue: 0,
    conversion_rate: 0,
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  if (!isClickHouseConfigured()) {
    return Response.json(emptyInsights);
  }

  try {
    // Get current period stats
    const currentQuery = `
      SELECT 
        countIf(event_type = 'add_to_cart') as add_to_carts,
        countIf(event_type = 'purchase') as purchases,
        countIf(event_type = 'product_view') as product_views,
        uniq(user_id) as unique_users,
        sum(price) as revenue,
        avg(price) as avg_price
      FROM ${getClickHouseDatabase()}.events
      WHERE event_time >= now() - INTERVAL 1 DAY
    `;

    // Get previous period for comparison
    const previousQuery = `
      SELECT 
        countIf(event_type = 'add_to_cart') as add_to_carts,
        countIf(event_type = 'purchase') as purchases,
        countIf(event_type = 'product_view') as product_views,
        uniq(user_id) as unique_users,
        sum(price) as revenue,
        avg(price) as avg_price
      FROM ${getClickHouseDatabase()}.events
      WHERE event_time >= now() - INTERVAL 2 DAY
        AND event_time < now() - INTERVAL 1 DAY
    `;

    const ch = getClickHouseClient();
    const [currentResult, previousResult] = await Promise.all([
      ch.query({ query: currentQuery, format: "JSON" }),
      ch.query({ query: previousQuery, format: "JSON" }),
    ]);

    const current = (await currentResult.json()) as {
      data?: Array<{
        add_to_carts: string;
        purchases: string;
        product_views: string;
        unique_users: string;
        revenue: string;
        avg_price: string;
      }>;
    };

    const previous = (await previousResult.json()) as {
      data?: Array<{
        add_to_carts: string;
        purchases: string;
        product_views: string;
        unique_users: string;
        revenue: string;
        avg_price: string;
      }>;
    };

    const currentData = current.data?.[0] || {};
    const previousData = previous.data?.[0] || {};

    const insights: Array<{
      type: "anomaly" | "trend" | "recommendation";
      severity: "high" | "medium" | "low";
      message: string;
      metric?: string;
      change?: number;
    }> = [];

    // Calculate changes
    const calcChange = (current: string, previous: string) => {
      const curr = Number(current || 0);
      const prev = Number(previous || 0);
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const cartAbandonmentChange = calcChange(
      currentData.add_to_carts || "0",
      previousData.add_to_carts || "0"
    );
    const purchaseChange = calcChange(
      currentData.purchases || "0",
      previousData.purchases || "0"
    );
    const revenueChange = calcChange(
      currentData.revenue || "0",
      previousData.revenue || "0"
    );

    // Anomaly Detection: Cart abandonment spike
    if (cartAbandonmentChange > 15 && purchaseChange < 5) {
      insights.push({
        type: "anomaly",
        severity: "high",
        message: `📈 Cart abandonment is ${cartAbandonmentChange.toFixed(1)}% higher than yesterday`,
        metric: "cart_abandonment",
        change: cartAbandonmentChange,
      });
    }

    // Trend: Revenue drop
    if (revenueChange < -10) {
      insights.push({
        type: "trend",
        severity: "high",
        message: `💰 Revenue is down ${Math.abs(revenueChange).toFixed(1)}% compared to yesterday`,
        metric: "revenue",
        change: revenueChange,
      });
    }

    // Get product affinities
    const affinityQuery = `
      WITH product_pairs AS (
        SELECT 
          arrayJoin(arrayZip(
            arraySlice(groupArray(product_id), 1, length(groupArray(product_id)) - 1),
            arraySlice(groupArray(product_id), 2)
          )) as pair
        FROM ${getClickHouseDatabase()}.events
        WHERE event_type = 'product_view'
          AND event_time >= now() - INTERVAL {days:UInt32} DAY
          AND product_id != ''
        GROUP BY session_id
        HAVING length(groupArray(product_id)) >= 2
      )
      SELECT 
        pair.1 as product_a,
        pair.2 as product_b,
        count() as co_views
      FROM product_pairs
      WHERE product_a != '' AND product_b != ''
      GROUP BY product_a, product_b
      ORDER BY co_views DESC
      LIMIT 5
    `;

    const affinityResult = await ch.query({
      query: affinityQuery,
      query_params: { days },
      format: "JSON",
    });

    const affinityData = (await affinityResult.json()) as {
      data?: Array<{
        product_a: string;
        product_b: string;
        co_views: string;
      }>;
    };

    // Add product affinity recommendations
    if (affinityData.data && affinityData.data.length > 0) {
      const topAffinity = affinityData.data[0];
      const totalViews = Number(topAffinity.co_views);
      insights.push({
        type: "recommendation",
        severity: "medium",
        message: `🎯 Users who view '${topAffinity.product_a}' also view '${topAffinity.product_b}' frequently (${totalViews} times)`,
        metric: "product_affinity",
      });
    }

    // Conversion rate analysis
    const currentViews = Number(currentData.product_views || 0);
    const currentPurchases = Number(currentData.purchases || 0);
    const currentConversion = currentViews > 0 ? (currentPurchases / currentViews) * 100 : 0;

    const prevViews = Number(previousData.product_views || 0);
    const prevPurchases = Number(previousData.purchases || 0);
    const prevConversion = prevViews > 0 ? (prevPurchases / prevViews) * 100 : 0;

    const conversionChange = prevConversion > 0 
      ? ((currentConversion - prevConversion) / prevConversion) * 100 
      : 0;

    if (conversionChange < -2) {
      insights.push({
        type: "anomaly",
        severity: "medium",
        message: `⚡ Conversion rate dropped ${Math.abs(conversionChange).toFixed(1)}% - investigate page performance or UX issues`,
        metric: "conversion_rate",
        change: conversionChange,
      });
    }

    // Sales prediction (simple linear trend)
    const salesQuery = `
      SELECT 
        toDate(event_time) as date,
        count() as daily_purchases,
        sum(price) as daily_revenue
      FROM ${getClickHouseDatabase()}.events
      WHERE event_type = 'purchase'
        AND event_time >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY date
      ORDER BY date ASC
    `;

    const salesResult = await ch.query({
      query: salesQuery,
      query_params: { days },
      format: "JSON",
    });

    const salesData = (await salesResult.json()) as {
      data?: Array<{
        date: string;
        daily_purchases: string;
        daily_revenue: string;
      }>;
    };

    let prediction: string | null = null;
    if (salesData.data && salesData.data.length >= 3) {
      const recent = salesData.data.slice(-3);
      const avgRevenue = recent.reduce(
        (sum, d) => sum + Number(d.daily_revenue || 0),
        0
      ) / recent.length;
      prediction = `📊 Based on recent trends, expected daily revenue: $${avgRevenue.toFixed(2)}`;
    }

    return Response.json({
      insights,
      prediction,
      current_period: {
        add_to_carts: Number(currentData.add_to_carts || 0),
        purchases: Number(currentData.purchases || 0),
        product_views: Number(currentData.product_views || 0),
        unique_users: Number(currentData.unique_users || 0),
        revenue: Number(currentData.revenue || 0),
        conversion_rate: currentConversion,
      },
      previous_period: {
        add_to_carts: Number(previousData.add_to_carts || 0),
        purchases: Number(previousData.purchases || 0),
        product_views: Number(previousData.product_views || 0),
        unique_users: Number(previousData.unique_users || 0),
        revenue: Number(previousData.revenue || 0),
        conversion_rate: prevConversion,
      },
    });
  } catch (err) {
    console.error("ClickHouse insights query error:", err);
    return Response.json(emptyInsights);
  }
}

