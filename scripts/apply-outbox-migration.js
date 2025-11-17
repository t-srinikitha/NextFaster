// scripts/apply-outbox-migration.js
// Apply the outbox table migration

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const pgConnectionString = process.env.PG_CONNECTION_STRING || 
                          process.env.DATABASE_URL || 
                          process.env.POSTGRES_URL;

if (!pgConnectionString) {
  console.error('❌ Error: Postgres connection string not found!');
  process.exit(1);
}

async function applyMigration() {
  const pg = new Client({ connectionString: pgConnectionString });
  
  try {
    await pg.connect();
    console.log('✅ Connected to database');
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../db/postgres/001_create_outbox.sql'),
      'utf8'
    );
    
    await pg.query(sql);
    console.log('✅ Outbox table migration applied successfully!');
    
    // Verify table exists
    const result = await pg.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'outbox_events'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Verified: outbox_events table exists');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pg.end();
  }
}

applyMigration();


