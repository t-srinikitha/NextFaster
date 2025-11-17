# Production Testing Guide

## ⚠️ Important Safety Considerations

Testing in production requires extreme caution. This guide outlines safe practices to test your analytics pipeline without impacting real users or data integrity.

## 🛡️ Safety Principles

1. **Never test with real user data** - Always use clearly marked test data
2. **Use test prefixes** - All test events should be identifiable
3. **Monitor impact** - Watch for any unintended side effects
4. **Have rollback plans** - Know how to clean up test data
5. **Test during low-traffic periods** - Minimize risk to real operations
6. **Use feature flags** - Control test exposure

## 📋 Pre-Production Testing Checklist

Before testing in production, ensure:

- [ ] All tests pass in staging/preview environment
- [ ] Database backups are current
- [ ] Monitoring and alerting are configured
- [ ] Rollback procedures are documented
- [ ] Team is notified of testing window
- [ ] Test data cleanup scripts are ready

## 🔧 Production Testing Methods

### Method 1: Tagged Test Data (Recommended)

Use the production-safe test scripts that automatically tag test data:

```bash
# Set production environment variables
export PG_CONNECTION_STRING="postgres://prod-db..."
export CLICKHOUSE_URL="https://prod-clickhouse..."
export CLICKHOUSE_USER="prod-user"
export CLICKHOUSE_PASSWORD="prod-password"
export CLICKHOUSE_DATABASE="analytics"
export NEXT_PUBLIC_APP_URL="https://your-production-url.com"

# Run production-safe test
pnpm run test:prod
```

**Features:**
- Automatically tags all test data with `test-` prefix
- Requires explicit confirmation for production
- Provides cleanup instructions
- Logs all test data IDs for easy removal

### Method 2: Manual Test Event Insertion

For more control, manually insert test events:

```sql
-- Insert a clearly marked test event
INSERT INTO outbox_events (event_id, event_type, payload)
VALUES (
  gen_random_uuid(),
  'purchase',
  jsonb_build_object(
    'event_id', gen_random_uuid(),
    'user_id', 'TEST-USER-PROD-' || extract(epoch from now()),
    'product_id', 'TEST-PRODUCT-PROD-' || extract(epoch from now()),
    'price', 0.01,  -- Use minimal price for tests
    'created_at', now(),
    'event_type', 'purchase',
    'test_flag', true  -- Mark as test
  )
);
```

### Method 3: Feature Flag Testing

Test new features behind feature flags:

```typescript
// In your code
if (process.env.ENABLE_ANALYTICS_TEST === 'true') {
  // Test new analytics logic
}
```

## 🧹 Test Data Cleanup

### Cleanup Test Events from ClickHouse

```sql
-- Remove test events from ClickHouse
-- Run this in ClickHouse console or via API

DELETE FROM analytics.events 
WHERE user_id LIKE 'test-%' 
   OR user_id LIKE 'TEST-%'
   OR product_id LIKE 'test-%'
   OR product_id LIKE 'TEST-%';
```

### Cleanup Test Events from Outbox

```sql
-- Remove test events from PostgreSQL outbox
DELETE FROM outbox_events 
WHERE payload->>'user_id' LIKE 'test-%'
   OR payload->>'user_id' LIKE 'TEST-%'
   OR payload->>'product_id' LIKE 'test-%'
   OR payload->>'product_id' LIKE 'TEST-%';
```

## 📊 Monitoring During Tests

### 1. Monitor Database Load

```bash
# Check PostgreSQL connections
psql $PG_CONNECTION_STRING -c "SELECT count(*) FROM pg_stat_activity;"

# Check ClickHouse query performance
curl -u $CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD \
  "$CLICKHOUSE_URL/?query=SELECT count() FROM analytics.events WHERE event_time >= now() - INTERVAL 1 HOUR"
```

### 2. Monitor Application Metrics

- Watch error rates in your monitoring dashboard
- Check API response times
- Monitor outbox worker processing times
- Track ClickHouse ingestion rates

### 3. Verify Test Data Isolation

```bash
# Count test vs real events
curl -u $CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD \
  "$CLICKHOUSE_URL/?query=SELECT event_type, count() as count FROM analytics.events WHERE user_id LIKE 'test-%' OR user_id LIKE 'TEST-%' GROUP BY event_type FORMAT JSON"
```

## 🚨 Emergency Rollback

If something goes wrong:

1. **Stop the outbox worker** (if running)
2. **Pause test script execution**
3. **Clean up test data** using cleanup scripts above
4. **Verify production metrics** return to normal
5. **Review logs** to identify issues

## ✅ Post-Testing Verification

After testing, verify:

- [ ] Test data is properly tagged and identifiable
- [ ] Real user data is unaffected
- [ ] Analytics dashboards show expected results
- [ ] No performance degradation
- [ ] Error rates are normal
- [ ] Test data cleanup is scheduled/completed

## 🔐 Environment Detection

The production test scripts automatically detect production environments by checking:

- `NODE_ENV === 'production'`
- `VERCEL_ENV === 'production'`
- Production-like database URLs (contains 'prod', 'production', etc.)

When production is detected, the scripts will:
- Require explicit confirmation
- Use test prefixes for all data
- Provide detailed logging
- Show cleanup instructions

## 📝 Best Practices

1. **Schedule testing windows** - Coordinate with team
2. **Test incrementally** - Start with read-only tests, then small writes
3. **Document everything** - Log all test activities
4. **Use separate test accounts** - Never use real user accounts
5. **Monitor closely** - Watch dashboards during tests
6. **Clean up promptly** - Remove test data after verification
7. **Review results** - Analyze test outcomes before next steps

## 🎯 Testing Scenarios

### Scenario 1: End-to-End Pipeline Test

```bash
# Full pipeline test with production-safe defaults
pnpm run test:prod
```

### Scenario 2: Purchase Event Test Only

```bash
# Test just purchase event insertion
pnpm run test:prod:purchase
```

### Scenario 3: API Endpoint Test

```bash
# Test analytics API endpoints
curl https://your-production-url.com/api/analytics/kpis
curl https://your-production-url.com/api/analytics/stats
```

### Scenario 4: Outbox Worker Test

```bash
# Test outbox worker processing
# Insert test event, then monitor worker logs
pnpm run test:prod:purchase
# Watch outbox worker logs for processing
```

## 🔍 Troubleshooting Production Tests

### Issue: Test events not appearing in ClickHouse

**Check:**
- Outbox worker is running and connected
- ClickHouse connection credentials are correct
- Network connectivity between services
- Worker logs for errors

### Issue: Test events affecting real analytics

**Solution:**
- Ensure test data has proper prefixes
- Filter test data in analytics queries
- Use separate test database if possible

### Issue: Performance degradation

**Solution:**
- Reduce test batch sizes
- Test during off-peak hours
- Monitor resource usage
- Scale resources if needed

## 📞 Support

If you encounter issues during production testing:

1. Check logs for error messages
2. Review this guide for common issues
3. Verify environment configuration
4. Contact team lead if critical issues arise

