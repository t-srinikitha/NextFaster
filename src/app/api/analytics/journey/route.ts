// app/api/analytics/journey/route.ts
// Customer Journey Mapping - Visualize user paths through the site

import { NextRequest } from "next/server";
import { getClickHouseClient, getClickHouseDatabase, isClickHouseConfigured } from "@/lib/clickhouse";

const emptyJourney = {
  journeys: [],
  common_paths: [],
  total_journeys: 0,
  conversion_rate: 0,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const days = parseInt(searchParams.get("days") || "1");
  const minSteps = parseInt(searchParams.get("min_steps") || "3");

  if (!isClickHouseConfigured()) {
    return Response.json(emptyJourney);
  }

  try {
    // Get user journeys grouped by session
    const query = `
      WITH user_journeys AS (
        SELECT 
          session_id,
          groupArray((event_time, event_type, product_id, page)) as journey,
          count() as journey_length,
          arrayFilter(x -> x.3 != '', journey) as product_journey,
          arrayFilter(x -> x.2 = 'purchase', journey) as purchases
        FROM ${getClickHouseDatabase()}.events
        WHERE event_time >= now() - INTERVAL {days:UInt32} DAY
          AND session_id != ''
        GROUP BY session_id
        HAVING journey_length >= {minSteps:UInt32}
      )
      SELECT 
        journey,
        journey_length,
        length(product_journey) as products_viewed,
        length(purchases) > 0 as converted,
        count() as frequency
      FROM user_journeys
      GROUP BY journey, journey_length, products_viewed, converted
      ORDER BY frequency DESC, converted DESC
      LIMIT {limit:UInt32}
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: {
        days,
        minSteps,
        limit,
      },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        journey: string; // Array as string
        journey_length: string;
        products_viewed: string;
        converted: string;
        frequency: string;
      }>;
    };

    // Parse the journey arrays and create path visualizations
    const journeys = (data?.data || []).map((j) => {
      // Parse the journey array string
      let journeyArray: Array<[string, string, string, string]> = [];
      try {
        // ClickHouse returns arrays as strings, need to parse
        // Format: [('2024-01-01 12:00:00','page_view','','/'), ...]
        const cleaned = j.journey.replace(/^\[|]$/g, "");
        // This is a simplified parser - in production you'd want more robust parsing
        journeyArray = JSON.parse(j.journey) as Array<[string, string, string, string]>;
      } catch {
        // Fallback: create simplified journey
        journeyArray = [];
      }

      const path = journeyArray.map((step) => ({
        timestamp: step[0],
        event_type: step[1],
        product_id: step[2] || null,
        page: step[3] || null,
      }));

      return {
        path,
        journey_length: Number(j.journey_length),
        products_viewed: Number(j.products_viewed),
        converted: j.converted === "1" || j.converted === "true",
        frequency: Number(j.frequency),
        // Create a simplified path string for visualization
        path_summary: path
          .map((p) => {
            if (p.event_type === "purchase") return "💰 Purchase";
            if (p.event_type === "add_to_cart") return "🛒 Add to Cart";
            if (p.event_type === "product_view") return `👁️ View ${p.product_id?.slice(0, 20) || ""}`;
            return `📄 ${p.page || p.event_type}`;
          })
          .join(" → "),
      };
    });

    // Calculate common paths
    const pathPatterns = new Map<string, number>();
    journeys.forEach((j) => {
      const pattern = j.path
        .map((p) => p.event_type)
        .filter((e) => e !== "page_view")
        .join(" → ");
      if (pattern) {
        pathPatterns.set(pattern, (pathPatterns.get(pattern) || 0) + j.frequency);
      }
    });

    const commonPaths = Array.from(pathPatterns.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return Response.json({
      journeys,
      common_paths: commonPaths,
      total_journeys: journeys.reduce((sum, j) => sum + j.frequency, 0),
      conversion_rate:
        journeys.length > 0
          ? (journeys.filter((j) => j.converted).length / journeys.length) * 100
          : 0,
    });
  } catch (err) {
    console.error("ClickHouse journey query error:", err);
    return Response.json(emptyJourney);
  }
}

