-- Property visibility lifecycle metadata. The row, rooms, beds, residents and
-- owner operations remain intact when a listing is hidden from discovery.
-- The migration runner adds these columns idempotently for existing databases.
CREATE INDEX IF NOT EXISTS idx_properties_visibility ON properties(status, plan_expires_at);
