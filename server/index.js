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
