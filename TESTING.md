# End-to-End Testing Checklist

## Prerequisites

1. **ClickHouse is running**
   ```bash
   # Verify ClickHouse is up
   curl -s -u default:MyLocalSecret123 "http://127.0.0.1:8123/?query=SELECT 1"
   ```

2. **Analytics database and table exist**
   ```bash
   # Run the DDL if not already done
   clickhouse-client --password MyLocalSecret123 < db/clickhouse/001_create_analytics_events.sql
   
   # Or verify it exists:
   curl -s -u default:MyLocalSecret123 "http://127.0.0.1:8123/?query=SELECT count() FROM analytics.events FORMAT JSON"
   ```

3. **Postgres outbox table exists**
   ```bash
   # Apply migration if needed
   # Using your migration tool or:
   psql $PG_CONNECTION_STRING -f db/postgres/001_create_outbox.sql
   ```

## Testing Steps

### 1. Start the Outbox Worker

```bash
PG_CONNECTION_STRING="postgres://..." \
CLICKHOUSE_URL="http://localhost:8123" \
CLICKHOUSE_USER=default \
CLICKHOUSE_PASSWORD=MyLocalSecret123 \
CLICKHOUSE_DATABASE=analytics \
node scripts/outbox-worker.js
```

Or use the npm script:
```bash
PG_CONNECTION_STRING="postgres://..." \
CLICKHOUSE_URL="http://localhost:8123" \
CLICKHOUSE_USER=default \
CLICKHOUSE_PASSWORD=MyLocalSecret123 \
CLICKHOUSE_DATABASE=analytics \
pnpm run outbox:worker
```

**Expected output:** `Outbox worker connected to Postgres`

### 2. Simulate a Purchase

#### Option A: Use `createOrderWithOutbox()` in your code
Call the function from your order creation flow:
```typescript
import { createOrderWithOutbox } from "@/lib/analytics/outbox";

await createOrderWithOutbox({
  product_id: "test-product-123",
  price: 29.99,
}, "user-123");
```

#### Option B: Insert outbox row manually (quick test)
```sql
INSERT INTO outbox_events (event_id, event_type, payload)
VALUES (
  gen_random_uuid(),
  'purchase',
  '{"event_id": "' || gen_random_uuid() || '", "user_id": "test-user-123", "product_id": "test-product-123", "price": 29.99, "created_at": "' || now()::text || '"}'
);
```

Or use the test script:
```bash
node scripts/test-purchase.js
```

### 3. Wait for Processing

Wait **<2 seconds** for the outbox worker to process the event.

### 4. Verify in ClickHouse

```bash
curl -s -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123/?query=SELECT count() FROM analytics.events WHERE event_type='purchase' FORMAT JSON"
```

**Expected:** `{"data":[{"count()":"1"}]}` (or higher number if you've run tests before)

To see the actual events:
```bash
curl -s -u default:MyLocalSecret123 \
  "http://127.0.0.1:8123/?query=SELECT * FROM analytics.events WHERE event_type='purchase' ORDER BY event_time DESC LIMIT 5 FORMAT JSON"
```

### 5. Verify KPIs Endpoint

```bash
# If running Next.js dev server
curl http://localhost:3000/api/analytics/kpis
```

**Expected response:**
```json
{
  "purchases": 1,
  "views": 0,
  "conversion_rate": 0
}
```

Or visit in browser: `http://localhost:3000/api/analytics/kpis`

## Troubleshooting

### Outbox worker not processing events
- Check worker logs for errors
- Verify Postgres connection string
- Verify ClickHouse connection details
- Check that `sent = false` in `outbox_events` table

### Events not appearing in ClickHouse
- Check worker logs for errors
- Verify ClickHouse database name matches (default: `analytics`)
- Check table name matches (should be `analytics.events`)
- Verify event structure matches ClickHouse schema

### KPIs showing 0
- Verify events have `event_time >= now() - INTERVAL 1 DAY`
- Check that `event_type` matches exactly ('purchase', 'product_view')
- Verify ClickHouse connection in API route

## Quick Test Scripts

### Install tsx (if not already installed)
```bash
# Using pnpm (recommended)
pnpm add -D tsx

# Or using npm
npm install -D tsx

# Or using yarn
yarn add -D tsx
```

### Run Individual Test Purchase
```bash
# Using pnpm
pnpm run test:purchase

# Or using npm
npm run test:purchase

# Or manually with npx
npx tsx scripts/test-purchase.ts
```

### Run Full End-to-End Test
```bash
# Using pnpm
pnpm run test:e2e

# Or using npm
npm run test:e2e

# Or manually with npx
npx tsx scripts/test-e2e.ts
```

The e2e test will:
1. Check ClickHouse connection
2. Check Postgres connection
3. Verify analytics.events table exists
4. Insert a test purchase event
5. Wait for outbox worker to process
6. Verify event in ClickHouse
7. Check KPIs endpoint

