# PGWalo QA Findings

## BUG-001 — Missing project overview documentation

Severity: P2  
Status: Fixed / Retest Passed  
Test ID: OPS-001  
Area: Documentation / release operations

### Expected
The repository should contain the referenced `PROJECT-OVERVIEW.md` used as the initial QA context.

### Actual
The file is absent from `E:\PGWalo\PGWalo`.

### Reproduction
1. Run `Get-Content -Raw PROJECT-OVERVIEW.md` from the repository root.
2. Observe `PathNotFound`.

### Evidence
- command: `Get-Content -Raw PROJECT-OVERVIEW.md`
- response: file not found

### Root Cause
Documentation is missing from the checkout or IDE workspace mapping is stale.

### Fix
Not changed; requires restoring the document or confirming it is intentionally external.

### Regression Risk
Future QA/release work may miss architecture assumptions.

### Retest
Blocked until the document is restored or its absence is accepted.

## BUG-002 — Plaintext super-admin credential risk requires verification

Severity: P2  
Status: Retest Passed / Rotation Required  
Test ID: SEC-001  
Area: Secrets / deployment configuration

### Expected
Production credentials must be stored only as runtime secrets.

### Actual
Current source/config scans found no literal production credential values. Historical reports document that credentials were previously exposed, so rotation remains required.

### Evidence
- source: `REGRESSION-REPORT.md`, P2-6

### Root Cause
Historical deployment configuration exposed credentials before the prior fix.

### Fix
Current code keeps credentials Worker-side; the payment test no longer contains a hardcoded admin password.

### Regression Risk
Credential compromise or administrative takeover if still present.

### Retest
Static scan passed on 2026-09-19; rotate production credentials before launch.

## BUG-003 — Typecheck fails

Severity: P1  
Status: Open  
Test ID: OPS-001  
Area: Build / type safety

### Expected
`npm run lint` and Worker typecheck should pass before release.

### Actual
`npm run lint` reports 24 TypeScript errors across UI models, `AppContext`, Worker globals/types, and JWT Web Crypto typing.

### Evidence
- command: `npm run lint`
- result: non-zero exit; see command output for file/line diagnostics

### Fix
Unified the duplicate invoice model, aligned staff/stay/snapshot fixtures, added typed response JSON handling, corrected Worker type references/JWT encoding types, and fixed invalid demo unions.

### Retest
`npm run lint` and `npm run build:worker` both pass on 2026-09-19.

## BUG-004 — Full E2E admin phase cannot complete

Severity: P1  
Status: Open  
Test ID: ADMIN-001  
Area: Admin authentication / E2E harness

### Expected
The E2E suite should authenticate the super-admin and complete admin list/bootstrap/mutation assertions.

### Actual
Super-admin login has no token in the local environment; admin endpoints return errors/empty data and the suite later crashes reading `null.token`.

### Evidence
- command: `npm run test:e2e`
- result: core owner/resident/staff flows pass; admin checks fail and suite terminates with `Cannot read properties of null (reading 'token')`

### Fix
Provide dedicated QA credentials/secrets and make the harness fail gracefully when setup is unavailable.

## BUG-005 — Payment email assertions are environment-blocked

Severity: P2  
Status: Blocked  
Test ID: PAY-001  
Area: Email outbox integration test

### Expected
Payment failure/success emails should be observable in the durable outbox.

### Actual
The payment suite reports 30/32 because no `QA_ADMIN_TOKEN` was supplied for reading the outbox; no product email behavior was conclusively disproven.

### Evidence
- command: `npm run test:payments`
- result: 30/32; two outbox assertions unavailable

### Fix
Run with a short-lived `QA_ADMIN_TOKEN` against a Worker with the email migration applied.

## BUG-006 — Cloudflare deploy authorization is invalid

Severity: P1  
Status: Blocked  
Test ID: DEPLOY-001  
Area: Deployment / live verification

### Expected
The verified local build should deploy and be re-tested on `https://pgwalo.com`.

### Actual
`npx wrangler whoami` and deployment attempts return Cloudflare API error 9109: Invalid access token.

### Fix
Attempted `npx wrangler login`; it requires completing the OAuth browser flow, but no controllable browser session is available in this environment.

### Retest
Pending renewed Cloudflare authorization.
