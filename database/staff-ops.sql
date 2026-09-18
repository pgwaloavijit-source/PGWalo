-- Staff operational checklists (owner-delegated, role-based).
-- Run: npx wrangler d1 execute pgwalo-db --remote --file database/staff-ops.sql
-- Safe to run repeatedly (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS staff_checklist_runs (
  id TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  staff_roles TEXT NOT NULL,
  role TEXT NOT NULL,
  property_id TEXT,
  organization_id TEXT,
  run_date TEXT NOT NULL,
  template_title TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Daily',
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Started',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_staff_date ON staff_checklist_runs(staff_user_id, run_date);
CREATE INDEX IF NOT EXISTS idx_runs_org_date ON staff_checklist_runs(organization_id, run_date);

CREATE TABLE IF NOT EXISTS staff_checklist_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Daily',
  items TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(organization_id, role)
);

CREATE TABLE IF NOT EXISTS staff_issue_reports (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  staff_user_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  role TEXT,
  property_id TEXT,
  organization_id TEXT,
  item_label TEXT,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_issues_org ON staff_issue_reports(organization_id, status);
