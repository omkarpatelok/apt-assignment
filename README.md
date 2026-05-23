# APT Backend Assignment — Real-time DB Change Notifications

A backend system that pushes database changes to connected clients in real-time, without polling.

---

## The Problem

How do you tell clients something changed in the database, without making them constantly ask?

The naive answer is polling — every client sends a request every N seconds: "anything new?". It works, but it's wasteful. 100 clients polling every 2 seconds = 3,000 requests per minute, most returning nothing.

The solution here is a **push-based pipeline**: the database tells the server when something changes, and the server immediately tells all connected clients.

---

## My Approach: PostgreSQL LISTEN/NOTIFY + WebSockets

```
DB change (INSERT / UPDATE / DELETE on orders)
    → Postgres trigger fires  (notify_orders_change)
    → pg_notify('orders_channel', JSON payload)
    → Node.js listenerClient receives 'notification' event
    → broadcast() pushes JSON to all connected WebSocket clients
    → Browser UI updates in real-time (no page refresh)
```

### Why PostgreSQL LISTEN/NOTIFY?

I evaluated three approaches:

| Option | Mechanism | Verdict |
|--------|-----------|---------|
| Polling | Client asks DB every N seconds | ✗ Wasteful — rejected |
| CDC / Debezium | Reads Postgres WAL, streams via Kafka | ✗ Too heavy for this scope |
| **LISTEN/NOTIFY** | **Built into Postgres, trigger-driven** | **✓ Chosen** |

LISTEN/NOTIFY is built directly into PostgreSQL. The trigger runs inside the DB transaction, so the notification is guaranteed to fire whenever data actually changes — even if the change comes from psql directly (not through the API).

### Why WebSockets over SSE or Long Polling?

- **WebSockets** — persistent full-duplex connection, ideal for real-time push
- **SSE** — simpler, but one-way only; less flexible for future bidirectional needs
- **Long polling** — a workaround, not a real solution

---

## Schema

Exactly as specified in the assignment:

```sql
CREATE TABLE orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    product_name  VARCHAR(255) NOT NULL,
    status        VARCHAR(50)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

---

## Project Structure

```
apt-assignment/
├── server/
│   ├── index.js      # Entry point — boots HTTP server, WebSocket, DB listener
│   ├── db.js         # Postgres connections (pool for queries + dedicated listener)
│   ├── websocket.js  # WS server setup + broadcast helper
│   └── routes.js     # REST API for orders CRUD
├── client/
│   └── index.html    # Browser client — live event feed + orders table
├── sql/
│   └── setup.sql     # Table schema + trigger function + seed data
├── .env.example
├── package.json
└── README.md
```

---

## How to Run

### Prerequisites
- Node.js v18+
- PostgreSQL running locally (or remote)

### Step 1 — Install dependencies

```bash
cd apt-assignment
npm install
```

### Step 2 — Set up the database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE aptdb;"

# Run the setup script (creates table + trigger + seed data)
psql -U postgres -d aptdb -f sql/setup.sql
```

### Step 3 — Configure environment

```bash
cp .env.example .env
# Edit .env with your Postgres credentials
```

### Step 4 — Start the server

```bash
npm start
# or with auto-reload during development:
npm run dev
```

### Step 5 — Open the client

Go to `http://localhost:3000` in your browser. **Open multiple tabs** to see all of them update simultaneously when any change is made.

---

## Testing It Works

### Via the browser UI
- Fill in a customer name and product name → click **Insert**
- Watch the "Live DB Events" feed update immediately in all open tabs
- Click **Edit** on any row to prefill the form, then click **Update**
- Click **Delete** or use the Delete button in the table

### Via curl (REST API)

```bash
# Insert an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name": "Test User", "product_name": "Pro Plan", "status": "pending"}'

# Update an order's status
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'

# Delete an order
curl -X DELETE http://localhost:3000/api/orders/1
```

Every curl command triggers a WebSocket push to all connected browser tabs.

### Via psql directly

```sql
-- Direct DB inserts also trigger the notification (no API needed)
INSERT INTO orders (customer_name, product_name, status)
VALUES ('Direct Insert', 'Test Product', 'pending');

UPDATE orders SET status = 'delivered' WHERE id = 1;

DELETE FROM orders WHERE id = 2;
```

---

## Scalability Considerations

For this assignment, one server handles both HTTP and WebSocket. In production at scale, a few things would change:

- **Multiple server instances** would need a shared pub/sub layer (Redis pub/sub) so all instances can broadcast to their own clients when any instance receives a DB notification.
- **LISTEN/NOTIFY payload size** is limited to 8KB in Postgres. For large payloads, the notification would carry just the row ID and the server would fetch fresh data.
- **WebSocket connection limits** per server — production systems typically use a dedicated WebSocket gateway.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js | Non-blocking I/O, ideal for real-time |
| Framework | Express | Minimal, standard |
| Database | PostgreSQL | Native LISTEN/NOTIFY |
| DB Client | node-postgres (pg) | Reliable, well-maintained |
| Real-time | ws | Lightweight WebSocket library |
| Client | Vanilla HTML/JS | No framework overhead needed |
