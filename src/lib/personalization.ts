// lib/personalization.ts
// Real-time Personalization Engine using ClickHouse data

import { getClickHouseClient, getClickHouseDatabase } from "./clickhouse";

interface UserBehavior {
  product_category: string;
  interactions: number;
  avg_price_point: number;
}

export async function getUserBehavior(userId: string) {
  try {
    const query = `
      SELECT 
        category as product_category,
        count() as interactions,
        avg(price) as avg_price_point
      FROM ${getClickHouseDatabase()}.events
      WHERE user_id = {userId:String}
        AND category != ''
        AND event_type IN ('product_view', 'add_to_cart', 'purchase')
      GROUP BY category
      ORDER BY interactions DESC
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: { userId },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        product_category: string;
        interactions: string;
        avg_price_point: string;
      }>;
    };

    return (data?.data || []).map((d) => ({
      product_category: d.product_category,
      interactions: Number(d.interactions),
      avg_price_point: Number(d.avg_price_point),
    })) as UserBehavior[];
  } catch (error) {
    console.error("Failed to get user behavior:", error);
    return [];
  }
}

export async function getPersonalizedRecommendations(userId: string) {
  const userBehavior = await getUserBehavior(userId);

  if (userBehavior.length === 0) {
    // No behavior data, return popular products
    return getPopularProducts();
  }

  // Get products similar to user's preferred categories
  const preferredCategories = userBehavior
    .slice(0, 3)
    .map((b) => b.product_category);

  try {
    const query = `
      SELECT 
        product_id,
        category,
        count() as view_count,
        avg(price) as avg_price,
        uniq(user_id) as unique_viewers
      FROM ${getClickHouseDatabase()}.events
      WHERE category IN ({categories:Array(String)})
        AND event_type = 'product_view'
        AND event_time >= now() - INTERVAL 7 DAY
        AND product_id != ''
      GROUP BY product_id, category
      ORDER BY view_count DESC, unique_viewers DESC
      LIMIT 10
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: { categories: preferredCategories },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        product_id: string;
        category: string;
        view_count: string;
        avg_price: string;
        unique_viewers: string;
      }>;
    };

    return (data?.data || []).map((d) => ({
      product_id: d.product_id,
      category: d.category,
      view_count: Number(d.view_count),
      avg_price: Number(d.avg_price),
      unique_viewers: Number(d.unique_viewers),
      reason: `Based on your interest in ${d.category}`,
    }));
  } catch (error) {
    console.error("Failed to get personalized recommendations:", error);
    return getPopularProducts();
  }
}

async function getPopularProducts() {
  try {
    const query = `
      SELECT 
        product_id,
        category,
        count() as view_count,
        avg(price) as avg_price
      FROM ${getClickHouseDatabase()}.events
      WHERE event_type = 'product_view'
        AND event_time >= now() - INTERVAL 7 DAY
        AND product_id != ''
      GROUP BY product_id, category
      ORDER BY view_count DESC
      LIMIT 10
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        product_id: string;
        category: string;
        view_count: string;
        avg_price: string;
      }>;
    };

    return (data?.data || []).map((d) => ({
      product_id: d.product_id,
      category: d.category,
      view_count: Number(d.view_count),
      avg_price: Number(d.avg_price),
      reason: "Popular right now",
    }));
  } catch (error) {
    console.error("Failed to get popular products:", error);
    return [];
  }
}

export async function getProductAffinities(productId: string) {
  try {
    // Find products frequently viewed together
    const query = `
      WITH product_sessions AS (
        SELECT 
          session_id,
          groupArray(product_id) as products
        FROM ${getClickHouseDatabase()}.events
        WHERE event_type = 'product_view'
          AND event_time >= now() - INTERVAL 7 DAY
          AND product_id != ''
        GROUP BY session_id
        HAVING has(products, {productId:String})
      )
      SELECT 
        arrayJoin(products) as related_product,
        count() as co_occurrences
      FROM product_sessions
      WHERE related_product != {productId:String}
      GROUP BY related_product
      ORDER BY co_occurrences DESC
      LIMIT 5
    `;

    const ch = getClickHouseClient();
    const result = await ch.query({
      query,
      query_params: { productId },
      format: "JSON",
    });

    const data = (await result.json()) as {
      data?: Array<{
        related_product: string;
        co_occurrences: string;
      }>;
    };

    return (data?.data || []).map((d) => ({
      product_id: d.related_product,
      co_occurrences: Number(d.co_occurrences),
    }));
  } catch (error) {
    console.error("Failed to get product affinities:", error);
    return [];
  }
}

