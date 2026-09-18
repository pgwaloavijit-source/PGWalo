-- Publishing plans, PG numbers and payment orders.
--
-- Idempotent on purpose: every statement is CREATE ... IF NOT EXISTS. The two
-- `properties` columns are added by database/apply-migrations.sh (SQLite has no
-- ADD COLUMN IF NOT EXISTS), so this file is safe to re-run on any database.

-- One row per attempt to pay for a listing. The gateway is only ever the
-- transport: `provider = 'none'` records a simulated order so the whole flow
-- (pricing -> pay -> badge -> invoice) works before live keys are installed.
CREATE TABLE IF NOT EXISTS listing_payments (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_name TEXT,
  owner_user_id TEXT,
  organization_id TEXT,
  plan_id TEXT NOT NULL,
  plan_name TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',       -- created | paid | failed | cancelled
  provider TEXT NOT NULL DEFAULT 'none',        -- razorpay | none
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_link_id TEXT,
  payment_link TEXT,
  invoice_number TEXT,
  failure_reason TEXT,
  receipt_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  paid_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_listing_payments_property ON listing_payments(property_id);
CREATE INDEX IF NOT EXISTS idx_listing_payments_owner ON listing_payments(owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_listing_payments_status ON listing_payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_payments_order ON listing_payments(provider_order_id);

-- Durable payment webhook log, so a replayed or out-of-order gateway callback
-- can never double-fulfil an order.
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT,
  payment_id TEXT,
  order_id TEXT,
  signature_ok INTEGER NOT NULL DEFAULT 0,
  payload TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);
