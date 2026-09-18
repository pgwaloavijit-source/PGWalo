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
  provider: 'razorpay' | 'none';
  /** The gateway's own order id — required by Razorpay checkout. */
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
  provider: 'razorpay' | 'none';
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
  payload: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }
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

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}
