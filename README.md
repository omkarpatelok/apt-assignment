# APT Backend Assignment — Real-time DB Change Notifications

A backend system that pushes database changes to connected clients in real-time, without polling.

---

## The Problem I Was Solving

The core challenge was: *how do you tell clients something changed in the database, without making them constantly ask?*

The naive solution is polling — every client sends a request every N seconds asking "anything new?". It works, but it's wasteful. If 100 clients are connected and polling every 2 seconds, that's 3000 requests per minute hitting your database, most of which return nothing useful.

I wanted a push-based system. The database tells the server when something changes, and the server immediately tells all connected clients.

---

## My Approach

**PostgreSQL LISTEN/NOTIFY + WebSockets**

Here's the flow:

```
DB change (INSERT/UPDATE/DELETE)
    → Postgres trigger fires
    → NOTIFY sent on 'orders_channel' with JSON payload
    → Node.js listener client receives it
    → Broadcasts to all connected WebSocket clients
    → Browser UI updates in real-time
```

### Why PostgreSQL LISTEN/NOTIFY?

I considered three options:

**Option 1: Polling** — Client requests every few seconds. Simple but wasteful. Rejected.

**Option 2: Debezium / CDC tools** — Reads Postgres WAL (write-ahead log) for changes. Very powerful, used in production at scale. But heavyweight for this assignment — requires Kafka or similar infrastructure.

**Option 3: LISTEN/NOTIFY** — Built directly into Postgres. No extra infrastructure needed. The trigger runs inside the DB transaction itself, so notifications are guaranteed to fire when data changes. Clean, efficient, and well-suited to this problem.

I went with Option 3. For the scale of this assignment, it's the right tool — simple, reliable, and easy to reason about.

### Why WebSockets over SSE or Long Polling?

- **WebSockets** give a persistent, full-duplex connection. Perfect for real-time push.
- **SSE (Server-Sent Events)** would also work for one-way push, but WebSockets are more flexible if we later need bidirectional communication (e.g. client sending commands).
- **Long polling** is a workaround, not a real solution.

---

## Project Structure

```
apt-assignment/
├── server/
│   ├── index.js       # Entry point — boots HTTP, WebSocket, DB listener
│   ├── db.js          # Postgres connections (pool + dedicated listener)
│   ├── websocket.js   # WS server + broadcast helper
│   └── routes.js      # REST API for orders CRUD
├── client/
│   └── index.html     # Browser client — shows live events + orders table
├── sql/
│   └── setup.sql      # Table schema + trigger + seed data
├── .env.example
├── package.json
└── README.md
```

---

## How to Run

### Prerequisites
- Node.js v18+
- PostgreSQL running locally (or remote)

### Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd apt-assignment
npm install
```

### Step 2 — Set up the database

```bash
# Connect to your Postgres instance
psql -U postgres

# Create the database
CREATE DATABASE aptdb;

# Exit psql
\q

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
# or for development with auto-reload:
npm run dev
```

### Step 5 — Open the client

Go to `http://localhost:3000` in your browser. Open it in multiple tabs to see all tabs update simultaneously when you make a change.

---

## Testing it works

**Via the browser UI:**
- Add a new order using the form
- Watch the "Live DB Events" feed update immediately
- All open tabs receive the same event simultaneously

**Via the REST API directly:**

```bash
# Add an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name": "Test User", "product_name": "Pro Plan", "status": "pending"}'

# Update an order
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'

# Delete an order
curl -X DELETE http://localhost:3000/api/orders/1
```

Every curl command above will trigger a WebSocket push to all connected browser tabs.

**Via psql directly:**

```sql
-- This also triggers a notification
INSERT INTO orders (customer_name, product_name, status)
VALUES ('Direct Insert', 'Test Product', 'pending');
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
|---|---|---|
| Runtime | Node.js | Async I/O, great for real-time |
| Framework | Express | Minimal, well-known |
| Database | PostgreSQL | Native LISTEN/NOTIFY support |
| DB Client | node-postgres (pg) | Solid, well-maintained |
| Real-time | ws (WebSocket) | Lightweight, no bloat |
| Client | Vanilla HTML/JS | No framework needed for this |
