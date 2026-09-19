-- P1 features (spec §28–§30) — additive only, safe to re-run.
-- §29 Guardian access · §30 Institutional bulk booking · §28 Meal ops/cost log.

-- ------------------------------------------------------------ guardian access
-- Revocable invite tokens per resident. Guardians authenticate with the
-- token itself (no account), so scope is the resident, never the org.
CREATE TABLE IF NOT EXISTS guardian_access (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  resident_id TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT,
  relation TEXT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);
CREATE INDEX IF NOT EXISTS idx_guardian_resident ON guardian_access(resident_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardian_token ON guardian_access(token_hash);

-- ------------------------------------------------------- institutional leads
-- Bulk demand source (spec §30). Own lifecycle; never blocks the CRM lead flow.
CREATE TABLE IF NOT EXISTS institutional_leads (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  institution_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  required_beds INTEGER NOT NULL DEFAULT 1,
  gender_eligibility TEXT, -- male | female | any
  target_localities TEXT, -- JSON array
  budget_per_bed REAL,
  move_in_date TEXT,
  duration_months INTEGER,
  status TEXT NOT NULL DEFAULT 'new', -- new | shortlisting | allocated | won | lost
  shortlisted_property_ids TEXT, -- JSON array
  allocated_bed_ids TEXT, -- JSON array
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inst_leads_org_status ON institutional_leads(organization_id, status);

-- ----------------------------------------------------------------- meal ops
-- Cost/waste link for food operations (spec §28). One row per property per
-- meal per day: what was planned, prepared, actually eaten, what it cost.
CREATE TABLE IF NOT EXISTS meal_ops_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  property_id TEXT NOT NULL,
  date TEXT NOT NULL,
  meal TEXT NOT NULL, -- breakfast | lunch | snacks | dinner
  menu TEXT,
  expected_count INTEGER NOT NULL DEFAULT 0,
  prepared_count INTEGER NOT NULL DEFAULT 0,
  attendance_count INTEGER,
  food_cost REAL,
  vendor TEXT,
  waste_note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meal_ops_prop_date ON meal_ops_log(property_id, date, meal);
