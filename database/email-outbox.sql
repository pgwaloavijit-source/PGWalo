-- Transactional email engine: durable outbox + preferences + suppression.
-- Mirrors src/worker/email/outbox.ts ensureEmailTables() so a fresh
-- environment works whether it boots from SQL or from the lazy ensure path.

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  reply_to TEXT,
  category TEXT,
  org_id TEXT,
  property_id TEXT,
  entity_id TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  provider TEXT,
  provider_message_id TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

-- Idempotency: the same lifecycle event can never be emailed twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_dedupe
  ON email_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_outbox_drain
  ON email_outbox(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
  ON email_outbox(to_email, created_at);

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id TEXT PRIMARY KEY,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  disabled_categories TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
