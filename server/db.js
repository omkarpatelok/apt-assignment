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
