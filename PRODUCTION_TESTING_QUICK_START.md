# Production Testing - Quick Start Guide

## 🚀 Quick Start

### Step 1: Set Production Environment Variables

```bash
export PG_CONNECTION_STRING="postgres://your-prod-db..."
export CLICKHOUSE_URL="https://your-prod-clickhouse..."
export CLICKHOUSE_USER="your-prod-user"
export CLICKHOUSE_PASSWORD="your-prod-password"
export CLICKHOUSE_DATABASE="analytics"
export NEXT_PUBLIC_APP_URL="https://your-production-url.com"
```

### Step 2: Run Production-Safe Tests

#### Option A: Full End-to-End Test
```bash
pnpm run test:prod
```

#### Option B: Purchase Event Test Only
```bash
pnpm run test:prod:purchase
```

## ✅ What These Scripts Do

1. **Detect Production Environment** - Automatically detects if you're in production
2. **Require Confirmation** - Asks for explicit "yes" confirmation before proceeding
3. **Tag Test Data** - All test data is prefixed with `TEST-PROD-` for easy identification
4. **Use Minimal Values** - Test purchases use $0.01 to avoid affecting real metrics
5. **Provide Cleanup Instructions** - Shows exact SQL commands to remove test data

## 🧹 Quick Cleanup

After testing, remove test data:

### ClickHouse
```sql
DELETE FROM analytics.events WHERE user_id LIKE 'TEST-PROD-%';
```

### PostgreSQL Outbox
```sql
DELETE FROM outbox_events WHERE payload->>'user_id' LIKE 'TEST-PROD-%';
```

## 📋 Safety Features

- ✅ Production environment detection
- ✅ Explicit confirmation required
- ✅ Test data tagging (TEST-PROD prefix)
- ✅ Minimal test values ($0.01)
- ✅ Automatic cleanup instructions
- ✅ Test event ID tracking

## ⚠️ Important Notes

1. **Always test during low-traffic periods**
2. **Monitor your dashboards during testing**
3. **Clean up test data promptly after verification**
4. **Never use real user IDs or product IDs**
5. **Have a rollback plan ready**

## 📚 Full Documentation

See `PRODUCTION_TESTING.md` for comprehensive guide including:
- Detailed safety principles
- Monitoring strategies
- Troubleshooting
- Best practices
- Emergency procedures

