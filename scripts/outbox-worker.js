// scripts/outbox-worker.js

// npm i pg @clickhouse/client dotenv

// Load environment variables from .env.local file (or .env as fallback)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env if .env.local doesn't exist

const { Client } = require('pg');
const { createClient } = require('@clickhouse/client');

// Support multiple env var names for Postgres connection
const pgConnectionString = process.env.PG_CONNECTION_STRING || 
                          process.env.DATABASE_URL || 
                          process.env.POSTGRES_URL;

if (!pgConnectionString) {
  console.error('❌ Error: Postgres connection string not found!');
  console.error('   Please set one of: PG_CONNECTION_STRING, DATABASE_URL, or POSTGRES_URL');
  process.exit(1);
}

const clickhouseUrl = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
const clickhouseUser = process.env.CLICKHOUSE_USER || 'default';
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD || 'MyLocalSecret123';

const pg = new Client({ connectionString: pgConnectionString });
const ch = createClient({ 
  url: clickhouseUrl, 
  username: clickhouseUser, 
  password: clickhousePassword 
});

const POLL_INTERVAL = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 1000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 500);

async function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

async function run() {
  await pg.connect();
  console.log('Outbox worker connected to Postgres');

  while (true) {
    try {
      const { rows } = await pg.query(
        `SELECT id, event_id, event_type, payload
         FROM outbox_events
         WHERE sent = false
         ORDER BY created_at
         LIMIT $1`, 
        [BATCH_SIZE]
      );

      if (rows.length === 0) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      const chRows = rows.map(r => {
        const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
        const evTime = payload.event_time || payload.created_at || new Date().toISOString();
        return {
          event_id: payload.event_id || r.event_id,
          event_time: evTime.replace('T', ' ').replace('Z', ''),
          event_date: evTime.slice(0, 10),
          user_id: payload.user_id || '',
          session_id: payload.session_id || '',
          event_type: payload.event_type || r.event_type,
          product_id: payload.product_id || '',
          category: payload.category || '',
          price: payload.price || 0,
          page: payload.page || '',
          referrer: payload.referrer || '',
          device_family: payload.device_family || '',
          country: payload.country || '',
          properties: JSON.stringify(payload.properties || {})
        };
      });

      // insert into ClickHouse
      await ch.insert({ 
        table: `${process.env.CLICKHOUSE_DATABASE || 'default'}.events`, 
        format: 'JSONEachRow', 
        values: chRows 
      });

      const ids = rows.map(r => r.id);
      await pg.query(
        `UPDATE outbox_events SET sent = true, sent_at = now() WHERE id = ANY($1)`, 
        [ids]
      );

      console.log(`Flushed ${rows.length} events to ClickHouse`);
    } catch (err) {
      console.error('Outbox worker error:', err);
      await sleep(POLL_INTERVAL * 2);
    }
  }
}

run().catch(err => { 
  console.error('Worker crashed:', err); 
  process.exit(1); 
});

