<<<<<<< HEAD
/**
 * websocket.js — WebSocket server setup and broadcast helper
 *
 * Uses the 'ws' library (lightweight, no socket.io overhead).
 * Attaches to the existing HTTP server so both HTTP and WS run on one port.
 */

const WebSocket = require('ws');

let wss;

/**
 * Initialise the WebSocket server, attaching it to the given HTTP server.
 * @param {import('http').Server} httpServer
 */
function initWebSocket(httpServer) {
  wss = new WebSocket.Server({ server: httpServer });

  wss.on('connection', (ws, req) => {
    console.log(`[WS] Client connected  — total: ${wss.clients.size}`);

    // Send a welcome acknowledgment so the client knows the connection is live
    ws.send(JSON.stringify({ type: 'connected', message: 'Listening for DB changes...' }));

    ws.on('close', () => {
      console.log(`[WS] Client disconnected — total: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  console.log('[WS] WebSocket server ready');
  return wss;
}

/**
 * Broadcast a message to every connected WebSocket client.
 * Skips clients that are not in OPEN state.
 * @param {object} payload — will be JSON-serialised before sending
 */
function broadcast(payload) {
  if (!wss) return;

  const message = JSON.stringify(payload);
  let sent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  console.log(`[WS] Broadcasted to ${sent} client(s)`);
}

module.exports = { initWebSocket, broadcast };
=======
const WebSocket = require('ws');

let wss = null;

function initWebSocketServer(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        console.log(`[WS] Client connected: ${clientIp} | Total: ${wss.clients.size}`);

        // Send a welcome message so client knows connection is alive
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to APT real-time order updates',
            timestamp: new Date().toISOString()
        }));

        ws.on('close', () => {
            console.log(`[WS] Client disconnected | Remaining: ${wss.clients.size}`);
        });

        ws.on('error', (err) => {
            console.error('[WS] Client error:', err.message);
        });
    });

    console.log('[WS] WebSocket server initialized');
    return wss;
}

// Broadcast a message to every connected WebSocket client
function broadcast(data) {
    if (!wss) return;

    const message = JSON.stringify(data);
    let sent = 0;

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sent++;
        }
    });

    console.log(`[WS] Broadcast to ${sent} client(s):`, data);
}

module.exports = { initWebSocketServer, broadcast };
>>>>>>> 23f7a48b1fee03942acae4c7a1ac3fcc949b55d6
