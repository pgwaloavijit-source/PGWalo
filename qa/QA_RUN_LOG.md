# PGWalo QA Run Log

| Time | Command | Result | Notes |
|---|---|---|---|
| 2026-09-19 | repository discovery | PASS | Project overview missing; package/config/schema/scripts inspected |
| 2026-09-19 | `npm run lint` | FAIL | 24 TypeScript errors |
| 2026-09-19 | `npm run build` | PASS | Vite production build succeeded |
| 2026-09-19 | `npm run test:domain` | PASS | 40/40 |
| 2026-09-19 | `npm run test:admin` | PASS | 20/20; test stub logs missing-table notification error |
| 2026-09-19 | `npm run test:payments` | BLOCKED | 30/32; email outbox assertions require `QA_ADMIN_TOKEN` |
| 2026-09-19 | `npm run test:worker` | FAIL | Stale unauthenticated/header and text-upload cases |
| 2026-09-19 | `npm run test:e2e` | BLOCKED/FAIL | Core flow passes; admin auth unavailable and suite crashes on null token |
| 2026-09-19 | secret scan + QA harness fix | PASS | Removed hardcoded admin credential from payment and E2E scripts |
| 2026-09-19 | `npm run lint` | PASS | TypeScript contract fixes verified |
| 2026-09-19 | `npm run build:worker` | PASS | Worker typecheck verified |
| 2026-09-19 | live HTTP smoke | PASS/PARTIAL | `/api/health`, `/api/listings`, `/api/payments/plans` 200; protected routes 401 |
| 2026-09-19 | `npx wrangler whoami` / deploy auth | BLOCKED | Cloudflare API 9109 invalid access token |
