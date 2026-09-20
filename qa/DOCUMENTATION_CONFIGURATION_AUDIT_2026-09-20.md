# PGWalo Documentation and Configuration Audit

Date: 2026-09-20  
Live target: `https://pgwalo.com`  
Current deployment: `38f58de7-edff-4726-af05-d2bc2b48f49d`

## Evidence checked

- All repository Markdown files, excluding generated `.wrangler` notes.
- `wrangler.toml`, `.env.example`, `.dev.vars.example`, package scripts, Worker handlers, and migrations.
- Cloudflare secret inventory and remote D1 table inventory.
- Live HTTP smoke checks and local type/build/provider tests.

## Verified deployed bindings

| Binding | Status | Evidence |
|---|---|---|
| Worker routes and SPA assets | Ready | `pgwalo.com`, `www`, and `api` routes; site returns 200 |
| D1 `DB` | Ready | `pgwalo-db`; market and P1 tables exist remotely |
| R2 `MEDIA` | Ready | `pgwalo-media` binding is deployed |
| KV `CACHE` | Ready | `CACHE` binding is deployed |
| Workers AI `AI` | Bound | Binding is deployed; feature usage is code-path dependent |
| Cron | Ready | SLA sweep runs every 15 minutes |
| Observability | Enabled | Wrangler configuration |

Remote D1 contains the market tables documented in `MARKET_READY_IMPLEMENTATION.md`, including visits, reservations, payment intents, expenses, inspections, compliance, KYC, reviews, imports, reminders, guardian access, institutional leads, meal operations, and email outbox.

## Verified secrets

Present in Cloudflare: `JWT_SECRET`, `RESEND_API_KEY`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_PHONE`, and `SUPERADMIN_PIN`.

`npm run test:email` passes 25/25. Email delivery through Resend is still operationally unverified until an authenticated email probe confirms the sender domain is verified. Cloudflare Email Sending is not bound because `[[send_email]]` remains commented out.

## Configuration still required

### Required before accepting real online payments

Provide and configure:

```text
CASHFREE_APP_ID
CASHFREE_SECRET_KEY
CASHFREE_WEBHOOK_SECRET
```

Register `https://api.pgwalo.com/api/market/webhooks/cashfree` in Cashfree and verify a sandbox payment, webhook signature, idempotency, and fulfilment path.

### Optional operational integrations

- WhatsApp API: BSP account, approved templates, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_TEMPLATE_LANG`. Deep links already work; provider delivery is not yet the default.
- KYC: select a provider and implement/configure its API adapter. Current KYC support is state-only with masked references and consent timestamps.
- e-Sign/e-stamp: provider account, API credentials, webhook contract, and approved legal agreement text. Agreement state storage exists; provider signing is not live.
- Email: either verify the existing Resend domain and run the authenticated probe, or enable Cloudflare Email Routing/Sending, Workers Paid, the `EMAIL` binding, and deploy.
- Google Maps: optional `GOOGLE_MAPS_SERVER_KEY`; geo search has a Photon fallback without it.

## Functionality status

- Local role/data interchange: 126/126 passed on 2026-09-19.
- Domain invariants: 40/40 passed.
- Admin contract suite: 20/20 passed.
- Email provider suite: 25/25 passed.
- Production build, Worker typecheck, live health, public stats, listings, and payment plans: passed.
- Authenticated production role matrix, real payment sandbox, cross-tenant runtime attacks, load/Web Vitals, accessibility, backup restore, and provider delivery remain unverified because they require dedicated QA accounts or external provider access.

## Documentation that is historical or needs correction

- `AGENT_CODEBASE.md` still says R2 is unbound and superadmin credentials are in `[vars]`; both are now false.
- `docs/payments.md` still describes Razorpay; Cashfree is the current gateway and `CREDENTIALS_SETUP_LOG.md` is authoritative.
- `qa/QA_MASTER_STATUS.md`, `qa/QA_FINDINGS.md`, and `qa/APPLICATION_LAUNCH_READINESS_REPORT.md` record the earlier invalid Wrangler-token phase. They remain historical evidence, not current release status.
- `REGRESSION-REPORT.md` contains historical credential/email findings; use this audit plus the current secret inventory for present state.
- `PROJECT-OVERVIEW.md` is still absent from the checkout.
- `01_GLM_5_3_FLASH_MARKET_READY_BUILD_PROMPT.md` and `superadmin-flow.md` are requirements/instructions, not proof that every external integration is enabled.

## Release conclusion

The application and documented market-ready database/API surface are deployed. It is suitable for controlled onboarding with manual payment reconciliation and deep-link messaging. It is not yet fully provider-live for Cashfree payments, WhatsApp automation, KYC, e-sign, or verified transactional email delivery. Authenticated live QA with dedicated test identities is the remaining release gate.
