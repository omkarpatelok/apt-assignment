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
