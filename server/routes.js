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
});

module.exports = router;
