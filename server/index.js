<<<<<<< HEAD
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
=======
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');

const { createListenerClient } = require('./db');
const { initWebSocketServer, broadcast } = require('./websocket');
const ordersRouter = require('./routes');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/orders', ordersRouter);

// Serve the client dashboard at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Boot everything up
async function start() {
    try {
        // 1. Init WebSocket server
        initWebSocketServer(server);

        // 2. Connect dedicated listener client to Postgres
        const listenerClient = await createListenerClient();

        // 3. When Postgres fires a notification, broadcast it to all WS clients
        listenerClient.on('notification', (msg) => {
            console.log('[DB] Notification received on channel:', msg.channel);

            try {
                const payload = JSON.parse(msg.payload);
                broadcast({
                    type: 'db_change',
                    operation: payload.operation,  // INSERT | UPDATE | DELETE
                    data: payload.data,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                console.error('[DB] Failed to parse notification payload:', err.message);
            }
        });

        // 4. Start HTTP server
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`\n APT Real-time Order System`);
            console.log(`----------------------------`);
            console.log(` Server:    http://localhost:${PORT}`);
            console.log(` WebSocket: ws://localhost:${PORT}`);
            console.log(` API:       http://localhost:${PORT}/api/orders`);
            console.log(`----------------------------\n`);
        });

    } catch (err) {
        console.error('[STARTUP] Failed to start server:', err.message);
        process.exit(1);
    }
}

start();
>>>>>>> 23f7a48b1fee03942acae4c7a1ac3fcc949b55d6
