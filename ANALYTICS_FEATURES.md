# Analytics Features Documentation

## Overview

This NextFaster implementation includes a comprehensive analytics system powered by ClickHouse, featuring real-time tracking, advanced analytics, and creative insights.

## 🎯 Event Tracking

### Implemented Tracking
- ✅ **Product Views**: Automatically tracked when users view product pages
- ✅ **Add to Cart**: Tracked when users add items to cart
- ✅ **Purchases**: Tracked via outbox pattern for reliability
- ✅ **Page Views**: Automatic tracking across all pages

### Architecture
- **Client-side tracking**: Batched events sent every 2 seconds or 50 events
- **Server-side tracking**: Uses outbox pattern for critical events (purchases)
- **Session management**: Automatic session ID generation and tracking
- **Device detection**: Automatic device family detection (mobile/tablet/desktop)

## 📊 Analytics Dashboard

Access the dashboard at `/analytics`

### Features
- **Real-time updates**: Auto-refreshes every 30 seconds
- **Key metrics**: Total events, unique users, revenue, conversion rate, AOV
- **Time-series charts**: Events and revenue over time
- **Funnel visualization**: Conversion funnel with drop-off rates
- **Top products**: Most viewed products with engagement metrics
- **Trending products**: Live shopping momentum tracker

## 🚀 Advanced Analytics APIs

### 1. Stats API (`/api/analytics/stats`)
Comprehensive statistics including:
- Total events, unique users, sessions
- Purchases, product views, add to carts
- Revenue metrics and conversion rates

### 2. Time Series API (`/api/analytics/time-series`)
Time-based analytics with configurable intervals:
- Hourly or daily aggregation
- Event counts, unique users, revenue
- Filterable by event type

### 3. Top Products API (`/api/analytics/top-products`)
Product performance metrics:
- Most viewed products
- Revenue per product
- Unique user engagement

### 4. Funnel API (`/api/analytics/funnel`)
Conversion funnel analysis:
- Page views → Product views → Add to cart → Purchase
- Drop-off rates at each stage
- Conversion percentages

## 🎨 Creative Features

### 1. Real-time Funnel Analysis (`/api/analytics/funnel-realtime`)
Uses ClickHouse's `windowFunnel` function for precise funnel tracking:
- Configurable time windows (default 30 minutes)
- Session-based funnel progression
- Drop-off analysis

### 2. Live Shopping Momentum (`/api/analytics/momentum`)
Real-time trending products:
- Events in last 10 minutes vs last hour
- Momentum calculation (events per minute)
- Trend detection (accelerating/slowing)
- Revenue tracking

### 3. Customer Journey Mapping (`/api/analytics/journey`)
Visualize user paths through the site:
- Complete session journeys
- Common path patterns
- Conversion path analysis
- Journey frequency analysis

### 4. AI-Powered Insights (`/api/analytics/insights`)
Intelligent anomaly detection and recommendations:
- Cart abandonment alerts
- Revenue trend analysis
- Product affinity recommendations
- Conversion rate anomalies
- Sales predictions

### 5. Personalization Engine (`/api/analytics/personalize`)
User behavior-based recommendations:
- Personalized product recommendations
- Product affinities (frequently viewed together)
- Category-based suggestions
- User behavior analysis

## 🔧 Technical Implementation

### ClickHouse Schema
```sql
CREATE TABLE analytics.events (
  event_id String,
  event_time DateTime64(3),
  event_date Date,
  user_id String,
  session_id String,
  event_type String,
  product_id String,
  category String,
  price Float64,
  page String,
  referrer String,
  device_family String,
  country String,
  properties String
) ENGINE = ReplacingMergeTree(event_time)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, product_id);
```

### Outbox Pattern
- Purchase events written to PostgreSQL outbox table
- Background worker processes outbox and writes to ClickHouse
- Ensures reliable event delivery even if ClickHouse is temporarily unavailable

### Performance Optimizations
- Partitioned by month for efficient queries
- Ordered by date, event type, and product for fast aggregations
- ReplacingMergeTree for deduplication
- Batch inserts for high throughput

## 📈 Query Performance

All queries are optimized for ClickHouse:
- Aggregations use efficient GROUP BY
- Time-based filters use event_date for partition pruning
- Window functions (windowFunnel) for advanced analysis
- Materialized views can be added for common queries

## 🎯 Usage Examples

### Track Product View (Client-side)
```typescript
import { trackProductView } from "@/lib/analytics/client";

trackProductView(productSlug, productName, price, category);
```

### Track Purchase (Server-side with Outbox)
```typescript
import { trackPurchaseServer } from "@/lib/analytics/server";

await trackPurchaseServer(userId, productId, price, category);
```

### Get Personalized Recommendations
```typescript
const recommendations = await fetch(
  `/api/analytics/personalize?user_id=${userId}`
);
```

## 🚀 Future Enhancements

Potential additions:
- Real-time WebSocket updates for dashboard
- A/B testing framework integration
- Cohort analysis
- Retention metrics
- Geographic analytics
- Custom event types
- Export functionality

## 📝 Notes

- All analytics are privacy-conscious (no PII stored)
- Events are batched for performance
- Failed events are requeued automatically
- Dashboard auto-refreshes for real-time feel
- All queries handle empty data gracefully


