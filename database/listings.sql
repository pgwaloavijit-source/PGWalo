ALTER TABLE properties ADD COLUMN owner_user_id TEXT;
ALTER TABLE properties ADD COLUMN place_label TEXT;
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_user_id);
