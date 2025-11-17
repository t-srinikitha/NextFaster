// scripts/setup-clickhouse.js
// Set up ClickHouse database and analytics.events table

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const https = require('https');
const http = require('http');

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || 'MyLocalSecret123';
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'analytics';

// Parse the URL
const url = new URL(CLICKHOUSE_URL);
const protocol = url.protocol === 'https:' ? https : http;
const auth = `${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`;

function executeQuery(query) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`,
        'Content-Type': 'text/plain',
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(query);
    req.end();
  });
}

async function setupClickHouse() {
  try {
    console.log('🔍 Connecting to ClickHouse...');
    
    // Test connection
    await executeQuery('SELECT 1');
    console.log('✅ ClickHouse connection successful\n');

    // Create database
    console.log(`📦 Creating database: ${CLICKHOUSE_DATABASE}...`);
    await executeQuery(`CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}`);
    console.log(`✅ Database '${CLICKHOUSE_DATABASE}' created or already exists\n`);

    // Create events table
    console.log('📊 Creating analytics.events table...');
    const createTableQuery = `
CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.events (
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
    `.trim();

    await executeQuery(createTableQuery);
    console.log('✅ Table analytics.events created or already exists\n');

    // Verify table exists
    console.log('🔍 Verifying table...');
    const tables = await executeQuery(`SHOW TABLES FROM ${CLICKHOUSE_DATABASE}`);
    if (tables.includes('events')) {
      console.log('✅ Verified: events table exists\n');
    }

    // Check current event count
    try {
      const countResult = await executeQuery(
        `SELECT count() as count FROM ${CLICKHOUSE_DATABASE}.events FORMAT JSON`
      );
      const count = JSON.parse(countResult).data?.[0]?.count || 0;
      console.log(`📈 Current event count: ${count}\n`);
    } catch (e) {
      // Table might be empty, that's okay
      console.log('📈 Table is ready (no events yet)\n');
    }

    console.log('🎉 ClickHouse setup complete!');
    console.log('\nYou can now:');
    console.log('  1. Run: pnpm run test:purchase (to insert test events)');
    console.log('  2. Run: pnpm run test:e2e (to test the full pipeline)');
    console.log('  3. Check analytics at: http://localhost:3000/api/analytics/kpis');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure ClickHouse is running on', CLICKHOUSE_URL);
    }
    process.exit(1);
  }
}

setupClickHouse();

