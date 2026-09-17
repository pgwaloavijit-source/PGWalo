# PGWalo — Agent Codebase Reference

> Single source of truth for architecture, flow, and deployment. Last updated: 2026-09-17.

## Deployment state (2026-09-17)

- **Live version:** `586fac68-4359-4c6f-8d66-2cd60cddd9df` — https://pgwalo.com (also `www.`, `api.pgwalo.com`, `pgwalo.pgwalo-avijit.workers.dev`)
- **Super admin console deployed** per `superadmin-flow.md`: login (env secrets), 15-section shell, DB-backed filters/pagination, durable support tickets, audit logging.
- **D1 migrations applied to remote:** `schema.sql`, `auth-migration.sql`, `profile-kyc.sql`, `profile-extras.sql`, `admin-console-migration.sql` (adds `support_tickets` + admin lookup indexes), **`listings.sql`** (`properties.owner_user_id`, `properties.place_label`), **`tenant-staff.sql`** (`staff_members.owner_user_id`, `organization_id`), `auth-events.sql`.
- **Use `npm run db:migrate:remote`** — it probes the live schema first and only applies what is still missing, so it is safe to re-run. The two migrations above were previously missing from remote D1, which made `POST /api/listings` fail with `no column named owner_user_id` (owners could not publish a PG).
- **Post-deploy smoke checks (all passed):** `/api/health` 200; `/api/admin/*` without token → 401; superadmin login issues JWT; `/api/admin/{overview,users,bookings,payments,support-tickets}` return live D1 data with `Authorization: Bearer <jwt>`.
- **Test suite:** `npm run test:admin` — 20/20 passing (RBAC 403/401, allow-list 400s, PATCH→D1→audit flow).

> Security note: `SUPERADMIN_*` credentials are currently plain `[vars]` in `wrangler.toml` (visible to anyone with Wrangler access). Move to `wrangler secret put SUPERADMIN_PHONE|PIN|USERNAME|PASSWORD` and remove the vars block.

## Product

**PGWalo** — PG (paying-guest) accommodation discovery + property-management platform.

| Role | Dashboard | Primary actions |
|------|-----------|-----------------|
| Public | Landing, Search | Browse PGs, view details, book |
| Owner | OwnerDashboard | List properties (9-step wizard), beds, leads, rent, agreements |
| Resident | ResidentDashboard | Rent, complaints, meals, chat |
| Staff / Warden / Accountant / Admin | Role dashboards | Ops, finance, compliance |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion, Lucide |
| State | `AppContext` (large central store) + `mockData` fallback |
| Backend | Cloudflare Worker (`src/worker/`) |
| Database | Cloudflare D1 (`pgwalo-db`) — schema in `database/schema.sql` |
| Media | R2 (`pgwalo-media` — enable R2 in dashboard, then uncomment binding) |
| Cache | KV (`CACHE` namespace) for property search |
| Auth | JWT via Worker (`/api/auth/*`), stored in `localStorage` |
| PWA | `vite-plugin-pwa` (Workbox, offline shell) |
| Deploy | `wrangler deploy` — Worker serves `/api/*` + static `dist/` via `[assets]` |

**Cloudflare-only:** No Google OAuth, no Supabase, no external fonts. Auth = D1 + JWT (PBKDF2). API = same-origin `/api` in production.

---

## High-Level Flow (for review)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser PWA)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │  VITE_API_BASE_URL set?               │
         └─────────┬─────────────────┬───────────┘
                   │ NO              │ YES
                   ▼                 ▼
         ┌─────────────────┐  ┌──────────────────────────────┐
         │  Demo mode       │  │  Production API mode          │
         │  mockData.ts     │  │  productionApi.ts → Worker    │
         │  in-memory state │  │  JWT + role headers           │
         └─────────────────┘  └──────────────┬───────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │  Cloudflare Worker (index.ts)  │
                              │  /api/health                   │
                              │  /api/auth/*  (no middleware)  │
                              │  /api/media/* (public)         │
                              │  /api/bootstrap (auth, snapshot) │
                              │  /api/:collection[/:id] (CRUD) │
                              │  else → ASSETS (SPA dist/)     │
                              └──────────────┬─────────────────┘
                                             │
                                             ▼
                              ┌────────────────────────────────┐
                              │  D1 (pgwalo-db)                │
                              │  org-scoped rows, permissions  │
                              └────────────────────────────────┘
```

### App boot sequence

1. `main.tsx` → `App.tsx` → `AppProvider` (`AppContext.tsx`)
2. If `VITE_API_BASE_URL` is set → `loadProductionSnapshot(role)` → `GET /api/bootstrap`
3. Else → hydrate from `mockData.ts` (demo properties, residents, etc.)
4. `App.tsx` routes by `role` + `currentTab`: public views vs role dashboards
5. Auth: `AuthModal` → `auth.ts` → `POST /api/auth/login` → JWT in localStorage

### Owner listing flow (9 steps)

`OwnerListingWizard.tsx` → Steps 1–9 in `src/components/owner/listing-steps/`:
1. Property details → 2. Rooms/pricing → 3. Amenities → 4. Photos → 5. Rules → 6. Owner details → 7. Verification → 8. Preview → 9. Publish

### Domain / business logic

`src/domain/productionWorkflow.ts` — bed status, invoices, payments, checkout, permissions, audit entries. Used by `AppContext` for client-side mutations; Worker enforces RBAC on API.

---

## Directory Map

```
src/
  App.tsx                 # Tab/role routing shell
  context/AppContext.tsx  # Global state (~2800 lines)
  types.ts                # All domain types
  mockData.ts             # Demo seed data
  domain/productionWorkflow.ts
  services/
    productionApi.ts      # API client (bootstrap, CRUD, search)
    auth.ts               # JWT login/register
  components/
    public/               # Landing, Search, PGDetailModal
    owner/                # Dashboard + listing wizard
    resident|staff|warden|accountant|admin/
    auth/                 # AuthModal, ProfileCompletion
    common/               # Navbar, Footer, PWA, ErrorBoundary
    features/             # Modals (agreement, tour, AI onboarding)
  worker/
    index.ts              # Request router
    handlers/             # auth, bootstrap, collection, health, media
    middleware/auth.ts    # JWT + permissions
    utils/                # cors, db, jwt

database/
  schema.sql              # D1 schema (source of truth)
  migrate-data.ts         # Mock → SQL migration generator

wrangler.toml             # Worker + D1 + assets + routes
vite.config.ts            # PWA, API proxy to :8787 in dev
```

---

## API Surface (Worker)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | No | Health check |
| `POST /api/auth/login` | No | JWT issue (role from body; D1 validation TODO) |
| `POST /api/auth/register` | No | Register (stub) |
| `GET/POST /api/bootstrap` | JWT | Full snapshot load/save by role permissions |
| `GET/POST/PUT/DELETE /api/:collection[/:id]` | JWT | CRUD on D1 tables |
| `GET/POST /api/media/*` | No | R2 upload/download (when bound) |
| `/*` (non-API) | No | SPA from `dist/` |

Headers: `Authorization: Bearer <jwt>`, `x-user-role`, `x-organization-id`, `x-user-id`

---

## Local Development

```bash
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8787 for API mode
npm run dev                   # Vite :3000, proxies /api → :8787
npm run dev:worker              # Wrangler dev :8787 (D1 local)
npm run local:db:init           # Seed local D1 from schema + migrate-data
```

**Demo mode:** leave `VITE_API_BASE_URL` empty — app uses `mockData` only.

---

## Deployment (Wrangler)

```bash
npm run build                 # dist/ + default API URL https://api.pgwalo.com
wrangler secret put JWT_SECRET
npm run deploy                # build + wrangler deploy
npm run d1:migrate            # apply schema.sql to remote D1
```

**wrangler.toml highlights:**
- `main = src/worker/index.ts`
- `[assets] directory = ./dist` — SPA + `run_worker_first = true` (API before static)
- Routes: `pgwalo.com`, `www.pgwalo.com`, `api.pgwalo.com`
- D1 binding `DB` → `pgwalo-db`
- R2 `MEDIA` — uncomment when bucket exists

---

## Demo credentials (production D1)

- `owner@pgwalo.com` / `PGWalo@2026`
- `admin@pgwalo.com` / `PGWalo@2026`

## Client/server data contract (do not regress)

* `GET /api/admin/{users,bookings,payments}` answers
  `{ users|bookings|payments: [...], page, pageSize, total, totalPages }`.
  `services/adminApi.ts` reads the **named** key — reading `items` blanks every
  admin list (Users, PG Owners, Tenants, Bookings, Payments). Guarded by
  `npm run test:e2e`.
* `GET /api/bootstrap` returns snake_case for most tables but runs
  `ROW_MAPPERS` for the ones the client consumes, and `sanitizeRow()` strips
  `password_hash` / `aadhaar_hash` before anything leaves the Worker.
* Bootstrap row scoping: platform admin = all rows; everyone else = their
  `organization_id`; **residents are additionally requester-scoped** (own
  resident row, own ledger via `resident_id`, own tickets via `requester_id`).
* The resident role deliberately does **not** hold `resident.view`; its snapshot
  is served by the requester-scoped bootstrap, which keeps the org-wide
  collection routes closed.

## Known gaps

1. **R2** — enable in Cloudflare Dashboard, create bucket, uncomment `wrangler.toml` binding

---

## Admin Console (Super Admin) data flow

`AdminDashboard.tsx` renders live DB rows in production (JWT + `isProductionApiEnabled()`); local state in demo mode.

| Concern | Path |
|---------|------|
| Filtered queries (search/date/PG/status/pagination) | `services/adminApi.ts` → `/api/admin/{users,bookings,payments,support-tickets}` → `handlers/admin.ts` → D1 |
| Durable support tickets | `support_tickets` table (`database/admin-console-migration.sql` → `npm run d1:admin`); replies stored as JSON in `messages` |
| Mutations | `AppContext` → `patchAdminUserStatus/patchAdminProperty/patchAdminTicket/postAdminTicketReply` (each returns ok; failures logged, not swallowed) |
| Audit trail | every admin mutation writes `audit_logs` server-side |
| Tests | `npm run test:admin` — RBAC 403/401, allow-list 400s, PATCH→D1→audit flow (in-memory D1 stub) |

---
2. **AppContext** — still syncs owner snapshots; bootstrap is role-scoped with row limits
3. **TypeScript** — pre-existing errors in mockData/types (non-blocking for Vite build)

---

## Scripts Reference

| Script | Action |
|--------|--------|
| `dev` | Vite frontend |
| `dev:worker` | Local Worker + D1 |
| `build` | Production frontend → `dist/` |
| `deploy` | `build` + `wrangler deploy` |
| `d1:migrate` | Remote schema apply |
| `d1:admin` | Remote `admin-console-migration.sql` (support_tickets) |
| `d1:listings` | Remote `listings.sql` (properties owner columns) |
| `d1:staff` | Remote `tenant-staff.sql` (staff owner columns) |
| `db:migrate` | Idempotent local migration run (`database/apply-migrations.sh`) |
| `db:migrate:remote` | Idempotent remote migration run |
| `test:admin` | Admin console unit tests (in-memory D1 stub) |
| `test:e2e` | Full-flow regression suite against a running Worker (`E2E_BASE`) |
| `local:db:init` | Local D1 seed |
| `test:worker` | Worker smoke test — **stale**, relies on the disabled `x-user-role` bypass |

---

## Approval Checklist (architecture)

- [x] Single deploy path: Worker + assets (no separate Pages Functions)
- [x] Demo vs production toggle via `VITE_API_BASE_URL` only
- [x] D1 as sole persistence (Supabase/Express removed)
- [x] JWT auth hardened against D1 `users` table
- [x] Align `DEFAULT_ORGANIZATION_ID` across env, workflow, wrangler
- [x] Enable R2 when media uploads go live
- [x] Super admin console (superadmin-flow.md) — deployed 2026-09-17
- [ ] Move `SUPERADMIN_*` from `[vars]` to Wrangler secrets
- [ ] JWT revocation list (stateless 24h tokens currently cannot be revoked server-side)
