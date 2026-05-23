<<<<<<< HEAD
/**
 * db.js — PostgreSQL connection management
 *
 * Two separate connections are used intentionally:
 *   1. pool        — for regular query work (CRUD via REST API)
 *   2. listenerClient — a DEDICATED client that stays connected and listens
 *                       for NOTIFY events on 'orders_channel'.
 *
 * A pooled client cannot reliably hold a LISTEN session because the pool
 * may recycle the connection. A dedicated client is the correct pattern.
 */

const { Pool, Client } = require('pg');
require('dotenv').config();

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'aptdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

// Pool — used for all normal queries (SELECT / INSERT / UPDATE / DELETE via API)
const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error:', err.message);
});

// Dedicated listener client — used exclusively for LISTEN / NOTIFY
const listenerClient = new Client(dbConfig);

module.exports = { pool, listenerClient };
=======
const { Client } = require('pg');

// We use a dedicated long-lived client for LISTEN
// because pg.Pool recycles connections which breaks LISTEN/NOTIFY
let listenerClient = null;

async function createListenerClient() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'aptdb',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'yourpassword',
    });

    await client.connect();
    console.log('[DB] Listener client connected');

    // Tell Postgres we want notifications from this channel
    await client.query('LISTEN orders_channel');
    console.log('[DB] Listening on channel: orders_channel');

    // Handle unexpected disconnections - try to reconnect
    client.on('error', async (err) => {
        console.error('[DB] Listener client error:', err.message);
        setTimeout(createListenerClient, 3000);
    });

    listenerClient = client;
    return client;
}

// Standard pool for regular queries (inserts, updates, deletes)
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'aptdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'yourpassword',
    max: 10,
});

module.exports = { pool, createListenerClient, getListenerClient: () => listenerClient };
>>>>>>> 23f7a48b1fee03942acae4c7a1ac3fcc949b55d6
