CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  auth_path TEXT,
  intent TEXT,
  source_page TEXT,
  property_id TEXT,
  role TEXT,
  device_type TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_events_org ON auth_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_session ON auth_events(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
