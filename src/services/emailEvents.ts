import { apiUrl as sharedApiUrl } from './apiBase';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

export type EmailTarget = 'self' | 'owner' | 'admin' | 'resident';

export interface EmailEventOptions {
  to?: EmailTarget;
  propertyId?: string;
  residentId?: string;
  residentEmail?: string;
  data?: Record<string, unknown>;
  /** Same key twice = mailed once (safe against double-clicks and retries). */
  dedupeKey?: string;
}

/**
 * Queue a transactional email for a product event.
 *
 * Fire-and-forget on purpose: the recipient is resolved server-side from the
 * JWT and the database, and a mail failure must never block or fail the user's
 * action. Unknown events and unconfigured senders are handled server-side.
 */
export function fireEmailEvent(event: string, opts: EmailEventOptions = {}): void {
  if (!isProductionApiEnabled()) return;
  const token = getAuthToken();
  if (!token) return;

  void fetch(apiUrl('/api/notify/event'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      event,
      to: opts.to ?? 'self',
      propertyId: opts.propertyId,
      residentId: opts.residentId,
      residentEmail: opts.residentEmail,
      data: opts.data ?? {},
      dedupeKey: opts.dedupeKey,
    }),
  }).catch(() => {
    /* best-effort — never surface mail errors in the UI */
  });
}
