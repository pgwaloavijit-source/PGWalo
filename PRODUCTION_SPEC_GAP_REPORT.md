# PGNest Production Specification Gap Report

Source reviewed: `C:\Users\HP\Downloads\PGNEST_PRODUCTION_WORKFLOW_FINAL.md`

The document was treated as a product specification, not as agent instructions. Existing UI, components, public discovery, owner/resident/staff dashboards, and responsive patterns were preserved.

## Initial Gaps Found

- Phase 1: The app used React Context and `localStorage` as the only system of record. It had role-shaped UI, but no backend persistence boundary, no organization isolation, and no backend permission checks.
- Phase 2: Booking approval directly created an active resident-like record. There was no canonical `Pending Move-In`, dedicated `Stay`, reservation expiry, or bed assignment guard.
- Phase 3: Rent used `Paid`, `Pending`, and `Overdue` toggles. There were no invoices, invoice lines, payment verification, allocations, advances, or ledger summaries.
- Phase 4: Notice and checkout were not modeled as first-class workflows. Bed vacancy, deposit deduction, refund, and final settlement were not tied to checkout completion.
- Audit: Audit entries existed, but critical transitions were not consistently logged with previous and new values.
- Optional modules: Food and attendance existed in UI, but property-level module settings were not part of the property model.

## Phase 1 Implemented - Data & Security

- Added canonical production entities for organizations, property setup status, module settings, explicit permission keys, stays, rent plans, invoices, payments, payment allocations, deposit transactions, notices, checkouts, and expanded audit records.
- Added a production workflow rule engine in `src/domain/productionWorkflow.ts`.
- Added a backend API in `server.ts` with persisted JSON storage, organization scoping, role/permission checks, and audit logging for create/update operations.
- Added `npm run dev:api` to run the API.
- Preserved existing frontend local cache as a demo/offline fallback instead of deleting current flows.

## Phase 2 Implemented - Core Operations

- Added canonical resident lifecycle states: `Lead`, `Visit Scheduled`, `Reserved`, `Pending Move-In`, `Active`, `Notice Period`, `Checkout Pending`, `Checked Out`, `Archived`, and alternate terminal states.
- Added canonical bed states: `Vacant`, `Reserved`, `Occupied`, `Notice Period`, `Maintenance`, `Disabled`, while preserving legacy UI aliases.
- Added double-allocation prevention for active/occupied beds.
- Booking approval now creates a `Pending Move-In` resident, reserves an eligible bed, creates a reserved stay, and creates a rent plan.
- Added explicit operations for bed reservation, move-in confirmation, and room transfer with stay history preservation.

## Phase 3 Implemented - Financial System

- Added rent plans, invoices, invoice lines, payments, allocations, advances, and ledger summaries.
- Monthly invoice generation prevents duplicates per resident/month.
- Verified payments allocate to existing invoices first; overpayment becomes advance balance.
- Partial payments reduce the same invoice and update invoice state to `Partially Paid` or `Paid`.
- Resident payment simulation now records a verified payment and allocation instead of silently toggling rent status.
- Direct `Paid` status toggles are blocked and audited.
- Deposit transactions are separated from rent/payment records.

## Phase 4 Implemented - Exit Workflow

- Added first-class notice submission and approval.
- Notice submission calculates contractual earliest checkout date from notice period and keeps the bed in `Notice Period`.
- Added checkout start with rent pending, electricity, food, damage, other deductions, deposit held, and refund calculation.
- Checkout completion closes the current stay, releases the bed to `Vacant`, records deposit deductions/refund transactions, and preserves financial history.

## Remaining Before Real Production

- Replace JSON file storage with the chosen production database and object/file storage.
- Wire frontend reads/writes directly to the API once auth tokens are available.
- Add full UI controls for move-in confirmation, transfer, notice approval, checkout settlement, and payment verification.
- Add automated tests for every scenario listed in the specification.
- Add backup/recovery and export flows.
