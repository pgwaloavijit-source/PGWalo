-- PGNest D1 Database Schema
-- Migrated from TypeScript types to Cloudflare D1 SQL

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  account_state TEXT NOT NULL DEFAULT 'Trial / Pending Setup',
  subscription_plan TEXT NOT NULL DEFAULT 'Trial',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  name TEXT NOT NULL,
  tagline TEXT,
  gender TEXT NOT NULL,
  city TEXT NOT NULL,
  locality TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  cover_image TEXT,
  gallery_images TEXT, -- JSON array
  starting_price INTEGER NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  rooms TEXT, -- JSON array of room options
  amenities TEXT, -- JSON array of amenity IDs
  rules TEXT, -- JSON array
  notice_period_days INTEGER NOT NULL DEFAULT 30,
  gate_closing_time TEXT,
  food_included INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  contact_phone TEXT,
  contact_email TEXT,
  owner_name TEXT,
  default_rent_due_day INTEGER NOT NULL DEFAULT 7,
  total_floors INTEGER,
  modules TEXT, -- JSON object for module settings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_locality ON properties(locality);
CREATE INDEX IF NOT EXISTS idx_properties_gender ON properties(gender);
CREATE INDEX IF NOT EXISTS idx_properties_status_price ON properties(status, starting_price);

-- Users/Accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  occupation TEXT,
  organization TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  city TEXT,
  is_profile_completed INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  avatar TEXT,
  property_id TEXT,
  property_name TEXT,
  room_number TEXT,
  staff_role TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'Active',
  assigned_properties TEXT, -- JSON array
  permissions TEXT, -- JSON object
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Residents
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  current_stay_id TEXT,
  advance_balance REAL NOT NULL DEFAULT 0,
  outstanding_balance REAL NOT NULL DEFAULT 0,
  previous_dues REAL NOT NULL DEFAULT 0,
  deposit_state TEXT NOT NULL DEFAULT 'Held',
  agreement_state TEXT NOT NULL DEFAULT 'Pending',
  notice_period_days INTEGER NOT NULL DEFAULT 30,
  checkout_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar TEXT,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  room_type TEXT NOT NULL,
  bed_number TEXT NOT NULL,
  monthly_rent REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  move_in_date TEXT NOT NULL,
  rent_status TEXT NOT NULL DEFAULT 'Pending',
  rent_due_date TEXT NOT NULL,
  last_payment_date TEXT,
  emergency_contact TEXT NOT NULL,
  kyc_verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  notice_date TEXT,
  expected_checkout_date TEXT,
  actual_checkout_date TEXT,
  checkout_reason TEXT,
  agreement_expiry_date TEXT,
  onboarding_checklist TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_residents_org ON residents(organization_id);
CREATE INDEX IF NOT EXISTS idx_residents_property ON residents(property_id);
CREATE INDEX IF NOT EXISTS idx_residents_status ON residents(status);

-- Beds
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  bed_number TEXT NOT NULL,
  room_id TEXT,
  room_number TEXT NOT NULL,
  property_id TEXT NOT NULL,
  floor TEXT,
  tower TEXT,
  building TEXT,
  sharing_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Vacant',
  current_tenant_id TEXT,
  current_tenant_name TEXT,
  monthly_rent REAL NOT NULL,
  monthly_tariff REAL,
  deposit REAL NOT NULL,
  next_available_date TEXT,
  reserved_for_resident_id TEXT,
  reservation_expiry TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_beds_org ON beds(organization_id);
CREATE INDEX IF NOT EXISTS idx_beds_property ON beds(property_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_property_sharing_status ON beds(property_id, sharing_type, status);
CREATE INDEX IF NOT EXISTS idx_beds_next_available_date ON beds(next_available_date);

-- Stays
CREATE TABLE IF NOT EXISTS stays (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  room_id TEXT,
  room_number TEXT NOT NULL,
  bed_id TEXT NOT NULL,
  bed_number TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  monthly_rent_at_start REAL NOT NULL,
  transfer_reason TEXT,
  status TEXT NOT NULL DEFAULT 'Current',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_stays_org ON stays(organization_id);
CREATE INDEX IF NOT EXISTS idx_stays_resident ON stays(resident_id);

-- Rent Plans
CREATE TABLE IF NOT EXISTS rent_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  monthly_rent REAL NOT NULL,
  due_day INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  revision_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_rent_plans_org ON rent_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_rent_plans_resident ON rent_plans(resident_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  month TEXT NOT NULL,
  due_date TEXT NOT NULL,
  lines TEXT NOT NULL, -- JSON array of invoice lines
  amount REAL NOT NULL,
  verified_paid_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Due',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_resident ON invoices(resident_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  submitted_at TEXT NOT NULL,
  verified_at TEXT,
  transaction_reference TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_resident ON payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Payment Allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  invoice_id TEXT,
  resident_id TEXT NOT NULL,
  amount REAL NOT NULL,
  allocated_to TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_org ON payment_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);

-- Deposit Transactions
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  evidence_url TEXT,
  transaction_reference TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_transactions_org ON deposit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_resident ON deposit_transactions(resident_id);

-- Notices
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  requested_checkout_date TEXT NOT NULL,
  contractual_earliest_checkout_date TEXT NOT NULL,
  approved_checkout_date TEXT,
  reason TEXT NOT NULL,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted',
  owner_reason TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_notices_org ON notices(organization_id);
CREATE INDEX IF NOT EXISTS idx_notices_resident ON notices(resident_id);

-- Checkouts
CREATE TABLE IF NOT EXISTS checkouts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  bed_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  rent_pending REAL NOT NULL DEFAULT 0,
  electricity_charges REAL NOT NULL DEFAULT 0,
  food_charges REAL NOT NULL DEFAULT 0,
  damage_charges REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  deposit_held REAL NOT NULL DEFAULT 0,
  refund_amount REAL NOT NULL DEFAULT 0,
  checklist TEXT, -- JSON object
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_checkouts_org ON checkouts(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_resident ON checkouts(resident_id);

-- Booking Requests
CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  resident_status TEXT,
  reserved_bed_id TEXT,
  reservation_expiry TEXT,
  token_amount REAL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  room_type TEXT NOT NULL,
  preferred_move_in_date TEXT NOT NULL,
  occupancy_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  request_date TEXT NOT NULL,
  message TEXT,
  type TEXT, -- 'visit' or 'booking'
  visit_date TEXT,
  visit_time_slot TEXT,
  reference_id TEXT,
  allocated_room_number TEXT,
  allocated_bed_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_org ON booking_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_property ON booking_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  person_name TEXT NOT NULL,
  person_type TEXT NOT NULL,
  room_number TEXT,
  role TEXT,
  date TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_person ON attendance_records(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

-- Staff Members
CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar TEXT,
  property_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  today_status TEXT NOT NULL DEFAULT 'Checked-Out',
  last_clock_in TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_property ON staff_members(property_id);

-- Staff Tasks
CREATE TABLE IF NOT EXISTS staff_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  priority TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON staff_tasks(assigned_to_name);

-- Broadcast Notifications
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  target TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  sender TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_timestamp ON broadcast_notifications(timestamp);

-- Meal Plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL UNIQUE,
  breakfast TEXT NOT NULL,
  lunch TEXT NOT NULL,
  snacks TEXT NOT NULL,
  dinner TEXT NOT NULL,
  special_note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);

-- Maintenance Tickets
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  room_number TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Reported',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  assigned_staff_name TEXT,
  sla_deadline TEXT,
  photo_url TEXT,
  cost REAL,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_room ON maintenance_tickets(room_number);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  property_id TEXT,
  property_name TEXT,
  room_type_preference TEXT NOT NULL,
  budget_max INTEGER NOT NULL,
  budget INTEGER NOT NULL,
  preferred_move_in TEXT,
  expected_move_in_date TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'New Lead',
  source TEXT NOT NULL,
  assigned_to TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_follow_up TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);

-- Electricity Meter Readings
CREATE TABLE IF NOT EXISTS electricity_meter_readings (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  meter_number TEXT NOT NULL,
  previous_reading REAL NOT NULL,
  current_reading REAL NOT NULL,
  units_consumed REAL NOT NULL,
  rate_per_unit REAL NOT NULL,
  fixed_charges REAL NOT NULL,
  total_amount REAL NOT NULL,
  reading_date TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  meter_photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Verified',
  is_anomaly INTEGER NOT NULL DEFAULT 0,
  anomaly_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_meter_property ON electricity_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_meter_date ON electricity_meter_readings(reading_date);

-- Security Deposit Records
CREATE TABLE IF NOT EXISTS security_deposit_records (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  property_id TEXT NOT NULL,
  deposit_received REAL NOT NULL,
  received_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Held',
  deductions TEXT, -- JSON array
  total_deductions REAL NOT NULL DEFAULT 0,
  final_refund_amount REAL NOT NULL,
  refund_date TEXT,
  refund_transaction_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_resident ON security_deposit_records(resident_id);

-- Rent Agreements
CREATE TABLE IF NOT EXISTS rent_agreements (
  id TEXT PRIMARY KEY,
  agreement_number TEXT NOT NULL UNIQUE,
  resident_id TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  parent_guardian_name TEXT,
  tenant_dob TEXT NOT NULL,
  tenant_permanent_address TEXT NOT NULL,
  tenant_current_address TEXT NOT NULL,
  tenant_college_or_office TEXT NOT NULL,
  tenant_id_document_type TEXT NOT NULL,
  tenant_id_document_masked TEXT NOT NULL,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  room_number TEXT NOT NULL,
  bed_number TEXT NOT NULL,
  monthly_rent REAL NOT NULL,
  security_deposit REAL NOT NULL,
  electricity_terms TEXT NOT NULL,
  notice_period_days INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rules_summary TEXT, -- JSON array
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  owner_signed INTEGER NOT NULL DEFAULT 0,
  tenant_signed INTEGER NOT NULL DEFAULT 0,
  signed_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_agreements_resident ON rent_agreements(resident_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON rent_agreements(status);

-- Visitor Passes
CREATE TABLE IF NOT EXISTS visitor_passes (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expected_arrival TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  status TEXT NOT NULL DEFAULT 'Pre-Approved',
  approved_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_resident ON visitor_passes(resident_id);
CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_passes(status);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  timestamp TEXT NOT NULL,
  details TEXT NOT NULL, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY DEFAULT 'settings',
  currency TEXT NOT NULL DEFAULT 'INR',
  rent_due_day INTEGER NOT NULL DEFAULT 7,
  late_fee_grace_days INTEGER NOT NULL DEFAULT 3,
  late_fee_amount REAL NOT NULL DEFAULT 100,
  default_electricity_rate REAL NOT NULL DEFAULT 8,
  electricity_billing_model TEXT NOT NULL DEFAULT 'Per-Unit',
  deposit_refund_notice_days INTEGER NOT NULL DEFAULT 30,
  emergency_maintenance_sla_hours INTEGER NOT NULL DEFAULT 4,
  high_maintenance_sla_hours INTEGER NOT NULL DEFAULT 24,
  normal_maintenance_sla_hours INTEGER NOT NULL DEFAULT 48,
  low_maintenance_sla_hours INTEGER NOT NULL DEFAULT 72,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT PRIMARY KEY,
  permissions TEXT NOT NULL -- JSON object of RolePermissions
);

-- Insert default role permissions
INSERT OR IGNORE INTO role_permissions (role, permissions) VALUES
('admin', '{"property":{"view":true,"create":true,"edit":true,"delete":true,"publish":true,"approve":true},"rooms":{"view":true,"create":true,"edit":true,"delete":true,"allocateBed":true},"tenants":{"view":true,"create":true,"edit":true,"move":true,"vacate":true,"viewDocs":true},"rent":{"view":true,"generate":true,"collect":true,"verify":true,"refund":true},"electricity":{"view":true,"enterReadings":true,"editReadings":true,"generateBills":true,"approveBills":true},"agreements":{"create":true,"view":true,"verify":true,"generate":true,"download":true},"maintenance":{"create":true,"assign":true,"update":true,"resolve":true},"reports":{"view":true,"export":true}}'),
('owner', '{"property":{"view":true,"create":true,"edit":true,"delete":false,"publish":true,"approve":true},"rooms":{"view":true,"create":true,"edit":true,"delete":true,"allocateBed":true},"tenants":{"view":true,"create":true,"edit":true,"move":true,"vacate":true,"viewDocs":true},"rent":{"view":true,"generate":true,"collect":true,"verify":true,"refund":true},"electricity":{"view":true,"enterReadings":true,"editReadings":true,"generateBills":true,"approveBills":true},"agreements":{"create":true,"view":true,"verify":true,"generate":true,"download":true},"maintenance":{"create":true,"assign":true,"update":true,"resolve":true},"reports":{"view":true,"export":true}}'),
('manager', '{"property":{"view":true,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":true,"create":false,"edit":false,"delete":false,"allocateBed":true},"tenants":{"view":true,"create":true,"edit":true,"move":true,"vacate":true,"viewDocs":true},"rent":{"view":true,"generate":true,"collect":true,"verify":false,"refund":false},"electricity":{"view":true,"enterReadings":true,"editReadings":false,"generateBills":false,"approveBills":false},"agreements":{"create":false,"view":true,"verify":true,"generate":false,"download":true},"maintenance":{"create":true,"assign":true,"update":true,"resolve":true},"reports":{"view":true,"export":false}}'),
('warden', '{"property":{"view":true,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":true,"create":false,"edit":false,"delete":false,"allocateBed":true},"tenants":{"view":true,"create":false,"edit":false,"move":false,"vacate":false,"viewDocs":true},"rent":{"view":true,"generate":false,"collect":false,"verify":false,"refund":false},"electricity":{"view":false,"enterReadings":false,"editReadings":false,"generateBills":false,"approveBills":false},"agreements":{"create":false,"view":true,"verify":false,"generate":false,"download":false},"maintenance":{"create":true,"assign":true,"update":true,"resolve":true},"reports":{"view":false,"export":false}}'),
('accountant', '{"property":{"view":false,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":false,"create":false,"edit":false,"delete":false,"allocateBed":false},"tenants":{"view":true,"create":false,"edit":false,"move":false,"vacate":false,"viewDocs":true},"rent":{"view":true,"generate":true,"collect":true,"verify":true,"refund":true},"electricity":{"view":true,"enterReadings":true,"editReadings":true,"generateBills":true,"approveBills":true},"agreements":{"create":false,"view":true,"verify":true,"generate":false,"download":true},"maintenance":{"create":false,"assign":false,"update":false,"resolve":false},"reports":{"view":true,"export":true}}'),
('staff', '{"property":{"view":false,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":true,"create":false,"edit":false,"delete":false,"allocateBed":false},"tenants":{"view":false,"create":false,"edit":false,"move":false,"vacate":false,"viewDocs":false},"rent":{"view":false,"generate":false,"collect":false,"verify":false,"refund":false},"electricity":{"view":false,"enterReadings":false,"editReadings":false,"generateBills":false,"approveBills":false},"agreements":{"create":false,"view":false,"verify":false,"generate":false,"download":false},"maintenance":{"create":true,"assign":false,"update":true,"resolve":true},"reports":{"view":false,"export":false}}'),
('resident', '{"property":{"view":true,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":true,"create":false,"edit":false,"delete":false,"allocateBed":false},"tenants":{"view":false,"create":false,"edit":false,"move":false,"vacate":false,"viewDocs":true},"rent":{"view":true,"generate":false,"collect":false,"verify":false,"refund":false},"electricity":{"view":false,"enterReadings":false,"editReadings":false,"generateBills":false,"approveBills":false},"agreements":{"create":false,"view":true,"verify":false,"generate":false,"download":true},"maintenance":{"create":true,"assign":false,"update":false,"resolve":false},"reports":{"view":false,"export":false}}'),
('public', '{"property":{"view":true,"create":false,"edit":false,"delete":false,"publish":false,"approve":false},"rooms":{"view":true,"create":false,"edit":false,"delete":false,"allocateBed":false},"tenants":{"view":false,"create":false,"edit":false,"move":false,"vacate":false,"viewDocs":false},"rent":{"view":false,"generate":false,"collect":false,"verify":false,"refund":false},"electricity":{"view":false,"enterReadings":false,"editReadings":false,"generateBills":false,"approveBills":false},"agreements":{"create":false,"view":false,"verify":false,"generate":false,"download":false},"maintenance":{"create":false,"assign":false,"update":false,"resolve":false},"reports":{"view":false,"export":false}}');
