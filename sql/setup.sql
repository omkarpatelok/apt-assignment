-- ==============================================
-- APT (Atypical Technologies Pvt Ltd)
-- AI-Powered Algorithmic Trading Platform
-- Database Setup — Run once before starting
-- ==============================================

-- Drop existing table and recreate with trading schema
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    broker_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    order_type VARCHAR(10) NOT NULL DEFAULT 'BUY' CHECK (order_type IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'CANCELLED')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger function: fires on any change to orders table
-- Sends a JSON payload via NOTIFY to 'orders_channel'
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF TG_OP = 'DELETE' THEN
        payload = json_build_object(
            'operation', TG_OP,
            'data', row_to_json(OLD)
        );
    ELSE
        payload = json_build_object(
            'operation', TG_OP,
            'data', row_to_json(NEW)
        );
    END IF;

    PERFORM pg_notify('orders_channel', payload::text);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();

-- Seed data: realistic Indian market trading orders
INSERT INTO orders (broker_name, symbol, order_type, quantity, price, status) VALUES
    ('Omkar Patel',   'NIFTY 50',   'BUY',  10,  24850.75, 'PENDING'),
    ('Rahul Sharma',  'RELIANCE',   'SELL', 50,  2945.30,  'EXECUTED'),
    ('Priya Mehta',   'BANKNIFTY',  'BUY',  25,  53120.00, 'EXECUTED'),
    ('Vikram Singh',  'TCS',        'SELL', 100, 3520.60,  'PENDING'),
    ('Anita Desai',   'HDFCBANK',   'BUY',  75,  1685.40,  'CANCELLED');

SELECT * FROM orders;
