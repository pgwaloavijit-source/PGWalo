import { apiUrl as sharedApiUrl } from './apiBase';
import { BroadcastNotification, SupportTicket } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * The requester's own tickets, straight from D1. The bootstrap snapshot is
 * org-scoped, so this is the only path that can be trusted to return exactly
 * the signed-in user's tickets.
 */
export async function fetchMySupportTickets(): Promise<SupportTicket[] | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  try {
    const response = await fetch(apiUrl('/api/support-tickets'), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? (data as SupportTicket[]) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's notification inbox: announcements plus personal notices
 * (complaint status changes). Refreshed on SSE change events.
 */
export async function fetchMyNotifications(): Promise<BroadcastNotification[] | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  try {
    const response = await fetch(apiUrl('/api/notifications'), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? (data as BroadcastNotification[]) : null;
  } catch {
    return null;
  }
}

/**
 * Raises a ticket. `id` is sent so the locally rendered ticket and the durable
 * row share a key — otherwise an admin reply would land on a record the
 * requester never sees.
 */
export async function postSupportTicket(
  ticket: SupportTicket
): Promise<{ ok: boolean; id?: string }> {
  if (!isProductionApiEnabled() || !getAuthToken()) return { ok: false };
  try {
    const response = await fetch(apiUrl('/api/support-tickets'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: ticket.id,
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        imageUrl: ticket.imageUrl,
        propertyId: ticket.propertyId,
        bookingId: ticket.bookingId,
      }),
    });
    if (!response.ok) return { ok: false };
    const data = await response.json();
    return { ok: true, id: data?.id };
  } catch {
    return { ok: false };
  }
}
