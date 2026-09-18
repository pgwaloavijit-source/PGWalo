/**
 * The owner's payment link.
 *
 * On a failed payment the owner is emailed `https://pgwalo.com/pay/<orderId>`.
 * That URL is ours, not the gateway's, so it keeps working for a day, resumes
 * the exact order (same plan, same amount) and needs no gateway session.
 */

const PENDING_KEY = 'pgwalo_pending_pay_order';

/**
 * Read `/pay/<orderId>` (or `?pay=<orderId>`), stash it and clean the address
 * bar so a refresh does not re-trigger. Called once, at boot.
 */
export function capturePayTargetFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('pay');
    const fromPath = url.pathname.match(/^\/pay\/([^/]+)\/?$/)?.[1] || null;
    const id = (fromQuery || fromPath || '').trim();
    if (!id) return null;
    sessionStorage.setItem(PENDING_KEY, id);
    window.history.replaceState({}, '', '/');
    return id;
  } catch {
    return null;
  }
}

/**
 * The order id waiting to be paid, consumed on first use so the checkout opens
 * once — after a sign-in it survives the modal, not a reload loop.
 */
export function takePendingPayOrder(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    if (id) sessionStorage.removeItem(PENDING_KEY);
    return id || null;
  } catch {
    return null;
  }
}

export function peekPendingPayOrder(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
