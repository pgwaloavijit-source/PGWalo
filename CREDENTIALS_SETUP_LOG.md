# PGWalo — Credentials Setup Log

> Feed each secret with:  `npx wrangler secret put <NAME>`  (run from the project root, paste the value when prompted).
> Secrets survive every deploy and take effect immediately. **Never put real secrets in `wrangler.toml` or any committed file.**
>
> Status legend: ⬜ not provided yet · ✅ installed · 🚫 not needed

Last updated: 2026-09-19

---

## 1. Cashfree — payments (token, rent, deposit, listing plans) — **the chosen gateway**

The app now speaks Cashfree (Payment Links API + webhook). Nothing to change in code — only feed these:

| # | Secret name | Where to get it | Status |
|---|---|---|---|
| 1 | `CASHFREE_APP_ID` | Cashfree Merchant Dashboard → **Developers → API Keys** → copy **App ID** (test: starts `TEST`, live: starts production id) | ⬜ |
| 2 | `CASHFREE_SECRET_KEY` | Same page → **Secret Key** (shown once; regenerate if lost) | ⬜ |
| 3 | `CASHFREE_WEBHOOK_SECRET` | **You invent this** — any strong random string (32+ chars). Paste the *same* value into Cashfree Dashboard → **Settings → Webhooks → Add Webhook** | ⬜ |

**Webhook to register in the Cashfree dashboard:**
- URL: `https://api.pgwalo.com/api/market/webhooks/cashfree`
- Events: `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_USER_DROPPED`
- Secret: the same value you stored as `CASHFREE_WEBHOOK_SECRET`

**Environment note:** test (sandbox) keys work out of the box — the code auto-detects the `TEST` prefix in the App ID and calls `api.cashfree.com` sandbox. Live keys need Cashfree merchant activation (PAN, bank, business KYC).

**Feed commands (run one by one):**
```bash
npx wrangler secret put CASHFREE_APP_ID
npx wrangler secret put CASHFREE_SECRET_KEY
npx wrangler secret put CASHFREE_WEBHOOK_SECRET
```

**Verify after feeding:** create a token request in the CRM → you get a real Cashfree payment link (UPI/cards/netbanking hosted page). Pay with sandbox UPI (`success@razorpay`-style test VPA per Cashfree docs) → the webhook flips the intent to `paid` and confirms the bed hold automatically. Check **Developers → Webhooks → Logs** in the Cashfree dashboard for delivery attempts.

> Razorpay is no longer used. If you had any `RAZORPAY_*` secrets set, remove them:
> `npx wrangler secret delete RAZORPAY_KEY_ID` (and `_SECRET`, `_WEBHOOK_SECRET`).

---

## 2. WhatsApp BSP — templates & automation (deep links already work without it)

The `domain/messaging.ts` adapter is ready; today it falls back to wa.me deep links (no fabricated delivery). To automate sending:

1. Sign up at **business.facebook.com** → create an app → add the **WhatsApp** product (free, official Cloud API).
2. Note the **Phone Number ID** (WhatsApp → API Setup page).
3. Create a **System User** (Business Settings → Users) with the WhatsApp business asset → generate a **permanent access token**.
4. Submit 2–3 message templates for approval (rent reminder, payment receipt, visit confirmation) in the WhatsApp Manager.

To hand me when ready:
| # | Secret name | Value | Status |
|---|---|---|---|
| 4 | `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID | ⬜ |
| 5 | `WHATSAPP_ACCESS_TOKEN` | permanent system-user token | ⬜ |
| 6 | `WHATSAPP_TEMPLATE_LANG` | e.g. `en` (default `en` if omitted) | ⬜ |

```bash
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_TEMPLATE_LANG
```

Then ask me to wire the `sendViaApi` side of the adapter (30 min of work once the secrets exist).

---

## 3. KYC provider — boundary ready, not wired

State machine + masked-identifier storage are live in code; no provider calls yet. Pick one: **Signzy / IDfy / HyperVerge**. Get API key + secret. Naming on the day: `KYC_PROVIDER`, `KYC_API_KEY`, `KYC_API_SECRET`. Status: ⬜

## 4. R2 media storage — ✅ nothing to feed

Bucket `pgwalo-media` is created, bound in `wrangler.toml` and deployed. Photo uploads for inspections/compliance are feature-flagged off until you want them enabled — say the word and I flip the flag (no credentials needed).

## 5. Superadmin credentials — ⚠️ recommended hardening

Currently `SUPERADMIN_PHONE / SUPERADMIN_PIN / SUPERADMIN_PASSWORD` sit as plaintext `[vars]` in `wrangler.toml` and print in deploy logs. To fix:

```bash
npx wrangler secret put SUPERADMIN_PASSWORD
npx wrangler secret put SUPERADMIN_PIN
```
Then delete the three `SUPERADMIN_*` lines from `wrangler.toml` (secrets override vars anyway). For local dev, create a `.dev.vars` file (already gitignored) with the same names instead.

---

## Quick reference — everything in one copy-paste block

```bash
# Payments (Cashfree) — required for online token/rent/deposit/listing payments
npx wrangler secret put CASHFREE_APP_ID
npx wrangler secret put CASHFREE_SECRET_KEY
npx wrangler secret put CASHFREE_WEBHOOK_SECRET

# WhatsApp automation — optional (deep links work without)
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_TEMPLATE_LANG

# Hardening — move superadmin creds out of wrangler.toml
npx wrangler secret put SUPERADMIN_PASSWORD
npx wrangler secret put SUPERADMIN_PIN

# Cleanup — remove the retired gateway
npx wrangler secret delete RAZORPAY_KEY_ID
npx wrangler secret delete RAZORPAY_KEY_SECRET
npx wrangler secret delete RAZORPAY_WEBHOOK_SECRET
```

**Webhook checklist (Cashfree dashboard):**
- [ ] Webhook URL: `https://api.pgwalo.com/api/market/webhooks/cashfree`
- [ ] Events: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_USER_DROPPED
- [ ] Secret matches `CASHFREE_WEBHOOK_SECRET`
- [ ] Test payment shows in Developers → Webhooks → Logs
