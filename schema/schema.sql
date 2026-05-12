CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS orders (
  order_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  VARCHAR(100) NOT NULL,
  order_date   TIMESTAMPTZ NOT NULL,
  order_amount DECIMAL(12, 2) NOT NULL,
  status       VARCHAR(50) NOT NULL,
  raw_data     JSONB,                      -- store extra fields
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date  ON orders(order_date);