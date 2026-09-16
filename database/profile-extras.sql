CREATE TABLE IF NOT EXISTS visit_notifications (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  owner_email TEXT,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  visit_date TEXT,
  visit_slot TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN profile_extras TEXT;
