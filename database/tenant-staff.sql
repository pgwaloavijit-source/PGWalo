ALTER TABLE staff_members ADD COLUMN owner_user_id TEXT;
ALTER TABLE staff_members ADD COLUMN organization_id TEXT;
CREATE INDEX IF NOT EXISTS idx_staff_owner ON staff_members(owner_user_id);
