-- Market-ready migration — additive only, idempotent (re-runnable).
-- New lifecycle entities: leads CRM v2 columns, lead activities, visits,
-- reservations, payment intents/gateway events, expenses, inspections,
-- compliance templates/items, KYC records, verified reviews, import jobs.
--
-- All tables are org-scoped with created/updated timestamps and indexes on
-- the frequent filters (org, property, status, date). Existing tables and
-- rows are untouched; new columns are nullable with safe defaults.

-- ---------------------------------------------------------------- leads CRM v2
ALTER TABLE leads ADD COLUMN organization_id TEXT;
ALTER TABLE leads ADD COLUMN assigned_user_id TEXT;
ALTER TABLE leads ADD COLUMN source_reference TEXT;
ALTER TABLE leads ADD COLUMN desired_locality TEXT;
ALTER TABLE leads ADD COLUMN desired_property_id TEXT;
ALTER TABLE leads ADD COLUMN budget_min INTEGER;
ALTER TABLE leads ADD COLUMN occupant_type TEXT;
ALTER TABLE leads ADD COLUMN sharing_preference TEXT;
ALTER TABLE leads ADD COLUMN workplace_or_college TEXT;
ALTER TABLE leads ADD COLUMN stage_v2 TEXT;
ALTER TABLE leads ADD COLUMN temperature TEXT;
ALTER TABLE leads ADD COLUMN next_follow_up_at TEXT;
ALTER TABLE leads ADD COLUMN last_contact_at TEXT;
ALTER TABLE leads ADD COLUMN lost_reason TEXT;
ALTER TABLE leads ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON leads(organization_id, stage_v2);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_follow_up_at);

-- ------------------------------------------------------------ lead activities
CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  lead_id TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at);

-- --------------------------------------------------------------------- visits
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  lead_id TEXT,
  property_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  assigned_staff_id TEXT,
  assigned_staff_name TEXT,
  notes TEXT,
  outcome TEXT,
  interested_bed_ids TEXT, -- JSON array
  status TEXT NOT NULL DEFAULT 'scheduled',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_org ON visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_visits_property_date ON visits(property_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- --------------------------------------------------------------- reservations
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  property_id TEXT NOT NULL,
  room_id TEXT,
  bed_id TEXT NOT NULL,
  bed_number TEXT,
  room_number TEXT,
  lead_id TEXT,
  resident_id TEXT,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  start_date TEXT NOT NULL,
  expiry_at TEXT NOT NULL,
  token_amount REAL NOT NULL DEFAULT 0,
  token_payment_status TEXT NOT NULL DEFAULT 'pending',
  token_payment_id TEXT,
  refund_policy_snapshot TEXT NOT NULL DEFAULT 'refundable',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  cancellation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bed_id) REFERENCES beds(id)
);
CREATE INDEX IF NOT EXISTS idx_reservations_org ON reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_reservations_bed_status ON reservations(bed_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON reservations(expiry_at);

-- ------------------------------------------------------------ payment intents
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  purpose TEXT NOT NULL,
  reference_id TEXT,
  resident_id TEXT,
  lead_id TEXT,
  property_id TEXT,
  payer_name TEXT NOT NULL,
  payer_phone TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  provider TEXT NOT NULL DEFAULT 'none',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  utr TEXT,
  receipt_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_org ON payment_intents(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_ref ON payment_intents(purpose, reference_id);

-- --------------------------------------------------- payment gateway events
CREATE TABLE IF NOT EXISTS payment_gateway_events (
  id TEXT PRIMARY KEY,
  intent_id TEXT,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pg_events_intent ON payment_gateway_events(intent_id);

-- -------------------------------------------------------------------- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  property_id TEXT,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  vendor TEXT,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  recurring INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property_date ON expenses(property_id, date);

-- ----------------------------------------------------------------- inspections
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  resident_id TEXT,
  stay_id TEXT,
  property_id TEXT NOT NULL,
  room_number TEXT NOT NULL,
  bed_number TEXT,
  type TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  inspected_by TEXT,
  items TEXT NOT NULL DEFAULT '[]', -- JSON array of InspectionItem
  resident_confirmed INTEGER NOT NULL DEFAULT 0,
  resident_confirmed_at TEXT,
  staff_confirmed INTEGER NOT NULL DEFAULT 0,
  staff_confirmed_at TEXT,
  overall_notes TEXT,
  reference_inspection_id TEXT,
  meter_reading TEXT,
  keys_and_access_returned INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inspections_org ON inspections(organization_id);
CREATE INDEX IF NOT EXISTS idx_inspections_property ON inspections(property_id, type);

-- --------------------------------------------------------- compliance templates
CREATE TABLE IF NOT EXISTS compliance_templates (
  id TEXT PRIMARY KEY,
  jurisdiction TEXT NOT NULL,
  property_type TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON array of template items
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

-- ----------------------------------------------- property compliance items
CREATE TABLE IF NOT EXISTS property_compliance_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  property_id TEXT NOT NULL,
  template_item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing',
  document_id TEXT,
  document_url TEXT,
  issued_at TEXT,
  expires_at TEXT,
  verified_at TEXT,
  verified_by TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
CREATE INDEX IF NOT EXISTS idx_pci_property ON property_compliance_items(property_id, status);
CREATE INDEX IF NOT EXISTS idx_pci_expiry ON property_compliance_items(expires_at);

-- ---------------------------------------------------------------------- kyc
CREATE TABLE IF NOT EXISTS kyc_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  resident_id TEXT,
  lead_id TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'not_started',
  provider TEXT,
  provider_reference TEXT,
  verification_type TEXT,
  masked_identifier TEXT,
  verified_name TEXT,
  verified_at TEXT,
  consent_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kyc_org ON kyc_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_kyc_resident ON kyc_records(resident_id);

-- --------------------------------------------------------------------- reviews
CREATE TABLE IF NOT EXISTS verified_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  property_id TEXT NOT NULL,
  resident_id TEXT,
  stay_id TEXT,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  dimensions TEXT, -- JSON object
  comment TEXT NOT NULL,
  owner_response TEXT,
  owner_responded_at TEXT,
  moderated_by TEXT,
  moderation_action TEXT,
  is_verified_stay INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_property ON verified_reviews(property_id);

-- ----------------------------------------------------------------- import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  committed_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0,
  errors TEXT, -- JSON array of row errors
  committed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON import_jobs(organization_id);

-- ------------------------------------------------------- reminder state (spec §17)
CREATE TABLE IF NOT EXISTS reminder_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  resident_id TEXT NOT NULL,
  invoice_id TEXT,
  rule TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);
CREATE INDEX IF NOT EXISTS idx_reminder_resident ON reminder_log(resident_id, rule, sent_at);
