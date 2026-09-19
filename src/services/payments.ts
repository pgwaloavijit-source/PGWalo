import { apiUrl } from './apiBase';
import { getAuthToken } from './productionApi';
import { ListingPlanId, ListingPlan } from '../domain/pricing';

/**
 * Owner publishing payments (client side).
 *
 * The order always lives on the server: the browser asks for one, the worker
 * prices it from the plan catalogue and talks to the gateway. Nothing the
 * browser sends can influence the amount.
 */

export interface ListingOrder {
  id: string;
  propertyId: string;
  propertyName?: string;
  planId: ListingPlanId;
  planName?: string;
  amount: number;
  currency: string;
  amountPaise?: number;
  status: 'created' | 'paid' | 'failed' | 'cancelled';
  provider: 'cashfree' | 'none';
  /** The gateway's own order id — used for server-side status polling. */
  providerOrderId?: string | null;
  keyId?: string | null;
  paymentLink?: string;
  simulated?: boolean;
  invoiceNumber?: string;
  failureReason?: string;
  paidAt?: string;
  expiresAt?: string;
}

export interface PaymentTransport {
  provider: 'cashfree' | 'none';
  configured: boolean;
  simulated: boolean;
  webhookSecretSet?: boolean;
}

const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(apiUrl(path), { ...init, headers: { ...authHeaders(), ...(init?.headers || {}) } });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) return { ok: false, error: data?.error || `Request failed (${response.status})` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}

export async function fetchListingPlans(): Promise<{ plans: ListingPlan[]; transport: PaymentTransport } | null> {
  const result = await request<{ plans: ListingPlan[]; transport: PaymentTransport }>('/api/payments/plans');
  return result.ok && result.data ? result.data : null;
}

export async function createListingOrder(propertyId: string, planId: ListingPlanId) {
  return request<{ order: ListingOrder }>('/api/payments/orders', {
    method: 'POST',
    body: JSON.stringify({ propertyId, planId }),
  });
}

export async function fetchListingOrder(orderId: string) {
  return request<{ order: ListingOrder }>(`/api/payments/orders/${encodeURIComponent(orderId)}`);
}

export async function verifyListingPayment(
  orderId: string,
  payload: { cf_payment_id?: string } = {}
) {
  return request<{ order: ListingOrder; alreadyPaid?: boolean }>(
    `/api/payments/orders/${encodeURIComponent(orderId)}/verify`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export async function failListingPayment(orderId: string, reason: string) {
  return request<{ order: ListingOrder }>(`/api/payments/orders/${encodeURIComponent(orderId)}/fail`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Test-mode fulfilment. The worker refuses this the moment live gateway keys
 * exist, so it can never mark a real payment paid.
 */
export async function simulateListingPayment(orderId: string, outcome: 'success' | 'failure') {
  return request<{ order: ListingOrder }>(`/api/payments/orders/${encodeURIComponent(orderId)}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ outcome }),
  });
}

/**
 * Cashfree confirmation: poll the server-side verify endpoint, which checks the
 * order's payment status at the gateway. No client SDK, no client signature.
 */
export function pollPaymentConfirmation(orderId: string, timeoutMs = 90_000): Promise<{ paid: boolean; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = async () => {
      const res = await verifyListingPayment(orderId);
      if (res.ok && res.data?.order?.status === 'paid') {
        resolve({ paid: true });
        return;
      }
      if (Date.now() >= deadline) {
        resolve({ paid: false, error: res.error || 'Payment confirmation timed out — if you were charged, the webhook will complete it shortly.' });
        return;
      }
      window.setTimeout(tick, 4000);
    };
    void tick();
  });
}
