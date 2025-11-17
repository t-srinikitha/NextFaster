# Quick Testing Guide - Analytics Dashboard

## Current Status ✅

- ✅ Outbox worker is running
- ✅ Outbox table created in database
- ✅ Test purchase event inserted

## Next Steps

### 1. Make Sure ClickHouse is Running

ClickHouse needs to be running for the analytics to work. If you haven't started it:

```bash
# If using Docker:
docker run -d \
  --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=MyLocalSecret123 \
  clickhouse/clickhouse-server

# Or if you have it installed locally, start the service
```

### 2. Create ClickHouse Database and Table

Run the DDL to create the analytics database:

```bash
# Using clickhouse-client (if installed)
clickhouse-client --password MyLocalSecret123 < db/clickhouse/001_create_analytics_events.sql

# Or using curl
curl -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123/?query=CREATE DATABASE IF NOT EXISTS analytics"

curl -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123" \
  --data-binary @db/clickhouse/001_create_analytics_events.sql
```

### 3. Test the Full Flow

Run the automated end-to-end test:

```bash
pnpm run test:e2e
```

This will:
- ✅ Check ClickHouse connection
- ✅ Check Postgres connection  
- ✅ Insert a test purchase
- ✅ Wait for outbox worker to process it
- ✅ Verify it appears in ClickHouse
- ✅ Test the KPIs API endpoint

### 4. View Analytics Dashboard

#### Option A: Via API Endpoint

If your Next.js dev server is running:

```bash
# Start dev server (in another terminal)
pnpm dev

# Then visit or curl:
curl http://localhost:3000/api/analytics/kpis
```

Expected response:
```json
{
  "purchases": 1,
  "views": 0,
  "conversion_rate": 0
}
```

#### Option B: Create a Dashboard Page

You can create a simple dashboard page at `src/app/analytics/page.tsx`:

```tsx
export default async function AnalyticsPage() {
  const res = await fetch('http://localhost:3000/api/analytics/kpis', {
    cache: 'no-store'
  });
  const data = await res.json();
  
  return (
    <div>
      <h1>Analytics Dashboard</h1>
      <div>
        <p>Purchases: {data.purchases}</p>
        <p>Views: {data.views}</p>
        <p>Conversion Rate: {(data.conversion_rate * 100).toFixed(2)}%</p>
      </div>
    </div>
  );
}
```

### 5. Verify Events in ClickHouse

Check if events are being processed:

```bash
# Count purchase events
curl -s -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123/?query=SELECT count() FROM analytics.events WHERE event_type='purchase' FORMAT JSON"

# See recent events
curl -s -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123/?query=SELECT * FROM analytics.events WHERE event_type='purchase' ORDER BY event_time DESC LIMIT 5 FORMAT JSON"
```

## Troubleshooting

### Outbox Worker Not Processing

Check the worker logs. It should show:
```
Outbox worker connected to Postgres
Flushed X events to ClickHouse
```

### Events Not in ClickHouse

1. Check worker logs for errors
2. Verify ClickHouse is running: `curl -u default:MyLocalSecret123 "http://127.0.0.1:8123/?query=SELECT 1"`
3. Check if table exists: `curl -u default:MyLocalSecret123 "http://127.0.0.1:8123/?query=SHOW TABLES FROM analytics"`

### KPIs Showing 0

- Events must be from the last 24 hours (see the query in `route.ts`)
- Make sure ClickHouse has the events
- Check that `CLICKHOUSE_DATABASE=analytics` is set in `.env.local`


