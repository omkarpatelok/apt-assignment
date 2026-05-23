-- Drop existing table if re-running setup
DROP TABLE IF EXISTS orders;

-- Exact schema as specified in assignment
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_name  VARCHAR(255) NOT NULL,
    product_name   VARCHAR(255) NOT NULL,
    status         VARCHAR(50)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Trigger function ──────────────────────────────────────────────────────────
-- Fires on INSERT, UPDATE, DELETE and sends a NOTIFY on 'orders_channel'
-- Payload is JSON: { event, data }
-- NOTE: Postgres NOTIFY payload limit is 8 KB, which is fine for single rows.
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS trigger AS $$
DECLARE
    payload JSON;
    record_data JSON;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        record_data := row_to_json(OLD);
    ELSE
        -- On INSERT/UPDATE also stamp updated_at
        NEW.updated_at := NOW();
        record_data := row_to_json(NEW);
    END IF;

    payload := json_build_object(
        'event', TG_OP,   -- 'INSERT' | 'UPDATE' | 'DELETE'
        'data',  record_data
    );

    PERFORM pg_notify('orders_channel', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;
CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();

-- ── Seed data ─────────────────────────────────────────────────────────────────
INSERT INTO orders (customer_name, product_name, status) VALUES
    ('Alice Johnson',  'Laptop Pro 15',   'delivered'),
    ('Bob Smith',      'Wireless Headset','shipped'),
    ('Carol Williams', 'USB-C Hub',       'pending');
