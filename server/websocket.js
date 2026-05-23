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
