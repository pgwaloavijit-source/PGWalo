# PGWalo — Agent Codebase Reference

> Single source of truth for architecture, flow, and deployment. Last updated: 2026-09-16.

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
| Media | R2 (commented out in `wrangler.toml`; handler exists) |
| Auth | JWT via Worker (`/api/auth/*`), stored in `localStorage` |
| PWA | `vite-plugin-pwa` (Workbox, offline shell) |
| Deploy | `wrangler deploy` — Worker serves `/api/*` + static `dist/` via `[assets]` |

**Not used in code (can remove later):** `@google/genai`, legacy Express `server.ts`, Supabase, Pages Functions proxy.

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

## Known Gaps / Inconsistencies

1. **DEFAULT_ORGANIZATION_ID** — `wrangler.toml` uses `org-demo-pgwalo`; `productionWorkflow.ts` uses `org-demo-blue-haven`
2. **Auth** — login issues JWT without D1 password check (stub)
3. **Dual data paths** — `AppContext` still heavy on client mock; production sync via bootstrap snapshot
4. **R2** — handler present, binding commented out
5. **Rebrand residue** — some "PGNest" strings in schema comments / scripts (`pgnest-db` in test script)

---

## Scripts Reference

| Script | Action |
|--------|--------|
| `dev` | Vite frontend |
| `dev:worker` | Local Worker + D1 |
| `build` | Production frontend → `dist/` |
| `deploy` | `build` + `wrangler deploy` |
| `d1:migrate` | Remote schema apply |
| `local:db:init` | Local D1 seed |
| `test:worker` | Worker smoke test |

---

## Approval Checklist (architecture)

- [ ] Single deploy path: Worker + assets (no separate Pages Functions)
- [ ] Demo vs production toggle via `VITE_API_BASE_URL` only
- [ ] D1 as sole persistence (Supabase/Express removed)
- [ ] JWT auth hardened against D1 `users` table
- [ ] Align `DEFAULT_ORGANIZATION_ID` across env, workflow, wrangler
- [ ] Enable R2 when media uploads go live
