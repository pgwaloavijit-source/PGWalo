# PGWalo — Market-Ready Build Prompt for GLM 5.3 Flash

> **Purpose:** Give this file to GLM 5.3 Flash at the root of the existing PGWalo repository. It is an implementation specification, not a greenfield redesign prompt.
>
> **Primary objective:** Upgrade the existing PGWalo codebase into a launch-ready, owner-first PG operating and trust platform for Delhi NCR **without breaking, replacing, or unnecessarily rewriting the existing application**.

---

## 0. Your Role

Act as a **principal full-stack engineer + product architect + India PG/co-living domain specialist**.

You are working on an **existing production-intended application**, not a prototype. Your job is to extend and harden the current implementation efficiently.

Your priorities, in order:

1. Preserve existing working behavior.
2. Make the critical owner revenue workflows production-ready.
3. Keep demo mode and production mode functional.
4. Reuse existing types, stores, APIs, screens, utilities, and domain logic wherever reasonable.
5. Add migrations and backward-compatible adapters instead of destructive schema rewrites.
6. Build only what creates owner revenue, collection efficiency, trust, compliance, or operational control.
7. Keep code modular and testable.
8. Do not spend tokens narrating obvious work.

---

# 1. Existing Product Truth — Do Not Rebuild This From Scratch

PGWalo already exists as a role-based PG discovery and property-management system.

Current stack and architecture:

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide icons
- motion library
- central state/store in `src/context/AppContext.tsx`
- demo data in `src/mockData.ts`
- production API client in `src/services/productionApi.ts`
- Cloudflare Worker backend in `src/worker/index.ts`
- Cloudflare D1 database via `database/schema.sql` + migrations
- JWT-based authentication
- R2-oriented media/upload support
- KV/cache patterns for search/static data
- static frontend served via Vite assets
- API under `/api/*`
- role routing in `src/App.tsx` and `src/utils/roles.ts`

Existing roles include:

- public
- owner
- resident
- staff
- warden
- accountant
- admin
- superadmin

Existing major functionality includes:

- public PG search/discovery
- PG detail experience
- visit/interest/booking flows
- owner listing wizard
- rooms and beds
- occupancy states
- owner dashboards
- resident dashboard
- invoices/rent
- payments
- deposits
- agreements
- maintenance complaints
- notice/checkout
- staff operations
- attendance/checklists
- visitor logs
- meter readings
- accountant workflows
- admin/superadmin tooling
- role-scoped data bootstrap
- audit logs
- media handling
- notifications/events

Important existing files to inspect first:

- `src/App.tsx`
- `src/context/AppContext.tsx`
- `src/types.ts`
- `src/utils/roles.ts`
- `src/domain/productionWorkflow.ts`
- `src/domain/staffOps.ts`
- `src/services/productionApi.ts`
- `src/services/auth.ts`
- `src/worker/index.ts`
- `database/schema.sql`
- migration SQL files
- `wrangler.toml`
- `AGENT_CODEBASE.md`
- `superadmin-flow.md`

Do not assume the repository exactly matches this summary. **Inspect the actual code before patching.**

---

# 2. Product Positioning You Must Build Toward

PGWalo must become:

# **The operating and trust infrastructure for Indian PGs**

Owner promise:

> **Fill more beds. Collect rent on time. Prevent disputes. Stay compliant.**

Resident promise:

> **Live beds. Real prices. Verified PGs. Clear rules.**

Primary strategic concept:

# **PGWalo Verified Live Bed Network**

Public availability must increasingly come from the same operational bed inventory that owners actually use to run the property.

The platform must close this loop:

`Owner operations -> accurate bed availability -> trustworthy listing -> qualified lead -> visit -> token -> reservation -> move-in -> rent -> notice -> future vacancy -> next lead`

---

# 3. Ideal Launch Customer

Design for the initial ICP:

- independent PG / hostel / co-living owner
- Delhi NCR
- approximately 30–300 beds
- one or multiple properties
- currently using a mixture of WhatsApp, UPI, registers, spreadsheets, staff calls, and property portals

Secondary users:

- property manager
- caretaker / warden
- finance/accountant
- security
- maintenance
- housekeeping
- kitchen staff
- residents
- parents/guardians for student properties
- colleges / companies for bulk housing later

---

# 4. Non-Negotiable Engineering Rules

## 4.1 Preserve the stack

Do **not** migrate the app to another framework, database, state manager, backend, router, or UI library unless an existing dependency is truly broken and no smaller fix exists.

Do not replace:

- React/Vite
- AppContext architecture wholesale
- Cloudflare Worker
- D1
- existing auth model
- productionApi abstraction

Enhance them incrementally.

## 4.2 Backward compatibility

- Existing demo mode must continue working.
- Existing production mode must continue working.
- Existing role strings must remain valid.
- Existing DB records must remain readable after migration.
- New required fields must have safe defaults or nullable migration states.
- Avoid destructive migrations.
- Every schema change must have a migration.

## 4.3 No giant rewrite

Prefer:

- small modules
- adapters
- services
- selectors
- isolated domain functions
- feature flags
- additive tables/columns

Avoid editing a 1,500-line component when a focused child component or hook is more appropriate.

## 4.4 Security

Never trust client-side role checks.

Every protected mutation must validate authorization server-side.

For monetary state changes, reservations, deposit changes, compliance verification and document access:

- authenticate
- authorize
- validate organization/property scope
- validate transition
- write audit event
- use idempotency where appropriate

## 4.5 External providers

Do not hardcode a single vendor deeply into domain logic.

Use provider interfaces/adapters for:

- WhatsApp messaging
- SMS
- payment gateway
- eKYC
- e-sign/e-stamp
- maps/geocoding
- email

If credentials are unavailable:

1. build the interface,
2. build a disabled/mock adapter,
3. guard the UI using capability/feature flags,
4. document environment variables,
5. keep the app compiling and usable.

Do not fabricate successful provider calls.

## 4.6 Privacy

Do not design storage that unnecessarily stores full Aadhaar numbers.

Prefer tokenized/provider-returned verification references, masked identifiers, consent timestamps and limited document access.

Add appropriate data-retention metadata where sensitive documents are introduced.

---

# 5. Efficient Agent Working Protocol

Follow this protocol throughout the implementation.

## Phase start

Before each implementation phase:

1. Inspect only the files relevant to that phase.
2. Search for existing types/functions before adding duplicates.
3. List the exact files to modify in a short internal plan.
4. Patch in dependency order: schema -> domain -> API -> client service -> state -> UI -> tests.

## While coding

- Do not re-read the entire repo repeatedly.
- Do not restate this prompt.
- Do not output tutorials.
- Do not create duplicate versions such as `NewOwnerDashboard2.tsx` unless migration genuinely needs a temporary adapter.
- Keep changes small enough to test.
- Run typecheck/build/tests after meaningful units of work.
- Fix failures before moving on.

## Status output

Keep progress messages short:

- completed
- files changed
- tests/build status
- blocker if any
- next task

Do not emit lengthy explanations unless there is an architectural decision that needs documentation.

## Decision rule

Do not ask for confirmation for ordinary implementation choices.

If a real external credential, payment merchant account, BSP approval or legal text is unavailable, implement the safe integration boundary and continue.

---

# 6. Priority Order

Build in this order.

## P0-A — Foundation and onboarding

1. permissions/capability layer
2. CSV/Excel-style import path using CSV as canonical browser/server exchange
3. clean owner home dashboard
4. live inventory/future availability model
5. lead CRM
6. visit scheduling
7. token/reservation

## P0-B — Money

8. rent cycle automation
9. payment link/provider abstraction
10. reconciliation
11. partial/prorated payments
12. expense ledger/P&L
13. deposit ledger

## P0-C — Trust

14. KYC state model
15. agreement signing state
16. move-in evidence
17. move-out evidence
18. structured deposit settlement
19. compliance center
20. public verification facts
21. verified-stay reviews

## P0-D — Operations

22. maintenance SLA
23. staff permission presets
24. audit/event completeness
25. notifications/action center

## P1

- parent/guardian view
- meal forecasting/waste workflow
- vendor management
- staff shifts
- institutional/bulk booking
- advanced finance exports
- multilingual support readiness

## P2 — only after core is stable

- smart locks
- IoT meter ingestion
- AI calling
- AI copilot
- dynamic pricing
- roommate matching
- social/community feed

Do **not** spend P0 time building a generic AI chatbot.

---

# 7. Permissions and Role Simplification

The current role model contains separate top-level roles such as warden and accountant while staff operations also contain role templates.

Do not delete existing roles immediately.

Implement a backward-compatible **capability-based permission layer**.

Recommended conceptual permissions:

```text
property.read
property.write
inventory.read
inventory.write
lead.read
lead.write
lead.assign
visit.manage
reservation.manage
resident.read
resident.write
billing.read
billing.write
payment.record
payment.reconcile
deposit.read
deposit.settle
expense.read
expense.write
maintenance.read
maintenance.assign
maintenance.resolve
staff.manage
compliance.read
compliance.upload
compliance.verify
agreement.manage
kyc.manage
review.moderate
analytics.read
admin.platform
```

Preset profiles:

- Owner
- Property Manager
- Finance
- Warden/Caretaker
- Security
- Housekeeping
- Maintenance
- Kitchen
- Viewer/Auditor

Compatibility rule:

- map existing `warden` role to Warden/Caretaker preset
- map existing `accountant` role to Finance preset
- keep old routes working while navigation gradually moves to permissions

Do not expose platform admin capabilities to property users.

---

# 8. Owner Home Dashboard — Redesign Priority

The owner's first screen must answer these questions immediately:

1. How many beds are vacant now?
2. Which beds become vacant soon?
3. How much money is overdue?
4. Which leads require follow-up today?
5. What operational/compliance issue needs attention?

Recommended layout:

## Top KPI strip

- Occupied beds / total beds
- Vacant now
- Vacant in next 30 days
- Rent overdue amount
- Collection rate this month
- Hot leads requiring action

## Action center

Rank tasks by urgency:

- payment overdue
- lead follow-up overdue
- visit today
- reservation expiring
- resident notice received
- unresolved maintenance SLA
- compliance document expiring
- deposit settlement pending

## Portfolio section

If multi-property:

- occupancy by property
- overdue by property
- open issues
- lead conversion

Use progressive disclosure. Do not dump every module on the home screen.

---

# 9. Owner Onboarding and Data Migration

This is P0.

Build an onboarding flow that lets an owner go from spreadsheet/register to live operations quickly.

## Required steps

1. Organization/profile
2. Add first property
3. Add floors/rooms/beds
4. Import active residents
5. Set rent plan / due date
6. Record opening deposits
7. Mark current occupancy
8. Publish live listing optionally
9. Invite manager/staff optionally

## CSV import

Support separate templates or one normalized import flow for:

- rooms/beds
- residents
- opening dues
- deposits
- leads

Requirements:

- download template
- upload CSV
- preview parsed rows
- map columns
- validation errors per row
- duplicate detection
- dry-run summary
- commit only valid/approved rows
- downloadable rejection report
- operation audit log

Do not require owners to retype hundreds of records.

---

# 10. Inventory and Live/Future Availability

Existing room/bed states must be extended carefully.

A bed needs to answer:

- current occupancy state
- available now?
- next available date
- currently reserved?
- reservation expiry
- resident notice end date
- maintenance block window
- intended sharing configuration
- monthly price
- public listing eligibility

Recommended derived status examples:

- vacant
- occupied
- reserved
- occupied_notice
- maintenance
- blocked

Do not duplicate state unnecessarily if existing states can be extended.

## Future vacancy

When a resident's valid notice is accepted:

1. calculate projected move-out date
2. compute bed `availableFrom`
3. allow owner to choose whether future availability is public
4. accept visits for dates after availability
5. allow reservation for next tenancy if conflict-free
6. prevent overlapping confirmed reservations/stays

This must be enforced server-side, not only visually.

---

# 11. Lead CRM

Build a real sales pipeline.

## Lead sources

- PGWalo marketplace
- owner website/share page
- walk-in
- phone
- WhatsApp
- referral
- broker
- college/company
- CSV import
- manual
- external portal placeholder/source tags

## Lead fields

At minimum:

- id
- organizationId
- propertyId optional
- assignedUserId optional
- fullName
- phone
- email optional
- source
- sourceReference optional
- desiredLocality
- desiredPropertyId optional
- moveInDate
- budgetMin/Max
- gender/preference where lawful/relevant to property model
- occupant type: student/professional/etc.
- sharing preference
- workplace/college optional
- stage
- temperature/tag
- nextFollowUpAt
- lastContactAt
- lostReason
- createdAt
- updatedAt

## Stages

```text
new
contacted
visit_scheduled
visited
negotiating
token_pending
token_paid
reserved
moved_in
lost
spam
```

Transitions must be explicit and auditable.

## Activities

Store timeline events separately:

- note
- call
- WhatsApp sent
- status change
- visit created
- visit completed
- token link sent
- payment received
- reservation created
- lost reason

## CRM UI

Provide:

- Kanban pipeline
- table/list mode
- today follow-ups
- overdue follow-ups
- filters by property/source/stage/owner
- quick WhatsApp/call actions
- next-follow-up control
- bulk assignment
- source conversion report

Avoid heavyweight CRM complexity.

---

# 12. WhatsApp-First Communication

Do not try to replace WhatsApp for ordinary communication.

Create a provider-agnostic messaging service.

Suggested interface concepts:

```ts
sendTemplateMessage(...)
sendTransactionalMessage(...)
createDeepLink(...)
getDeliveryStatus(...)
```

Use WhatsApp for:

- lead acknowledgement
- property details/location
- visit confirmation/reminder
- token/reservation link
- KYC onboarding link
- rent reminder
- payment receipt
- maintenance update
- notice acknowledgement
- deposit settlement summary

Important:

- template approval and provider credentials may not exist
- build templates/configuration and fallback deep links first
- never fabricate message delivery
- persist outbound message intent/status where possible

In-app messaging should remain only where a structured auditable record is useful.

---

# 13. Visit Workflow

A visit is not just a calendar entry.

States:

```text
scheduled
confirmed
rescheduled
completed
no_show
cancelled
```

Fields:

- leadId
- propertyId
- scheduledAt
- assignedStaffId
- notes
- outcome
- interestedBedIds optional
- completedAt

After visit completion UI should prompt:

- interested
- follow-up
- token requested
- lost + reason

---

# 14. Token and Reservation Workflow

Required end-to-end path:

`Lead -> Visit -> Bed selection -> Token request -> Payment -> Bed hold -> Reservation -> KYC -> Agreement -> Deposit -> Move-in`

## Reservation rules

A reservation must include:

- propertyId
- roomId
- bedId
- lead/resident identity
- startDate
- expiryAt
- token amount
- token payment state
- refundable/non-refundable policy snapshot
- status
- cancellation reason

Statuses:

```text
pending_payment
held
confirmed
expired
cancelled
converted_to_stay
```

Server must reject conflicting bed holds/reservations.

## Expiry

If a reservation/token deadline expires:

- reservation releases automatically/logically
- bed becomes available according to real occupancy state
- audit event recorded
- lead returns to appropriate CRM state

Do not require cron if Cloudflare scheduled triggers are unavailable; implement deterministic expiry evaluation on reads/writes plus optional scheduled cleanup.

---

# 15. Rent and Billing Engine

Existing invoices/rent logic should be extended rather than replaced.

Support:

- monthly recurring rent
- custom due date
- prorated first month
- prorated final period where policy allows
- partial payment
- advance payment
- discounts/concessions
- late fees
- electricity
- food
- laundry
- maintenance/add-ons
- damages
- manual adjustments
- credit notes / reversals where needed

Invoice lifecycle:

```text
draft
issued
partially_paid
paid
overdue
void
refunded/adjusted where applicable
```

Never mutate paid financial history silently.

Use adjustment transactions/audit entries.

---

# 16. Payment Integration and Reconciliation

Build a payment provider abstraction suitable for Razorpay/UPI-first India workflows.

Requirements:

- create payment intent/link/order
- associate payment with invoice/token/deposit
- webhook verification
- idempotency key
- gateway event storage
- payment status transitions
- manual UPI/NEFT/cash recording
- UTR/reference number
- partial allocation
- receipt generation/data
- refund state

Never mark a gateway payment successful from client redirect alone.

Webhook/server verification is required.

## Reconciliation view

Owner/finance users need:

- unmatched payments
- partially allocated payments
- failed payments
- manual payments awaiting approval if configured
- duplicates/suspected duplicates
- settled/verified payments

---

# 17. Automated Collection Cycle

Build configurable reminder rules.

Default example:

- T-5 days: gentle reminder
- T-2 days: upcoming due
- due date: due today
- +2 days: overdue reminder
- +5 days: escalation

Allow per-property settings.

Do not spam tenants; maintain last-sent and channel state.

Owner must be able to answer **"Who owes me money?"** immediately.

---

# 18. Expense Ledger and Property P&L

Add proper owner expense tracking.

Expense categories:

- building lease/rent
- electricity
- water
- staff salary
- food
- LPG
- housekeeping supplies
- laundry
- repairs
- internet
- broker commissions
- marketing
- maintenance/vendor
- software
- taxes/fees
- miscellaneous

Fields:

- organization/property
- category
- amount
- date
- vendor
- payment method
- reference
- notes
- attachment optional
- recurring flag optional

Reports:

- revenue
- collected
- outstanding
- expenses
- operating surplus/profit proxy
- revenue per occupied bed
- revenue per available bed
- expense per occupied bed
- category trend

Clearly label accounting approximations; do not pretend to replace statutory accounting.

---

# 19. Deposit Ledger and Settlement

Treat security deposits as a liability-like tracked balance, not ordinary revenue.

For each resident/stay:

- deposit expected
- deposit received
- date/method/reference
- adjustments
- deductions proposed
- deductions approved/disputed
- refund amount
- refund status
- refund reference

Move-out settlement flow:

`Notice -> move-out inspection -> proposed deductions -> evidence -> resident acknowledgement/dispute -> final approval -> refund -> settlement receipt`

Deduction record:

- category
- amount
- explanation
- evidence media
- createdBy
- resident acknowledgement state

Never allow an unexplained balance reduction.

---

# 20. Move-In / Move-Out Evidence

Create structured inspections tied to stay and room/bed.

Checklist can include:

- room photos
- walls
- mattress
- bed
- furniture
- wardrobe
- bathroom
- appliances
- meter reading
- keys/access cards
- pre-existing damage
- notes

Both resident and staff confirmation states should be stored.

Media access must be scoped.

A move-out inspection should support side-by-side reference to move-in evidence.

---

# 21. KYC and Agreement Workflow

Do not build unsafe DIY identity verification.

Create domain states + provider interfaces.

## KYC states

```text
not_started
pending
submitted
verified
rejected
expired
```

Store:

- provider reference
- verification type
- masked identifier if required
- verified name
- verification timestamp
- consent timestamp
- rejection reason

Avoid storing complete Aadhaar numbers.

## Agreement states

```text
draft
sent
resident_signed
owner_signed
fully_executed
expired
terminated
```

Agreement snapshot must preserve the commercial terms agreed at signing:

- rent
- deposit
- due date
- notice
- lock-in
- included services
- electricity model
- refund policy
- important house rules

Do not silently update an executed agreement when the property later changes default rules.

---

# 22. Compliance Center

This is a differentiator.

Build the framework, not unverified legal advice.

## Model

`ComplianceTemplate`

- jurisdiction
- city/state
- property type
- checklist item definitions
- source/reference note
- configurable/active version

`PropertyComplianceItem`

- propertyId
- templateItemId
- status
- documentId
- issuedAt
- expiresAt
- verifiedAt
- verifiedBy
- notes

Statuses:

```text
not_applicable
missing
uploaded
under_review
verified
rejected
expired
```

Initial categories may include:

- owner/operator identity
- property location/address proof
- local registration/licence placeholder
- fire/safety documentation placeholder
- structural/use permissions placeholder
- CCTV/security declaration
- food/FSSAI applicability placeholder
- tenant police verification tracking
- emergency contacts
- inspection history

Important UI language:

- never show "100% safe"
- never imply legal compliance solely because a document was uploaded
- distinguish `uploaded`, `verified`, and `self-declared`

Add expiry reminders.

Use jurisdiction configuration because Delhi, Noida, Gurugram, Ghaziabad and Faridabad may differ.

---

# 23. PGWalo Verification Layer

Public listing should show specific facts, not one vague badge.

Possible public facts:

- identity verified
- location verified
- property visited by PGWalo
- selected safety documentation verified
- food licence verified where applicable
- digital agreement supported
- deposit policy published
- latest availability timestamp
- verified resident review count

Each badge/fact needs:

- source/status
- verification timestamp
- expiry if relevant

Do not expose private documents publicly.

---

# 24. Public Listing and Search UX

Current filters should remain but public cards/details should be upgraded.

## Search filters

At minimum:

- city/locality
- move-in date
- gender/property eligibility
- budget
- sharing type
- food
- AC
- attached washroom
- distance/commute when map support exists
- available now / future available
- verified attributes

## Listing card

Show:

- property image
- property name
- locality
- verified facts compactly
- monthly price range
- sharing type
- available now / available from date
- total mandatory monthly cost indicator where calculable
- move-in cash estimate where calculable
- last availability update

## Property detail

Required sections:

1. live room/bed availability
2. monthly pricing
3. mandatory extras
4. deposit
5. token policy
6. notice period
7. lock-in if any
8. electricity calculation
9. food inclusion
10. key house rules
11. verification facts
12. verified reviews
13. map/commute
14. schedule visit
15. reserve/request token when eligible

Avoid fake urgency such as "only 1 bed left" unless the live inventory actually supports it.

---

# 25. Total-Cost Transparency

A resident should see three concepts separately:

## Monthly recurring cost

- rent
- mandatory food
- fixed maintenance
- other mandatory monthly fees

## Variable charges

- electricity model
- laundry
- optional services

## Move-in cash

- first rent amount
- deposit
- token adjustment
- one-time fee if any

Do not hide mandatory charges behind "starting from" pricing.

---

# 26. Verified Reviews

Only residents linked to a completed/active verified stay should be able to submit a verified review.

Suggested dimensions:

- listing accuracy
- cleanliness
- food
- maintenance
- staff behavior
- internet
- billing transparency
- deposit settlement

Rules:

- one review per stay unless edited
- owner may respond
- owner cannot delete negative reviews
- admin moderation only for policy violations/spam
- keep audit history of moderation

Public rating should distinguish verified-stay reviews.

---

# 27. Maintenance SLA Workflow

Extend maintenance tickets.

Statuses:

```text
open
assigned
accepted
in_progress
waiting_vendor
resolved
resident_confirmed
closed
cancelled
```

Fields:

- category
- severity
- property/room/bed
- resident
- assigned staff/vendor
- SLA target
- attachments
- estimated/actual cost
- resolution notes
- resident confirmation
- repeat issue link

Owner analytics:

- open count
- overdue SLA
- average resolution time
- repeat category
- maintenance cost per bed/property

---

# 28. Food Operations — P1, Not P0

Do not over-invest in attendance-only features.

When implemented, connect meals to cost/waste:

- menu
- meal opt-in/out
- expected count
- actual prepared count
- actual attendance count optional
- vendor/kitchen
- food cost
- waste estimate
- resident feedback

Goal: reduce wastage and complaints.

---

# 29. Parent/Guardian View — P1

For student properties, optional guardian access can show:

- payment/receipt status
- executed agreement
- emergency/property contacts
- important property notices
- deposit status
- public safety/verification facts

Do not expose invasive movement tracking by default.

---

# 30. Institutional/Bulk Booking — P1

Model future demand source:

- institution/company
- contact
- required beds
- gender/property eligibility
- target localities
- budget
- move-in date
- duration
- status
- shortlisted properties
- allocated beds

Do not let this block P0 launch.

---

# 31. Analytics Definitions

Implement consistent calculation functions rather than ad-hoc component math.

Required owner metrics:

- total beds
- occupied beds
- vacant beds
- occupancy rate
- future vacancies 7/30/60 days
- average vacancy days where data supports it
- leads by source
- lead -> visit conversion
- visit -> token conversion
- token -> move-in conversion
- collection rate
- overdue amount
- average days overdue
- deposit liability
- revenue per occupied bed
- revenue per available bed
- expense per bed
- maintenance cost per bed
- resident churn/move-outs
- average complaint resolution time

Document denominator and date-window definitions.

Never show a metric whose source data is incomplete without a clear incomplete/estimated state.

---

# 32. Action and Notification System

Prefer one unified actionable feed over scattered counters.

Action object concept:

- entity type/id
- action type
- priority
- dueAt
- propertyId
- assignee
- read/done status
- deep link

Examples:

- follow up lead
- visit today
- reservation expires in 4 hours
- rent 5 days overdue
- KYC pending
- compliance expires in 30 days
- maintenance SLA missed
- deposit settlement pending

---

# 33. Audit Requirements

Create/extend audit events for:

- role/permission change
- tenant creation/update
- room/bed reassignment
- reservation/token status
- payment creation/reconciliation/refund
- invoice adjustment
- deposit deduction/refund
- agreement signature status
- KYC state change
- compliance verification
- review moderation
- sensitive document access where feasible

Audit records must not be user-editable.

---

# 34. Database Design Guidance

Reuse existing collections/tables where they already represent these concepts.

Only add new tables when the entity has its own lifecycle/history.

Likely additive entities may include:

- `leads`
- `lead_activities`
- `visits`
- `reservations`
- `payment_gateway_events`
- `expenses`
- `deposit_deductions` or settlement lines
- `inspections`
- `inspection_items`
- `compliance_templates`
- `property_compliance_items`
- `verification_records`
- `reviews`
- `review_responses`
- `permission_assignments` / role capabilities
- `import_jobs` / import errors if needed

Do not blindly create these if equivalent tables already exist.

Every table should have appropriate:

- IDs
- org/property scoping
- created/updated timestamps
- indexes on frequent filters
- status constraints/checks where D1/SQLite conventions permit

---

# 35. API Wiring

Follow the current Worker/API style.

Prefer explicit domain endpoints for transactional workflows rather than forcing everything through generic CRUD.

Examples:

```text
/api/leads
/api/leads/:id/activities
/api/leads/:id/transition
/api/visits
/api/reservations
/api/reservations/:id/cancel
/api/payments/create-link
/api/payments/webhook/:provider
/api/payments/:id/reconcile
/api/billing/run
/api/deposits/:stayId/settlement
/api/inspections
/api/compliance/properties/:propertyId
/api/reviews
/api/imports/preview
/api/imports/commit
/api/analytics/owner
```

Use existing routing conventions if different.

All domain mutations must validate scope and allowed state transition.

---

# 36. Client-Service Wiring

Extend `src/services/productionApi.ts` or split into domain service modules only if it improves maintainability without breaking imports.

The client should not know Worker SQL details.

Use typed request/response objects.

Demo mode needs equivalent mocked behavior for the P0 workflows so demos remain usable.

---

# 37. AppContext / State Strategy

Do not turn AppContext into an even larger unstructured object.

If it is already overloaded:

- keep compatibility exports/actions
- move domain operations into focused hooks/services/reducers
- keep normalized source-of-truth where possible
- avoid multiple inconsistent copies of bed, resident, invoice and lead state

Refresh/invalidate related domain slices after transactional mutations.

Example:

A successful move-in can affect:

- lead
- reservation
- bed
- resident
- stay
- invoice/deposit state
- dashboard KPIs

Create a controlled mutation result/update path instead of manually patching six UI screens independently.

---

# 38. UI / UX Design System Requirements

## General

- mobile-first because owners and staff often operate from phones
- desktop-optimized tables for owners/finance/admin
- PWA-friendly
- fast perceived performance
- clear empty states
- no decorative complexity that slows operational tasks
- use existing Tailwind conventions
- reuse current components before adding new component primitives

## Information hierarchy

- critical action first
- money second
- occupancy third
- pipeline fourth
- reports/settings later

## Forms

- sensible defaults
- autosave drafts where safe
- explicit save for financial/legal transitions
- inline validation
- Indian phone formatting
- INR formatting
- date clarity
- avoid 20-field screens; use sections/steps

## Status colors

Use the existing design tokens if available.

Ensure statuses also have text/icon labels; never rely only on color.

## Mobile tables

Convert dense rows into cards or horizontal-scrolling data tables with sticky primary fields.

## Owner language

Prefer operational wording:

- Vacant beds
- Rent due
- Follow up today
- Deposit to refund
- Document expiring

Avoid technical jargon.

---

# 39. Navigation Recommendation

Owner primary nav:

1. Home
2. Leads
3. Inventory
4. Residents
5. Money
6. Operations
7. Compliance
8. Reports
9. Settings

Suggested subareas:

## Money

- invoices
- collections
- overdue
- deposits
- expenses
- reconciliation

## Operations

- maintenance
- staff
- inspections
- visitors
- meals where enabled

Do not create 15 top-level tabs.

Resident primary nav:

1. Home
2. Payments
3. Stay & Agreement
4. Maintenance
5. Notice / Move-out
6. Profile

---

# 40. Performance Requirements

- paginate/filter large owner datasets server-side where practical
- avoid bootstrapping full platform data to ordinary users
- preserve role-scoped bootstrap behavior
- do not load all media at original resolution in listing cards
- lazy-load heavy dashboard modules
- debounce search
- use DB indexes for organization/property/status/date filters

---

# 41. Error Handling

User-facing errors must be actionable.

Examples:

Bad:

> Something went wrong.

Better:

> This bed was reserved by another booking. Choose a different bed or refresh availability.

For payment webhooks and financial transitions:

- log structured error context
- avoid duplicate side effects
- keep retry-safe logic

---

# 42. Feature Flags

Add a minimal feature/capability flag mechanism if not already present.

Useful flags:

- `whatsappAutomation`
- `paymentGateway`
- `kycProvider`
- `esignProvider`
- `complianceCenter`
- `verifiedReviews`
- `publicLiveInventory`
- `parentPortal`
- `institutionalBooking`

Flags can be environment/org-level as appropriate.

External integrations must fail closed/clearly when disabled.

---

# 43. Seed/Demo Data

Update demo data enough to demonstrate the new workflow:

- lead from Noida Sector 62 search
- visit scheduled
- token/reservation
- resident under notice
- future vacancy
- overdue invoice
- partial payment
- expense entries
- deposit settlement with evidence
- maintenance SLA item
- compliance expiry item
- verified review

Do not create huge fake datasets.

---

# 44. Testing Requirements

At minimum add tests for critical domain rules.

## Inventory/reservations

- cannot reserve occupied/unavailable bed for conflicting date
- future vacancy can accept eligible next reservation
- expired hold releases correctly

## Billing

- proration
- partial payment
- overdue calculation
- adjustment without mutating historical payment

## Payments

- webhook idempotency
- invalid webhook rejected
- payment allocation cannot exceed safe limits without explicit credit logic

## Deposits

- deduction lines sum correctly
- final refund cannot be negative without explicit amount-due behavior
- evidence/description required for configurable deduction categories

## Permissions

- finance user cannot edit compliance verification unless granted
- staff cannot access another organization
- resident cannot access another resident's financial records

## Reviews

- only verified stay can create verified review

## Import

- invalid rows rejected with clear row errors
- duplicate resident/bed handling deterministic

Run existing tests and add new ones using the repository's established test stack.

---

# 45. Production Hardening Checklist

Before declaring launch-ready, verify:

## Authentication / authorization

- JWT expiry handled
- role/capability enforcement server-side
- org/property scoping tested
- sensitive document access scoped

## Data

- migrations are ordered and repeat-safe as designed
- production bootstrap excludes irrelevant data
- backup/export strategy documented

## Storage

- R2 binding configured or upload feature clearly disabled
- file type/size validation
- private files not served as public assets

## Payments

- webhook secret verification
- idempotency
- no client-only success
- refund path
- reconciliation

## Privacy

- consent capture for sensitive workflows
- masked identity display
- retention/deletion hooks documented
- no sensitive PII in logs

## Observability

- health endpoint
- structured server errors
- critical event/audit visibility

---

# 46. Launch Acceptance Criteria

The product is not launch-ready until a new owner can complete this scenario in production mode:

1. Register/login.
2. Create organization/property.
3. Import or create rooms/beds.
4. Import active residents.
5. See correct current occupancy.
6. Publish listing with transparent pricing.
7. Receive/create lead.
8. Move lead through CRM.
9. Schedule visit.
10. Select bed.
11. Create token/payment request.
12. Confirm reservation without double booking.
13. Complete KYC state.
14. Generate/store agreement state.
15. Record deposit.
16. Move resident in.
17. Generate monthly invoice.
18. Record online/manual partial/full payment.
19. Reconcile payment.
20. Raise and resolve maintenance ticket.
21. Resident submits notice.
22. Bed becomes future-available.
23. New lead can reserve future availability without conflict.
24. Move-out inspection is recorded.
25. Deposit deductions are itemized with evidence.
26. Refund settlement is recorded.
27. Resident can leave a verified-stay review.
28. Owner dashboard metrics update correctly.
29. Audit trail shows major transitions.

Resident and staff authorization boundaries must hold throughout.

---

# 47. Definition of Done Per Feature

A feature is done only when all applicable layers are complete:

- domain/type
- DB schema/migration
- Worker API
- authorization
- production API client
- app state wiring
- UI
- loading/empty/error states
- demo-mode behavior where applicable
- audit events
- tests
- build/typecheck pass
- documentation/env example if integration-related

A UI-only mock is not done.

---

# 48. Implementation Sequence

Use this practical sequence.

## Sprint 1 — Architecture + owner foundation

- repo audit
- capability layer
- owner home redesign
- import flow
- inventory/future availability

## Sprint 2 — Sales pipeline

- leads
- activities
- visits
- reservation/token lifecycle
- WhatsApp deep-link/provider abstraction

## Sprint 3 — Collections

- recurring billing hardening
- payment provider abstraction/webhooks
- reconciliation
- partial/prorated payments
- reminder engine

## Sprint 4 — Finance + deposit trust

- expenses/P&L
- deposit ledger
- move-in/out inspections
- settlement evidence

## Sprint 5 — Trust/compliance

- KYC state/provider abstraction
- agreement snapshot/sign state
- compliance center
- public verification facts
- verified reviews

## Sprint 6 — Operational polish

- maintenance SLA
- action center
- analytics
- performance/security review
- launch regression suite

Do not begin P1/P2 until P0 acceptance flows pass.

---

# 49. Deliverables You Must Produce in the Repository

1. Working code.
2. D1 migrations.
3. Updated schema source-of-truth as appropriate.
4. Updated TypeScript domain types.
5. API route changes.
6. Production client wiring.
7. UI changes.
8. Demo fixtures.
9. Tests.
10. `.env.example`/configuration notes for new integrations.
11. A concise `MARKET_READY_IMPLEMENTATION.md` containing:
   - implemented modules
   - migrations
   - feature flags
   - external integrations still requiring credentials
   - security/privacy considerations
   - known limitations
   - launch checklist status

Do not generate verbose duplicate documentation.

---

# 50. Final Agent Reporting Format

At the end of each sprint, report only:

```text
Sprint: <name>
Status: complete / partial / blocked
Changed: <short file/module list>
Migrations: <ids>
Tests: <pass/fail + command>
Build: <pass/fail + command>
Remaining blockers: <only real blockers>
Next: <next sprint>
```

At final completion, include:

- launch acceptance checklist pass/fail
- unresolved high-risk items
- exact environment credentials/services still needed
- no generic praise or long retrospective

---

# 51. Anti-Scope Rules

Unless required to repair the existing product, do not:

- rewrite the frontend framework
- replace Cloudflare/D1
- introduce microservices
- introduce Kubernetes
- build a social feed
- build crypto payments
- build generic AI chat
- build elaborate gamification
- create a native mobile app before PWA workflows are stable
- build IoT before core billing/inventory works
- redesign admin screens that are already adequate for internal use
- add features purely because competitors have them

---

# 52. Product Decision Filter

For every proposed feature, ask:

Does it directly improve one or more of these?

1. occupancy / vacancy reduction
2. rent collection
3. owner time savings
4. operating cost control
5. dispute prevention
6. compliance/risk visibility
7. resident trust
8. property scalability

If not, defer it.

---

# 53. The Product You Are Expected to Leave Behind

When this specification is complete, PGWalo should function as an owner-first B2B2C system where:

- the owner runs real inventory in PGWalo,
- leads are converted through a measurable pipeline,
- beds can be safely reserved,
- rent and dues are automated and reconciled,
- deposits and inspections are transparent,
- future vacancy automatically becomes sellable inventory,
- compliance/document status is visible and time-aware,
- public listings show live and trustworthy operational facts,
- residents can see real cost/rules before committing,
- staff use permission-scoped operational tools,
- the platform can prove which actions create occupancy and collections.

The target is **not the maximum number of screens**.

The target is a system a PG owner becomes uncomfortable running the business without.
