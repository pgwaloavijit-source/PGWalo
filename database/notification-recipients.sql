-- Personal notifications: `recipient_id` NULL means an announcement for
-- everyone in scope, a value means "show this to that account only" (e.g. a
-- support-ticket status change). Without it a status change could not reach the
-- requester, and every user saw every notification.
ALTER TABLE broadcast_notifications ADD COLUMN recipient_id TEXT;
CREATE INDEX IF NOT EXISTS idx_broadcast_recipient ON broadcast_notifications(recipient_id);
