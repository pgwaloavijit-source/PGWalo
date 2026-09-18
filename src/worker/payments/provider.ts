import type { Env } from '../types';

/**
 * Payment provider adapter.
 *
 * Mirrors the email engine's design: one interface, the sender resolved at call
 * time from the environment, and a `none` provider that simulates when no
 * credentials exist — so the whole pricing → payment → badge → invoice flow is
 * exercised in development and staging without touching a real gateway.
 *
 * Razorpay is the live transport (UPI, cards, netbanking — India-first):
 *
 *   npx wrangler secret put RAZORPAY_KEY_ID
 *   npx wrangler secret put RAZORPAY_KEY_SECRET
 *   npx wrangler secret put RAZORPAY_WEBHOOK_SECRET   # optional but recommended
 *
 * A "payment link" in this product is always OUR OWN resumable URL
 * (`/pay/<orderId>`), never a gateway-hosted page. That means the same link can
 * be emailed, keep working after a failed attempt, and be re-opened months
 * later — and it can be produced in simulation mode too.
 */

export type PaymentProvider = 'razorpay' | 'none';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export function paymentsConfigured(env: Env): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** The transport the very next order would use. */
export function activePaymentProvider(env: Env): PaymentProvider {
  return paymentsConfigured(env) ? 'razorpay' : 'none';
}

function authHeader(env: Env): string {
  const raw = `${env.RAZORPAY_KEY_ID || ''}:${env.RAZORPAY_KEY_SECRET || ''}`;
  return `Basic ${btoa(raw)}`;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(sig);
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
    const response = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(env),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: input.localOrderId.slice(0, 40),
        notes: input.notes,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      error?: { description?: string };
    };
    if (!response.ok || !payload.id) {
      return {
        ok: false,
        provider,
        error: payload?.error?.description || `gateway order failed (HTTP ${response.status})`,
      };
    }
    return {
      ok: true,
      provider,
      orderId: payload.id,
      amountPaise: payload.amount || amountPaise,
      keyId: env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : 'gateway unreachable' };
  }
}

/** Razorpay checkout callback: HMAC(order_id|payment_id, key_secret). */
export async function verifyCheckoutSignature(
  env: Env,
  input: { orderId: string; paymentId: string; signature: string }
): Promise<boolean> {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${input.orderId}|${input.paymentId}`);
  return safeEqual(expected, String(input.signature || ''));
}

/** Webhook: HMAC(rawBody, webhook_secret) against x-razorpay-signature. */
export async function verifyWebhookSignature(env: Env, rawBody: string, signature: string): Promise<boolean> {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return safeEqual(expected, String(signature || ''));
}

/** What the owner-facing pricing UI should show about payment readiness. */
export function paymentTransportSummary(env: Env) {
  return {
    provider: activePaymentProvider(env),
    configured: paymentsConfigured(env),
    keyId: env.RAZORPAY_KEY_ID || null,
    simulated: !paymentsConfigured(env),
    webhookSecretSet: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  };
}
