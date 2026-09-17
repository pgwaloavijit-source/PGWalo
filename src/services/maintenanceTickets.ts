import { apiUrl as sharedApiUrl } from './apiBase';
import { MaintenanceOverview, MaintenanceTicket } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * The signed-in user's complaint list, straight from D1. Residents get only
 * their own tickets; staff/warden/owner get their org's inbox.
 */
export async function fetchMaintenanceTickets(): Promise<MaintenanceTicket[] | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  try {
    const response = await fetch(apiUrl('/api/maintenance-tickets'), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? (data as MaintenanceTicket[]) : null;
  } catch {
    return null;
  }
}

/**
 * Org-wide SLA + staff-performance rollup for the owner maintenance tab. The
 * Worker computes it over the caller's own scope; null when live mode is off or
 * the call fails, in which case the tab falls back to local tickets.
 */
export async function fetchMaintenanceOverview(): Promise<MaintenanceOverview | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  try {
    const response = await fetch(apiUrl('/api/maintenance-tickets?view=overview'), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' && 'totals' in data ? (data as MaintenanceOverview) : null;
  } catch {
    return null;
  }
}

/**
 * Raises a complaint. `id` is sent so the locally rendered ticket and the
 * durable row share a key.
 */
export async function postMaintenanceTicket(
  ticket: MaintenanceTicket
): Promise<{ ok: boolean; id?: string }> {
  if (!isProductionApiEnabled() || !getAuthToken()) return { ok: false };
  try {
    const response = await fetch(apiUrl('/api/maintenance-tickets'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: ticket.id,
        title: ticket.title,
        category: ticket.category,
        description: ticket.description,
        priority: ticket.priority,
        roomNumber: ticket.roomNumber,
        propertyName: ticket.propertyName,
        propertyId: ticket.propertyId,
        photoUrl: ticket.photoUrl,
      }),
    });
    if (!response.ok) return { ok: false };
    const data = await response.json();
    return { ok: true, id: data?.id };
  } catch {
    return { ok: false };
  }
}

/** Staff/warden/owner status change; the Worker notifies the resident. */
export async function patchMaintenanceTicketStatus(
  id: string,
  status: MaintenanceTicket['status'],
  extra?: { assignedStaffName?: string; resolutionNotes?: string; cost?: number }
): Promise<boolean> {
  if (!isProductionApiEnabled() || !getAuthToken()) return false;
  try {
    const response = await fetch(apiUrl('/api/maintenance-tickets'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'status', id, status, ...extra }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
