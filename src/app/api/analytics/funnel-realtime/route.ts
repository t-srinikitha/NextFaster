// app/api/analytics/funnel-realtime/route.ts
// Real-time funnel analysis using ClickHouse windowFunnel function

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

const emptyRealtimeFunnel = {
  funnel: [
    { stage: "Page View", stage_number: 1, users: 0, sessions: 0, drop_off_rate: 0, conversion_rate: 0 },
    { stage: "Product View", stage_number: 2, users: 0, sessions: 0, drop_off_rate: 0, conversion_rate: 0 },
    { stage: "Add to Cart", stage_number: 3, users: 0, sessions: 0, drop_off_rate: 0, conversion_rate: 0 },
    { stage: "Purchase", stage_number: 4, users: 0, sessions: 0, drop_off_rate: 0, conversion_rate: 0 },
  ],
  window_seconds: 1800,
  total_users: 0,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const windowSeconds = parseInt(searchParams.get("window_seconds") || "1800"); // 30 min default
  const days = parseInt(searchParams.get("days") || "1");

  if (!isClickHouseConfigured()) {
    return Response.json({ ...emptyRealtimeFunnel, window_seconds: windowSeconds });
  }

  try {
    // ClickHouse windowFunnel is purpose-built for this!
    const query = `
      SELECT 
        windowFunnel({windowSeconds:UInt32})(event_time,
          event_type = 'page_view',
          event_type = 'product_view',
          event_type = 'add_to_cart',
          event_type = 'purchase'
        ) as funnel_stage,
        count() as users,
        uniq(session_id) as sessions
      FROM ${getClickHouseDatabase()}.events
      WHERE event_time >= now() - INTERVAL {days:UInt32} DAY
        AND session_id != ''
      GROUP BY funnel_stage
      ORDER BY funnel_stage ASC
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: {
        windowSeconds,
        days,
      },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        funnel_stage: string;
        users: string;
        sessions: string;
      }>;
    };

    const stages = [
      { name: "Page View", stage: 1 },
      { name: "Product View", stage: 2 },
      { name: "Add to Cart", stage: 3 },
      { name: "Purchase", stage: 4 },
    ];

    const results = stages.map((stage) => {
      const found = data?.data?.find(
        (d) => Number(d.funnel_stage) === stage.stage
      );
      return {
        stage: stage.name,
        stage_number: stage.stage,
        users: found ? Number(found.users) : 0,
        sessions: found ? Number(found.sessions) : 0,
      };
    });

    // Calculate drop-off rates
    const enriched = results.map((result, index) => {
      const previous = index > 0 ? results[index - 1] : null;
      const dropOff =
        previous && previous.users > 0
          ? ((previous.users - result.users) / previous.users) * 100
          : 0;
      const conversion =
        previous && previous.users > 0
          ? (result.users / previous.users) * 100
          : result.users > 0 ? 100 : 0;

      return {
        ...result,
        drop_off_rate: dropOff,
        conversion_rate: conversion,
      };
    });

    return Response.json({
      funnel: enriched,
      window_seconds: windowSeconds,
      total_users: enriched[0]?.users || 0,
    });
  } catch (err) {
    console.error("ClickHouse windowFunnel error:", err);
    return Response.json({ ...emptyRealtimeFunnel, window_seconds: windowSeconds });
  }
}

