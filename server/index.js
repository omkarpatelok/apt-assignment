/**
 * index.js — Entry point
 *
 * Boots:
 *   1. Express HTTP server  (REST API + serves client HTML)
 *   2. WebSocket server     (real-time push to browsers)
 *   3. PostgreSQL LISTEN    (receives NOTIFY from DB trigger)
 *
 * Flow on a DB change:
 *   orders table mutated
 *     → Postgres trigger fires notify_orders_change()
 *     → pg_notify sends payload on 'orders_channel'
 *     → listenerClient receives 'notification' event
 *     → broadcast() pushes JSON to all connected WebSocket clients
 *     → browser UI updates in real-time
 */

require('dotenv').config();

const http    = require('http');
const path    = require('path');
const express = require('express');

const { listenerClient } = require('./db');
const { initWebSocket, broadcast } = require('./websocket');
const ordersRouter = require('./routes');

const PORT = parseInt(process.env.PORT || '3000');

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();

app.use(express.json());

// Serve the browser client from /client
app.use(express.static(path.join(__dirname, '..', 'client')));

// REST API
app.use('/api', ordersRouter);

// Fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const server = http.createServer(app);
initWebSocket(server);

// ── PostgreSQL LISTEN ─────────────────────────────────────────────────────────
async function startListening() {
  try {
    await listenerClient.connect();
    console.log('[DB] Listener client connected');

    await listenerClient.query('LISTEN orders_channel');
    console.log('[DB] Listening on orders_channel');

    listenerClient.on('notification', (msg) => {
      console.log(`[DB] Notification received on channel: ${msg.channel}`);

      let payload;
      try {
        payload = JSON.parse(msg.payload);
      } catch (e) {
        console.error('[DB] Failed to parse notification payload:', msg.payload);
        return;
      }

      // Forward the DB event straight to all connected WebSocket clients
      broadcast({
        type:  'db_change',
        event: payload.event,  // 'INSERT' | 'UPDATE' | 'DELETE'
        data:  payload.data,   // the row data
      });
    });

    listenerClient.on('error', (err) => {
      console.error('[DB] Listener client error:', err.message);
    });

  } catch (err) {
    console.error('[DB] Failed to start listener:', err.message);
    process.exit(1);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
  await startListening();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await listenerClient.end();
  server.close(() => process.exit(0));
});
