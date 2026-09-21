const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// The Neon serverless driver can use WebSockets for full session/transaction
// support (needed here for multi-statement transactions like quiz creation
// with its questions). In a plain Node runtime (local dev) we wire up the
// `ws` package; on Vercel's Node.js serverless runtime WebSockets are
// natively available and this is a no-op.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    '[db] DATABASE_URL is not set. Copy .env.example to .env and fill in your Neon connection string.'
  );
}

const pool = new Pool({ connectionString });

// Background connection errors (e.g. an idle socket dropped by Neon after
// a period of inactivity) surface as an 'error' event on the pool rather
// than rejecting any particular query. Without this handler, Node treats
// that as an uncaught exception and kills the whole function instance.
pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle Postgres client', err);
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
