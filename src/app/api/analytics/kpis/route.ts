// app/api/analytics/kpis.ts

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

export async function GET(_request: NextRequest) {
  if (!isClickHouseConfigured()) {
    return Response.json({ purchases: 0, views: 0, conversion_rate: 0 });
  }

  try {
    const ch = getClickHouseClient();
    const db = getClickHouseDatabase();
    const purchasesQ = `SELECT count() AS purchases FROM ${db}.events WHERE event_type='purchase' AND event_time >= now() - INTERVAL 1 DAY`;
    const viewsQ = `SELECT count() AS views FROM ${db}.events WHERE event_type='product_view' AND event_time >= now() - INTERVAL 1 DAY`;

    const purchasesResult = await ch.query({
      query: purchasesQ,
      format: "JSON",
    });
    const viewsResult = await ch.query({
      query: viewsQ,
      format: "JSON",
    });

    const p = (await purchasesResult.json()) as {
      data?: Array<{ purchases?: string | number }>;
    };
    const v = (await viewsResult.json()) as {
      data?: Array<{ views?: string | number }>;
    };

    const purchases = Number(p?.data?.[0]?.purchases || 0);
    const views = Number(v?.data?.[0]?.views || 0);
    const conversion_rate = views === 0 ? 0 : purchases / views;

    return Response.json({ purchases, views, conversion_rate });
  } catch (err) {
    console.error("ClickHouse query error:", err);
    return Response.json({ purchases: 0, views: 0, conversion_rate: 0 });
  }
}

