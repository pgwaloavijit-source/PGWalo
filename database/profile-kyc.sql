CREATE TABLE IF NOT EXISTS auth_otps (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_target ON auth_otps(target, purpose, consumed);

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN aadhaar_last4 TEXT;
ALTER TABLE users ADD COLUMN aadhaar_hash TEXT;
ALTER TABLE users ADD COLUMN permanent_address TEXT;
ALTER TABLE users ADD COLUMN alternate_phone TEXT;
