import type { Env } from '../types';

/**
 * Payment provider adapter.
 *
 * Mirrors the email engine's design: one interface, the sender resolved at call
 * time from the environment, and a `none` provider that simulates when no
 * credentials exist — so the whole pricing → payment → badge → invoice flow is
 * exercised in development and staging without touching a real gateway.
 *
 * Cashfree is the live transport (UPI-first, cards, netbanking — India-first):
 *
 *   npx wrangler secret put CASHFREE_APP_ID
 *   npx wrangler secret put CASHFREE_SECRET_KEY
 *   npx wrangler secret put CASHFREE_WEBHOOK_SECRET   # required for webhooks
 *
 * A TEST-prefixed app id targets the Cashfree sandbox automatically.
 *
 * A "payment link" in this product is always OUR OWN resumable URL
 * (`/pay/<orderId>`), never a gateway-hosted page — except for the market
 * intents (token/rent/deposit), which open Cashfree's hosted page directly
 * from the generated link. Both confirmations arrive via verified webhook.
 */

export type PaymentProvider = 'cashfree' | 'none';

const CASHFREE_API = 'https://api.cashfree.com';
/** Latest stable API version header required on every Cashfree call. */
const CASHFREE_API_VERSION = '2023-08-01';

export function paymentsConfigured(env: Env): boolean {
  return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}

/** The transport the very next order would use. */
export function activePaymentProvider(env: Env): PaymentProvider {
  return paymentsConfigured(env) ? 'cashfree' : 'none';
}

/** Sandbox when the app id carries the TEST prefix, production otherwise. */
export function cashfreeBase(env: Env): string {
  return String(env.CASHFREE_APP_ID || '').toUpperCase().startsWith('TEST')
    ? 'https://sandbox.cashfree.com'
    : CASHFREE_API;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** Constant-time-ish compare, so a wrong signature can't be guessed byte-by-byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface CreatedOrder {
  ok: boolean;
  provider: PaymentProvider;
  orderId?: string;
  /** Hosted payment page when the gateway provides one (Cashfree link/orders). */
  hostedPaymentLink?: string;
  /** Amount actually charged, in paise, as the gateway sees it. */
  amountPaise?: number;
  keyId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Create a gateway order for `amountInr`. In simulation mode no order is
 * created remotely — the caller still gets an order id (its own), because the
 * order row lives in our database either way.
 */
export async function createGatewayOrder(
  env: Env,
  input: { localOrderId: string; amountInr: number; notes: Record<string, string> }
): Promise<CreatedOrder> {
  const provider = activePaymentProvider(env);
  const amountPaise = Math.round(Number(input.amountInr) * 100);

  if (provider === 'none') {
    return { ok: true, provider, orderId: `sim_${input.localOrderId}`, amountPaise, simulated: true };
  }

  try {
    const response = await fetch(`${cashfreeBase(env)}/pg/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': env.CASHFREE_APP_ID || '',
        'x-client-secret': env.CASHFREE_SECRET_KEY || '',
        'x-api-version': CASHFREE_API_VERSION,
        'x-idempotency-key': input.localOrderId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Alphanumeric + underscore/hyphen only, 3-45 chars, unique per order.
        order_id: input.localOrderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 45),
        order_amount: Math.round((amountPaise / 100) * 100) / 100,
        order_currency: 'INR',
        customer_details: {
          // Required by Cashfree; safe placeholder when unknown.
          customer_id: input.notes.ownerUserId || 'pgwalo-customer',
          customer_phone: '9999999999',
        },
        order_meta: { return_url: `https://pgwalo.com/pay/${input.localOrderId}?cf={order_id}` },
        order_note: `PGWalo order ${input.localOrderId}`,
        order_tags: input.notes,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      order_id?: string;
      order_amount?: number;
      payment_link?: string;
      type?: string;
      message?: string;
    };
    if (!response.ok || !payload.order_id) {
      return {
        ok: false,
        provider,
        error: payload?.message || `gateway order failed (HTTP ${response.status})`,
      };
    }
    return {
      ok: true,
      provider,
      orderId: payload.order_id,
      hostedPaymentLink: payload.payment_link || undefined,
      amountPaise: Math.round((payload.order_amount || amountPaise / 100) * 100),
    };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : 'gateway unreachable' };
  }
}

/**
 * Webhook verification: HMAC-SHA256 base64 of the raw body against the
 * webhook secret, compared with the `x-webhook-signature` header
 * (Cashfree contract). A body that does not verify can never change an order.
 */
export async function verifyWebhookSignature(env: Env, rawBody: string, signature: string): Promise<boolean> {
  const secret = env.CASHFREE_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = await hmacSha256Base64(secret, rawBody);
  return safeEqual(expected, String(signature || ''));
}

/** What the owner-facing pricing UI should show about payment readiness. */
export function paymentTransportSummary(env: Env) {
  return {
    provider: activePaymentProvider(env),
    configured: paymentsConfigured(env),
    keyId: env.CASHFREE_APP_ID || null,
    simulated: !paymentsConfigured(env),
    webhookSecretSet: Boolean(env.CASHFREE_WEBHOOK_SECRET),
  };
}
