-- Admin console support: durable support tickets for the super admin Tickets screen.
-- The client previously kept these in localStorage only; the Worker PATCH endpoint
-- already assumed this table existed.
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Raised',
  admin_note TEXT,
  assigned_to TEXT,
  property_id TEXT,
  booking_id TEXT,
  messages TEXT NOT NULL DEFAULT '[]', -- JSON array of SupportTicketMessage
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester ON support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_property ON support_tickets(property_id);

-- Faster admin-console lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_submitted_at ON payments(submitted_at);
