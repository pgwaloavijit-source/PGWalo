# PGWalo — Market-Ready Implementation Notes

Status: **P0 implemented additively on the existing stack.** No framework, store, router or backend was replaced; demo and production modes both work; every new entity has a D1 migration and a Worker endpoint.

---

## Modules delivered

| Layer | Files |
|---|---|
| Domain (pure, shared) | `src/domain/market.ts` (capabilities, flags, CRM stages, entity types), `inventory.ts` (conflict rules, expiry, overdue rollup), `billing.ts` (proration, due-state, cycle lines), `deposits.ts` (settlement math), `messaging.ts` (WhatsApp boundary), `csvImport.ts` (parser/validator), `analytics.ts` (documented KPI calculator), `actionCenter.ts` (ranked feed), `trust.ts` (KYC/compliance state machines + verification facts), `demoSeed.ts` |
| Worker | `src/worker/handlers/market.ts` — visits, reservations (server-side conflict gate + deterministic expiry), payment intents (Cashfree payment-link creation when configured, manual UTR reconcile otherwise), idempotent Cashfree webhook, expenses, inspections, compliance, KYC, verified reviews (verified-stay gated), CSV commit, owner analytics, reminder log |
| API surface | `/api/market/{visits,reservations,payment-intents,expenses,inspections,compliance,kyc,reviews,imports/commit,analytics/owner,reminders}` + `/api/market/webhooks/cashfree` (wired in `src/worker/index.ts` before the generic collection matcher); P1: `/api/market/{guardian-access,guardian-view,institutional,meal-ops}` (guardian-view is token-scoped public) |
| Client services | `src/services/marketApi.ts` — typed wrappers; demo mode mirrors Worker rules via a localStorage store seeded from `demoSeed.ts` |
| UI | `OwnerHomeTab` (KPI strip + action center + portfolio), `CrmTab` (kanban, follow-ups, visits, reservations, WhatsApp deep links), `MoneyTab` (collections / expenses+P&L / reconciliation), `TrustTab` (compliance center, verified reviews, inspections), `ImportModal` (template → upload → preview → row errors → commit → rejection report), `PublicTrustFacts` inside `PGDetailModal` (verification facts + three-way cost split) |
| P1 (spec §28–§30) | `src/domain/p1.ts` (guardian view allow-list, institutional stage machine + bed-eligibility rules, meal waste/cost math), `GuardianAccessCard`/`InstitutionalTab`/`MealOpsCard` (owner UI), `GuardianPortal` (public `/guardian?token=` page) |
| Tests | `scripts/test-domain.ts` → `npm run test:domain` — 40 tests covering reservations, billing, deposits, permissions, KYC, imports, analytics, action ranking, messaging, guardian view, institutional booking, meal ops |

## Migrations

- **`database/market-ready.sql`** — additive only: `lead_activities`, `visits`, `reservations`, `payment_intents`, `payment_gateway_events`, `expenses`, `inspections`, `property_compliance_items`, `kyc_records`, `verified_reviews`, `import_jobs`, `reminder_log` + new nullable `leads` columns (stage_v2, follow-up, source, occupant fields).
- **`database/p1-features.sql`** — `guardian_access` (hashed tokens), `institutional_leads`, `meal_ops_log`.
- Wired into `database/apply-migrations.sh` behind the `leads.stage_v2` / `guardian_access` probes — re-runnable, safe on existing databases.

## Feature flags

`DEFAULT_FEATURE_FLAGS` in `src/domain/market.ts`: `whatsappAutomation: true` (deep links always work), `complianceCenter/verifiedReviews/publicLiveInventory: true`, and `paymentGateway/kycProvider/esignProvider/parentPortal/institutionalBooking: false` until credentials exist. Integrations fail closed and clearly — nothing simulates a successful provider call.

## External integrations still requiring credentials

| Integration | Boundary in place | Needs |
|---|---|---|
| WhatsApp BSP (templates, automation) | `domain/messaging.ts` adapter + wa.me deep links, intent records | BSP account + approved templates (`sendViaApi` plugs into the existing adapter) |
| Cashfree (token/rent/deposit + listing plans) | Payment links created only when `CASHFREE_*` exist; `x-webhook-signature` HMAC verification implemented; server-side order-status poll on verify; manual UTR reconcile otherwise | `wrangler secret put CASHFREE_APP_ID / CASHFREE_SECRET_KEY / CASHFREE_WEBHOOK_SECRET` — see `CREDENTIALS_SETUP_LOG.md` |
| KYC provider | State machine + masked identifiers + consent timestamps only | Provider account; adapter receives masked refs, never full Aadhaar |
| e-Sign / e-stamp | Agreement states preserved; snapshot fields exist | Provider + legal text |
| R2 media | Existing media handler unchanged | Bucket enablement (pre-existing known gap) |

## Security / privacy

- Every market mutation re-authenticates (JWT + live account status), checks role capability, validates org/property scope, enforces state-transition tables, and writes an `audit_logs` row.
- Reservation conflicts are enforced **server-side** (`checkReservationConflict` in the Worker) — the client check is convenience only.
- Gateway payments can never be marked paid manually (HTTP 422); webhook signatures verified with HMAC-SHA256; fulfilment idempotent on intent status; raw payloads stored in `payment_gateway_events`.
- No full Aadhaar storage anywhere; KYC stores provider reference + masked identifier + consent timestamp; `redactKycForDisplay` truncates provider refs.
- Deposit refunds never go negative — excess deductions surface as a `shortfall` to collect explicitly; unexplained deductions are rejected.
- Payments confirmed only via webhook; client redirects never grant success.

## Known limitations

- ~~Payments reconciliation covers only the new intent table~~ — **closed:** webhook-paid `rent` intents now settle the legacy invoice (payment row + `verified_paid_amount` + status recompute + resident tracking) via `settleRentIntent`.
- ~~`converted_to_stay` is a dead-end state~~ — **closed:** `POST /api/market/reservations/:id/convert-to-stay` creates resident + stay, flips the bed Occupied, and marks the reservation converted in one D1 batch (idempotent).
- ~~Reminder engine is client-manual~~ — **closed:** §17 cycle (T-5/T-2/due/+2/+5) now runs from the Money tab's collection-cycle card with per-(resident, invoice, rule) suppression backed by `reminder_log`.
- ~~Funnel/conversion metrics compute client-side~~ — **closed:** `/api/market/analytics/owner` computes stage funnel, lead→visit / visit→token / token→move-in conversions, deposit liability and 7/30/60-day future vacancies server-side from live tables; OwnerHomeTab renders the conversion strip.
- Compliance "verified" status is operator-set in this build; a PGWalo ops review workflow is the intended next step.
- Reviews require a Current/Closed stay; demo residents seeded without stays can review only in demo mode.
- ~~Parent portal / institutional booking / meal ops are not started~~ — **built (P1):** §29 guardian access (hashed one-time invite tokens, revocable, fixed non-invasive fact allow-list, public `/guardian?token=` page); §30 institutional pipeline (create → shortlist → allocate ≤ requested → won/lost, server-side vacant-bed matching by gender model/budget); §28 meal ops log (prepared vs attended vs cost, over-preparation %, cost per eaten meal). Demo mode mirrors all three rules in localStorage.
- Meal ops is a logging/insight tool: it does not yet auto-count attendance from gate logs (manual entry by design for P1).

## Launch checklist status

| Spec §46 criterion | Status |
|---|---|
| Register/login, org/property, rooms/beds, residents | ✅ pre-existing + CSV import path |
| Correct occupancy, publish listing, transparent pricing | ✅ + verification facts & move-in cash estimate on detail modal |
| Lead CRM → visit → bed → token → reservation without double booking | ✅ server-enforced (tested) |
| KYC state, agreement state, deposit record | ✅ states + boundary (provider accounts pending) |
| Monthly invoice, manual/online payment, reconciliation | ✅ intents + UTR reconcile + webhook path |
| Maintenance SLA, notices, future availability → next reservation | ✅ conflict rules cover notice beds (tested) |
| Move-out inspection, itemized deductions with evidence, refund | ✅ settlement math (tested) |
| Verified-stay review | ✅ stay-gated server-side |
| Dashboard metrics update, audit trail | ✅ action center + analytics + audits on every mutation |

Environment notes: see `.env.example`; run `npm run db:migrate` (local) or `npm run db:migrate:remote` before deploying, then `npm run deploy`.
