// lib/analytics/client.ts

interface AnalyticsEvent {
  event_id?: string;
  event_time?: string;
  user_id?: string;
  session_id?: string;
  event_type: string;
  product_id?: string;
  category?: string;
  price?: number;
  page?: string;
  referrer?: string;
  device_family?: string;
  country?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

const buffer: AnalyticsEvent[] = [];

let timer: NodeJS.Timeout | null = null;
let sessionId: string | null = null;

const FLUSH_INTERVAL = 2000; // ms
const MAX_BATCH = 50;

// Get or create session ID
function getSessionId(): string {
  if (!sessionId) {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("analytics_session_id");
      if (stored) {
        sessionId = stored;
      } else {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("analytics_session_id", sessionId);
      }
    } else {
      sessionId = "unknown";
    }
  }
  return sessionId;
}

function getDeviceFamily(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}

function flush() {
  if (buffer.length === 0) return;

  const payload = buffer.splice(0, buffer.length);

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: payload }),
  }).catch((err) => {
    console.error("analytics send failed", err);
    // Requeue failed events
    buffer.unshift(...payload);
  });

  clearTimeout(timer!);
  timer = null;
}

export function recordEvent(evt: AnalyticsEvent) {
  // make sure event has event_id + event_time
  if (!evt.event_id && typeof crypto !== "undefined" && crypto.randomUUID) {
    evt.event_id = crypto.randomUUID();
  }
  if (!evt.event_time) {
    evt.event_time = new Date().toISOString();
  }
  if (!evt.session_id) {
    evt.session_id = getSessionId();
  }
  if (!evt.device_family) {
    evt.device_family = getDeviceFamily();
  }
  if (!evt.page && typeof window !== "undefined") {
    evt.page = window.location.pathname;
  }
  if (!evt.referrer && typeof document !== "undefined") {
    evt.referrer = document.referrer || "";
  }

  buffer.push(evt);

  if (buffer.length >= MAX_BATCH) {
    return flush();
  }

  if (!timer) {
    timer = setTimeout(flush, FLUSH_INTERVAL);
  }
}

// Helper functions for common events
export function trackProductView(productSlug: string, productName: string, price: number, category?: string) {
  recordEvent({
    event_type: "product_view",
    product_id: productSlug,
    price,
    category,
    properties: {
      product_name: productName,
    },
  });
}

export function trackAddToCart(productSlug: string, productName: string, price: number, category?: string) {
  recordEvent({
    event_type: "add_to_cart",
    product_id: productSlug,
    price,
    category,
    properties: {
      product_name: productName,
    },
  });
}

export function trackPageView(page: string) {
  recordEvent({
    event_type: "page_view",
    page,
  });
}

