# Local Role QA - 2026-09-19

## Environment

- Worker: Wrangler local mode on http://127.0.0.1:8791
- D1/R2/KV: local simulated bindings
- JWT: local-only --var JWT_SECRET override
- Test command: E2E_BASE=http://127.0.0.1:8791 npm run test:e2e

## Result

**126/126 passed.**

The run covered superadmin login and admin mutations, owner signup/login/property publishing, tenant alias and resident login, booking handoff, staff creation/login/bootstrap, bed allotment, stay/agreement/notice interchange, maintenance/SLA/warden flows, resident scoping, cross-owner denial, media upload, SSE notifications, email preferences/outbox, and admin response contracts.

## Fix made from local QA

Local setup was missing JWT_SECRET, causing authenticated routes to fail closed with JWT not configured on a fresh Worker. The dev-vars template now includes it, and both setup scripts now use the configured pgwalo-db name instead of stale pgnest-db references.
