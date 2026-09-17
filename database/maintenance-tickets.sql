-- Maintenance tickets (resident complaints -> warden/staff) were client-local
-- only: the table had no org or resident link, so complaints never reached the
-- warden and there was no way to notify the resident of a status change.
--
-- NOTE: the ADD COLUMN statements live in database/apply-migrations.sh
-- (ensure_maint_column), because SQLite cannot conditionally ALTER — a
-- duplicate-column error would abort the remaining statements in the batch.
-- This file only creates the idempotent indexes.
CREATE INDEX IF NOT EXISTS idx_maint_resident ON maintenance_tickets(resident_id);
CREATE INDEX IF NOT EXISTS idx_maint_org ON maintenance_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_maint_requester ON maintenance_tickets(requester_id);
