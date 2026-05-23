<<<<<<< HEAD
/**
 * routes.js — REST API for the orders table
 *
 * Endpoints:
 *   GET    /api/orders          — list all orders (newest first)
 *   GET    /api/orders/:id      — get a single order
 *   POST   /api/orders          — create an order
 *   PATCH  /api/orders/:id      — update fields on an order
 *   DELETE /api/orders/:id      — delete an order
 *
 * All mutations hit the DB directly; the Postgres trigger + LISTEN/NOTIFY
 * pipeline handles notifying WebSocket clients automatically.
 * The REST layer doesn't need to touch WebSockets at all.
 */

const express = require('express');
const { pool } = require('./db');

const router = express.Router();

// ── GET /api/orders ────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY updated_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[API] GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/orders/:id ────────────────────────────────────────────────────────
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[API] GET /orders/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── POST /api/orders ───────────────────────────────────────────────────────────
// Body: { customer_name, product_name, status? }
router.post('/orders', async (req, res) => {
  const { customer_name, product_name, status = 'pending' } = req.body;

  if (!customer_name || !product_name) {
    return res.status(400).json({ error: 'customer_name and product_name are required' });
  }

  const validStatuses = ['pending', 'shipped', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO orders (customer_name, product_name, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customer_name, product_name, status]
    );
    // Trigger fires in DB → NOTIFY → WebSocket broadcast happens automatically
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[API] POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ── PATCH /api/orders/:id ──────────────────────────────────────────────────────
// Body: { customer_name?, product_name?, status? }
router.patch('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { customer_name, product_name, status } = req.body;

  const validStatuses = ['pending', 'shipped', 'delivered'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  // Build SET clause dynamically — only update provided fields
  const fields = [];
  const values = [];
  let idx = 1;

  if (customer_name !== undefined) { fields.push(`customer_name = $${idx++}`); values.push(customer_name); }
  if (product_name  !== undefined) { fields.push(`product_name = $${idx++}`);  values.push(product_name);  }
  if (status        !== undefined) { fields.push(`status = $${idx++}`);        values.push(status);        }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id); // for the WHERE clause

  try {
    const result = await pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[API] PATCH /orders/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ── DELETE /api/orders/:id ─────────────────────────────────────────────────────
router.delete('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted', order: result.rows[0] });
  } catch (err) {
    console.error('[API] DELETE /orders/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete order' });
  }
=======
const express = require('express');
const router = express.Router();
const { pool } = require('./db');

// GET all trade orders
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY updated_at DESC');
        res.json({ success: true, orders: result.rows });
    } catch (err) {
        console.error('[API] Error fetching orders:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST — place a new trade order (triggers INSERT notification)
router.post('/', async (req, res) => {
    const { broker_name, symbol, order_type = 'BUY', quantity = 1, price = 0, status = 'PENDING' } = req.body;

    if (!broker_name || !symbol) {
        return res.status(400).json({ success: false, error: 'broker_name and symbol are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO orders (broker_name, symbol, order_type, quantity, price, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [broker_name, symbol, order_type, quantity, price, status]
        );
        res.status(201).json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[API] Error placing order:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH — update trade order (triggers UPDATE notification)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { broker_name, symbol, order_type, quantity, price, status } = req.body;

    try {
        const result = await pool.query(
            `UPDATE orders
             SET broker_name = COALESCE($1, broker_name),
                 symbol = COALESCE($2, symbol),
                 order_type = COALESCE($3, order_type),
                 quantity = COALESCE($4, quantity),
                 price = COALESCE($5, price),
                 status = COALESCE($6, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [broker_name, symbol, order_type, quantity, price, status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[API] Error updating order:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE — cancel/remove trade order (triggers DELETE notification)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        res.json({ success: true, deleted: result.rows[0] });
    } catch (err) {
        console.error('[API] Error deleting order:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
>>>>>>> 23f7a48b1fee03942acae4c7a1ac3fcc949b55d6
});

module.exports = router;
