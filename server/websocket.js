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
