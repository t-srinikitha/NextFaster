// app/api/analytics/personalize/route.ts
// Personalization API endpoint

import { NextRequest } from "next/server";
import { getPersonalizedRecommendations, getProductAffinities } from "@/lib/personalization";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const productId = searchParams.get("product_id");

  if (productId) {
    // Get product affinities (frequently bought together)
    const affinities = await getProductAffinities(productId);
    return Response.json({
      type: "product_affinities",
      recommendations: affinities,
    });
  }

  if (!userId) {
    return Response.json({ error: "user_id or product_id required" }, { status: 400 });
  }

  const recommendations = await getPersonalizedRecommendations(userId);
  return Response.json({
    type: "personalized",
    recommendations,
  });
}


