# PGWalo — Regression Report (2026-09-17)

Method: every flow was exercised as real HTTP against a real Worker + real D1
(local `wrangler dev`, seeded from `database/schema.sql` + all migrations). The
suite lives at `scripts/test-e2e-flow.ts` and is run with `npm run test:e2e`.

It signs up an owner, publishes a listing, signs up a resident, books a PG,
raises a support ticket, creates staff, logs in as staff, then drives the whole
super-admin surface — and asserts the exact response shapes the browser client
parses.

| Run | Result |
|-----|--------|
| Round 1 baseline (local) | **32/37** |
| Round 1 after fixes (local / live) | **45/45** |
| Round 2 after owner·staff·resident fix (local) | **61/61** |
| Round 2 (**live, https://pgwalo.com**) | **61/61** |

Round 2 covers the owner, staff and resident flows plus bed allotment, agreement
dispatch/receipt, notices, ticket attachments and status-change notifications.

Deployed in two steps: `47e385be` (functional fixes) and `8c4e7b6e` (bundle
secret removal). All figures below were re-verified against production D1.

---

## Verified working (post-fix)

Every row below was asserted end-to-end against the live Worker, not assumed.

| Flow | Result |
|------|--------|
| `GET /api/health` | 200 |
| Super admin login (username **and** phone + PIN) | JWT, `role=superadmin` |
| Owner signup (OTP send → verify → register) | 201, org created |
| Owner login with new credentials | 200 |
| Owner publishes listing → `POST /api/listings` | 201 |
| Listing visible on public `GET /api/listings` | yes, attributed to owner user id |
| Resident signup / login | 200 |
| Resident booking → `POST /api/inquiries` | 201 |
| Owner sees that booking (`?ownerUserId=`) | yes — resident → owner flow |
| Resident raises / lists own support ticket | 201 / 200 |
| Owner creates staff login → `POST /api/auth/staff` | 201 |
| Staff logs in with phone + PIN | 200 |
| Admin `/api/admin/overview` counters | real D1 counts |
| Admin users list incl. new owner / resident / staff | yes |
| Admin bookings + payments lists | yes, camelCase rows, paginated |
| Admin ticket list + requester name | yes |
| Admin mutations (user status, listing approve, ticket reply/status) | 200 + audit rows |
| RBAC: anonymous → 401, resident on `/api/admin/*` → 403 | yes |
| Owner bootstrap org-scoped | yes |
| Resident bootstrap returns the PG catalog | yes |
| Resident bootstrap carries only the caller's own rows/tickets | yes |
| Resident still blocked from org-wide `/api/residents` | 403 |
| Bootstrap never ships `password_hash` / `aadhaar_hash` | yes |

---

## Defects found and fixed

### P0-1 — Admin lists rendered empty (Users / PG Owners / Tenants / Bookings / Payments)
**Root cause.** `src/services/adminApi.ts` read `data.items`, but the Worker
returns a *named* envelope: `{ users | bookings | payments, page, pageSize,
total, totalPages }`. `data.items` was always `undefined` → `[]`, and because the
console runs in strict live mode it rendered "No matching accounts."

**This was the reported "cannot see the tenants list, cannot see the owner
list".**

**Fix.** `fetchEnvelope()` now takes the collection key, reads the named array
first and keeps `items` as a fallback, and normalises pagination meta.

### P0-2 — Listing publish failed with `no column named owner_user_id`
**Root cause.** `database/listings.sql` (adds `properties.owner_user_id`,
`properties.place_label`) and `database/tenant-staff.sql` (adds
`staff_members.owner_user_id`, `organization_id`) were not listed in the
deployment notes, and neither `package.json` nor `database/apply-migrations.sh`
existed to run them. A freshly seeded local D1 therefore failed
`POST /api/listings` with `D1_ERROR: table properties has no column named
owner_user_id`, which is exactly what the first regression run hit.

**Scope correction.** Verifying against production D1 showed the columns **do**
already exist remotely (`properties` 2/2, `staff_members` 2/2), so this was a
*local-environment and documentation* gap, not a production outage. Owners have
published PGs on prod (5 properties, 3 owner-created).

**Fix.** Added the idempotent `database/apply-migrations.sh`
(`npm run db:migrate` / `db:migrate:remote`), which probes the live schema and
only applies what is missing. Ran it against local (applied) and remote
(verified already current). `d1:listings` / `d1:staff` scripts added, and the
migration list is now complete and re-runnable.

### P1-3 — Bootstrap omitted `users` / `support_tickets` and never mapped bookings
**Root cause.** `bootstrapScope.ALL_TABLES` omitted `users` and
`support_tickets` even though `bootstrap.ts` had mappers for both, so the admin
console's Dashboard / Reports / Analytics silently fell back to mock+localStorage
data. Separately, `rowToBookingRequest` was never registered in `ROW_MAPPERS`, so
`booking_requests` reached the client as snake_case and the admin Bookings table
rendered blank Tenant / Property / Dates cells.

**Fix.** Added a platform-admin table scope (`users`, `support_tickets`) with row
limits, registered `rowToBookingRequest`, and added `sanitizeRow()` so
`password_hash` / `aadhaar_hash` are stripped before anything leaves the Worker
(this was latent: `SELECT *` on `users` would have leaked credential hashes).

### P1-4 — Resident and staff dashboards received an empty snapshot
**Root cause.** The permission matrix in `middleware/auth.ts` did not match the
`READ_PERMISSIONS` map used by the bootstrap and collection handlers:
* `staff.view` belonged to **no role at all** — so staff, tasks, broadcasts,
  meal plans, leads and settings were empty for staff / warden / manager /
  accountant.
* `room.view` and `resident.view` were missing from `resident` — so a resident's
  entire snapshot (properties, residents, stays, invoices, payments, notices,
  agreements) came back empty.

**Fix.** Rebuilt the matrix (added `staff.view`, `shared.view`, `room.view` to
the roles that need them) while keeping `resident` off `resident.view` so the
org-wide collection routes stay closed, and added explicit requester scoping in
`handlers/bootstrap.ts` (`residents` by id/email, `resident_id IN (…)` for the
ledger tables, `requester_id` for tickets). Email is now carried in the JWT so
rows can be matched to the signed-in account.

### P1-5 — Support-ticket id mismatch between client and server
**Root cause.** `createSupportTicket` minted `support-<Date.now()>` locally, the
Worker minted its own id, and the POST response was discarded. The resident's
cached ticket and the durable row never reconciled, so an admin reply landed on a
record the requester never saw.

**Fix.** The client now sends its id (validated server-side), re-keys if the
Worker generated a different one, and a new `services/supportTickets.ts` exposes
`postSupportTicket` / `fetchMySupportTickets`. `support_tickets` was added to the
resident bootstrap scope, requester-scoped.

### P0-8 — Super-admin password was published in the public JavaScript bundle **FIXED**
**Root cause.** `AppContext.login()` had a demo-mode fallback that compared the
submitted credentials against `import.meta.env.VITE_SUPERADMIN_PHONE / _PIN /
_USERNAME / _PASSWORD`, and `.env` supplied those values. Vite inlines every
`VITE_`-prefixed variable into the client bundle, so the live file
`https://pgwalo.com/assets/index-BUv_xuvO.js` contained the literal string
`1q2w3e4r5t` — a working Super Admin password readable by any visitor.

This is far more severe than the original report: it is a full admin-console
takeover vector, not just a secret-in-config exposure.

**Fix.** Removed the browser-side credential fallback entirely (Super Admin auth
is enforced by the Worker against `SUPERADMIN_*`), deleted the four declarations
from `src/vite-env.d.ts`, and stripped the values from `.env` / `.env.example`
with an explicit "never put secrets here" warning. Verified after redeploy:
the password is absent from the new entry chunk, the old chunk is no longer
served, real login still succeeds, and a wrong password returns 401.

**Action required by the account owner: rotate `SUPERADMIN_PASSWORD` and
`SUPERADMIN_PIN`.** They were public for an unknown period, so treat them as
compromised.

### P2-6 — Super-admin credentials committed in `wrangler.toml [vars]`
`SUPERADMIN_PHONE/PIN/USERNAME/PASSWORD` are plaintext `[vars]`, readable by
anyone with Wrangler access (the deploy log prints them). **Still open** —
moving them to `wrangler secret put` must be done with the account owner
present, otherwise login breaks. Note the same PIN/password were also the ones
leaked in P0-8, so rotating them is mandatory either way.

### P2-7 — `npm run test:worker` was stale
It relies on the `x-user-role` dev bypass, which is disabled because
`wrangler.toml` sets `ENVIRONMENT = "production"`, and it references the retired
`org-demo-blue-haven` org. Superseded by `npm run test:e2e`; not fixed here.

---

---

# Round 2 — owner / staff / resident features

Deployed as `b08df644` and `46003b82`. Verified with the same suite, extended to
**61 checks**, run against `https://pgwalo.com` (61/61).

## Verified working now (live)

| Feature | Assertion |
|---------|-----------|
| Owner login / dashboard snapshot | org-scoped, owners own rows only |
| **Bed allotment** | owner pushes bed + stay; bed reads `Occupied` for the owner |
| **Resident receives room + bed** | `residents.roomNumber = 201`, stay record present |
| **Agreement dispatch → received** | resident bootstrap returns the agreement in camelCase (`agreementNumber`, `tenantDOB`) |
| **Notices / notifications** | owner broadcast reaches the resident inbox from the DB |
| **Ticket attachment** | a 300-char media reference round-trips intact |
| **Ticket status change notification** | admin status change creates a personal notification addressed to the requester |
| Staff login (phone + PIN) | 200, and the staff snapshot is no longer empty |
| Staff operational data | properties, tasks, meal plans, maintenance, broadcasts, attendance, visitors all readable |
| Staff receives the owner's meal plan | yes |
| Resident isolation | no other tenant's records in the resident snapshot |

## What was still broken, and why

### R2-1 — `POST /api/bootstrap` had **never** worked (the big one)
The handler opened with `await env.DB.batch([env.DB.prepare('BEGIN TRANSACTION')])`.
D1 rejects explicit transaction statements:

> `D1_ERROR: To execute a transaction, please use state.storage.transaction() … instead of the SQL BEGIN TRANSACTION or SAVEPOINT statements.`

So every save threw immediately, the `catch` block's own `ROLLBACK` threw again,
and `AppContext` swallowed it as `console.warn('…production API sync failed')`.

**Consequence:** virtually every owner/admin mutation was browser-local and
ever persisted — bed allotment, move-in, transfers, residents, invoices,
payments, notices, checkouts. Production D1 showed `beds: 0, rooms: 0` no matter
how much work an owner did. This is the deepest cause of "no functional thing".

**Fix:** dropped all `BEGIN`/`COMMIT`/`ROLLBACK` (a D1 batch is already atomic),
and rewrote the write path to be correct and self-healing:
* maps the client's camelCase to D1's snake_case (`bedNumber` → `bed_number`,
  `tenantDOB` → `tenant_dob`);
* drops fields that have no column (`listingStatus`, `floors`) instead of letting
  one stray key abort the sync;
* probes `pragma_table_info` per table and fills NOT NULL-without-default columns
  the client omitted, so a collection can't be silently dropped;
* writes **one batch per table, parents first** (+ `PRAGMA defer_foreign_keys`) so
  a bad row in one collection can't roll back the bed allotment;
* upserts on `id` (not `INSERT OR REPLACE`, which reset `created_at`), falling
  back to REPLACE only for tables with a natural UNIQUE key (`meal_plans.day`);
* forces `organization_id` for non-platform-admins so an owner cannot write into
  another organisation;
* returns `{ ok, written, failed }` instead of a silent 500.

### R2-2 — Generic `WHERE organization_id = ?` hit tables without that column
`bootstrap` applied the org filter to every non-admin table. `broadcast_notifications`,
`rent_agreements`, `meal_plans` and `maintenance_tickets` have **no**
`organization_id` column, so the query threw and the swallowed error became an
empty array. Notifications, agreements and mess menus could never reach a
dashboard.

**Fix:** probe the schema once per request and only filter on columns that exist.

### R2-3 — Agreements and broadcasts were never in the client sync payload
`saveProductionSnapshot` sent 13 collections; `rent_agreements` and
`broadcast_notifications` were not among them. Even with R2-1 fixed, an owner
could "send" an agreement and no other device could ever receive it.

**Fix:** both added to the payload and to the effect's dependency list.

### R2-4 — Resident's own record was hidden by org scoping
A resident signs up under `DEFAULT_ORGANIZATION_ID`, but the owner who onboards
them writes the `residents` row into *their* organisation. The org filter
therefore excluded the resident's own record, bed, agreement and stay.

**Fix:** for the requester-scoped tables (`residents`, the `resident_id`-keyed
ledger, `support_tickets`, `broadcast_notifications`) the precise requester scope
**replaces** the org filter for the `resident` role. Verified that no other
tenant's rows leak.

### R2-5 — Ticket attachments were corrupted on upload
`SupportCenter` read the picked file with `FileReader.readAsDataURL` and stored the
base64 string as `imageUrl`; the Worker then did `String(imageUrl).slice(0, 500)`.
Every attachment arrived truncated and unusable.

**Fix:** the file is uploaded to R2 via `/api/media/upload` and only the short
media URL is stored. The Worker cap is now 2048 chars for URLs (400 KB for inline
data URLs) instead of 500.

### R2-6 — No notification on ticket status change
An admin status change or reply updated D1 and nothing else — the requester was
never told.

**Fix:** new `broadcast_notifications.recipient_id`
(`database/notification-recipients.sql`, applied locally + remotely). The admin
handler now writes a personal notification on status change and on reply, and a
resident's bootstrap returns `(recipient_id IS NULL OR recipient_id = ?)` so they
see announcements plus their own.

### R2-7 — `approveBookingRequest` built an incomplete `stay`
The stay it created omitted `roomNumber`, `bedId`, `bedNumber` and
`monthlyRentAtStart` — all NOT NULL in `stays` — so approving a booking could
never persist a stay.

**Fix:** the builder now sets them from the allocated bed.

## Production evidence

Before R2-1, `beds`, `residents`, `stays`, `rent_agreements` were **0** in
production D1 regardless of owner activity. After the fix and the live run:

| Table | Rows |
|-------|------|
| `beds` | 2 |
| `residents` | 2 |
| `stays` | 2 |
| `rent_agreements` | 2 |
| `broadcast_notifications` | 6 |
| `meal_plans` | 1 |
| `staff_members` | 4 |
| `support_tickets` | 6 |

`audit_logs` now contains `Bootstrap Snapshot Saved` entries — a write that was
impossible before.

---

## Performance

The initial JS bundle was **1,198 kB (330 kB gzip)** shipped to every visitor.
The role dashboards are now lazily loaded behind the branded loader:

| Chunk | Size | gzip |
|-------|------|------|
| Entry (`index`) | **447 kB** | **125 kB** |
| `OwnerDashboard` | 158 kB | 36 kB |
| `ResidentDashboard` | 58 kB | 11 kB |
| `AdminDashboard` | 48 kB | 11 kB |
| `Accountant / Warden / Staff` | 20–25 kB each | ~5 kB each |

That is roughly a **62 % cut in initial JavaScript** for the public landing page.

## Branded loader

* Pre-hydration splash inlined in `index.html` (paints before the bundle parses,
  no white flash) — animated gradient ring orbiting the PGWalo mark, breathing
  glow, and a shimmer progress bar.
* React `<PGWaloLoader />` overlay takes over while the signed-in snapshot is in
  flight and doubles as the Suspense fallback for the lazily loaded dashboards.
* Both show the **"PG Walo"** wordmark directly above the progress bar with a
  live percentage, and honour `prefers-reduced-motion`.

## Remaining / known gaps

1. **Rotate `SUPERADMIN_PASSWORD` / `SUPERADMIN_PIN`** — they were readable in
the public bundle (P0-8). Then move `SUPERADMIN_*` out of `wrangler.toml
[vars]` into `wrangler secret put` (P2-6).
2. Test data created on production D1 during the live regression run —
   `E2E Owner`, `E2E Resident` (Suspended), `E2E Warden`,
   `E2E Residency <ts>` listing, 1 booking and 1 support ticket. Safe to delete
   or leave as sample data.
3. `npm run test:worker` is stale (see P2-7).
4. Pre-existing TypeScript errors remain in `mockData.ts`, `types.ts`,
   `productionWorkflow.ts`, `AppContext.tsx`, `jwt.ts` and `amenities.ts`. They
   do not block the Vite/Wrangler build; none were introduced by this change.
5. The `organizations` model is still vestigial: every non-owner signup joins
   `DEFAULT_ORGANIZATION_ID`, so "org scoping" is not a real tenant boundary.
6. Production `beds` is empty (`overview.rooms = 0`), so the admin Rooms &
   Allocations and Occupancy views have no data to show yet.
7. `overview.openTickets` counts `maintenance_tickets`, while the Tickets tab
   lists `support_tickets` — the two counters can disagree.
8. ~~`maintenance_tickets` (the resident-complaint → warden flow) is still
   **client-local only**~~ — **fixed in round 3** (see below).
9. `meal_plans`, `broadcast_notifications`, `maintenance_tickets` and
   `rent_agreements` have no `organization_id`, so they are effectively global.
   Fine for a single-tenant deployment; a real multi-tenant split needs an org
   column on those tables.
10. The snapshot sync is still whole-collection: an owner's browser pushes every
   row of 15 tables (debounced 800 ms). It is correct now but it is not a
   concurrency-safe design — two owners editing at once can still last-write-win.
   Per-entity endpoints are the right long-term fix.

## Round 3 — maintenance complaints reach the warden (deployed `9b397280`)

The resident-complaint flow was the last feature that existed only in the
browser. What was built:

- **New endpoint `POST/GET /api/maintenance-tickets`**
  (`src/worker/handlers/maintenanceTickets.ts`). Raising is bound to the JWT —
  the server resolves the caller's resident row (id variants or email), links
  `resident_id` + `requester_id` + `property_id`, and stamps the property's
  organisation so the complaint lands in the right warden/owner inbox.
- **Notifications both ways.** On raise, every staff/warden/manager/owner
  account of the property's org receives a personal notification
  (`broadcast_notifications.recipient_id`). On every status change
  (Reported → In-Progress → Resolved → Closed) the resident who raised it is
  notified — including for legacy rows that predate `requester_id`, resolved
  via the resident profile's email.
- **Scoping.** Residents see only their own complaints; staff see tickets for
  their property; warden/manager see their org; owners their org; platform
  admins everything. A resident may close their own ticket but cannot change
  its status otherwise; a stranger org gets 403.
- **Client wiring.** `addMaintenanceTicket` and `updateTicketStatus` now persist
  through `src/services/maintenanceTickets.ts` (optimistic render, server id
  reconciled), and a 25 s poll merges server state so a resident's dashboard
  shows status changes made by staff on another device.
- **Migration.** `maintenance_tickets` gained `organization_id`, `resident_id`,
  `requester_id`, `property_id`, `property_name`, `updated_at` (conditional
  ALTERs live in `database/apply-migrations.sh` because SQLite aborts a batch on
  the first duplicate column), applied locally and to production.
- **Suite grown to 71 checks**, including: resident raises → complaint linked
  to resident + org → warden inbox receives it → In-Progress → Resolved →
  resident notified (2 personal notifications) → stranger org cannot touch the
  ticket. **71/71 locally and live.**

Production D1 after the live run: 1 complaint (`requester_id` set), 4
maintenance notifications delivered, 1 ticket Resolved.

## Standing rule: support-ticket routing

- Ticket about a **property / PG** (type Room allocation or Agreement, carrying propertyId) -> routed to the property owner org: owner/manager accounts get a personal notification and work the ticket.
- Ticket about the **application itself** (Payment, General, Technical issue) -> goes to the **superadmin** desk and is resolved only there; owners are never notified.
- Property ticket whose owner cannot be resolved falls back to the superadmin desk.
- Implemented in `src/worker/handlers/supportTickets.ts` (raise-time routing + notifications); enforced server-side from the JWT, never the request body.

## Owner maintenance overview (SLA + staff performance)

- New read model: `GET /api/maintenance-tickets?view=overview` returns org-scoped
  totals, SLA health per priority, per-staff throughput and the currently
  breached complaints. Computed in SQL over the caller's own scope; residents and
  field staff get 403 (it is an operator view).
- Row scope is now defined once (`ticketScope`) and shared by the list and the
  overview, so the stats can never see more than the caller may read.
- Deadlines are compared against a bound ISO `nowIso`, never SQLite's
  `datetime('now')`: the stored timestamps use a `T` separator, and a
  space-separated comparison silently misses anything due the same day.
- UI: `OwnerMaintenanceTab` (owner rail -> "Maintenance SLA") with KPI cards,
  SLA-by-priority bars, staff table (zero-job members included) and an
  overdue/escalated list. Falls back to computing from local tickets when the
  overview call is unavailable.

## Bug fixed while building it

`assigned_staff_name`, `resolution_notes` and `cost` were guarded by
`optionalColumns()`, which only listed migration-added columns. The guard was
therefore always false, so **staff assignment, resolution notes and cost were
silently dropped by `action: 'status'`** — they only ever lived in the staff
browser's optimistic state. The probe list now covers every conditionally written
column, and the e2e suite asserts the assignment survives a round trip.
