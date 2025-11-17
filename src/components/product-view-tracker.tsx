"use client";

import { useEffect } from "react";
import { trackProductView } from "@/lib/analytics/client";

interface ProductViewTrackerProps {
  productSlug: string;
  productName: string;
  price: number;
  category?: string;
}

export function ProductViewTracker({
  productSlug,
  productName,
  price,
  category,
}: ProductViewTrackerProps) {
  useEffect(() => {
    trackProductView(productSlug, productName, price, category);
  }, [productSlug, productName, price, category]);

  return null;
}


