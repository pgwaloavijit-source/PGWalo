import { apiUrl as sharedApiUrl } from './apiBase';
import { BookingRequest, Invoice, Payment, SupportTicket, UserAccount } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

// Admin-console API client. In production (Worker + D1) these helpers fetch live,
// filtered data. In demo mode every loader resolves to `null` so callers fall
// back to the local AppContext state without breaking the UI.

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface ListEnvelope<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats?: Record<string, number>;
}

/**
 * The Worker answers with a *named* collection plus pagination meta, e.g.
 * `{ users: [...], page, pageSize, total, totalPages }`. Reading `data.items`
 * here silently produced empty lists on the live site (Users / Owners /
 * Tenants / Bookings / Payments all showed "No matching accounts").
 * Accept the named key first and keep `items` as a fallback.
 */
async function fetchEnvelope<T>(
  path: string,
  collectionKey: 'users' | 'bookings' | 'payments'
): Promise<ListEnvelope<T> | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  try {
    const response = await fetch(apiUrl(path), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    const items = Array.isArray(data[collectionKey])
      ? (data[collectionKey] as T[])
      : Array.isArray(data.items)
        ? (data.items as T[])
        : [];
    return {
      items,
      page: Number(data.page) || 1,
      pageSize: Number(data.pageSize) || items.length,
      total: Number(data.total) || items.length,
      totalPages: Number(data.totalPages) || 1,
      stats: (data.stats as Record<string, number>) || undefined,
    };
  } catch {
    return null;
  }
}

export interface AdminUserRow {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string | null;
  created_at: string;
  city?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  avatar?: string | null;
}

export interface AdminQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminUserQuery extends AdminQuery {
  role?: string;
  status?: string;
}

export interface AdminDateQuery extends AdminQuery {
  status?: string;
  propertyId?: string;
  from?: string;
  to?: string;
}

export async function fetchAdminUsers(query: AdminUserQuery = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.role && query.role !== 'all') params.set('role', query.role);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  params.set('page', String(query.page || 1));
  params.set('pageSize', String(query.pageSize || 50));
  const data = await fetchEnvelope<AdminUserRow>(`/api/admin/users?${params.toString()}`, 'users');
  if (!data) return null;
  const users: UserAccount[] = (data.items || []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as UserAccount['role'],
    status: (row.status || 'Active') as UserAccount['status'],
    createdAt: row.created_at,
    avatar: row.avatar || '',
    organizationId: row.organization_id || undefined,
  }));
  return { users, total: data.total, totalPages: data.totalPages, page: data.page };
}

export async function fetchAdminBookings(query: AdminDateQuery = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.propertyId && query.propertyId !== 'all') params.set('propertyId', query.propertyId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  params.set('page', String(query.page || 1));
  params.set('pageSize', String(query.pageSize || 200));
  const data = await fetchEnvelope<Record<string, unknown>>(`/api/admin/bookings?${params.toString()}`, 'bookings');
  if (!data) return null;
  return {
    bookings: (data.items || []) as unknown as BookingRequest[],
    total: data.total,
    totalPages: data.totalPages,
    page: data.page,
  };
}

export async function fetchAdminPayments(query: AdminDateQuery = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.propertyId && query.propertyId !== 'all') params.set('propertyId', query.propertyId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  params.set('page', String(query.page || 1));
  params.set('pageSize', String(query.pageSize || 200));
  const data = await fetchEnvelope<Record<string, unknown>>(`/api/admin/payments?${params.toString()}`, 'payments');
  if (!data) return null;
  return {
    payments: (data.items || []) as unknown as (Payment | Invoice)[],
    total: data.total,
    totalPages: data.totalPages,
    page: data.page,
    stats: data.stats,
  };
}

export async function fetchAdminSupportTickets(query: { q?: string; status?: string } = {}): Promise<SupportTicket[] | null> {
  if (!isProductionApiEnabled() || !getAuthToken()) return null;
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  try {
    const response = await fetch(apiUrl(`/api/admin/support-tickets?${params.toString()}`), { headers: authHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? (data as SupportTicket[]) : null;
  } catch {
    return null;
  }
}

// ---------------- Mutations ----------------
// All admin PATCH/POST calls return success so the UI can surface failures
// instead of silently dropping them.

async function mutate(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<boolean> {
  if (!isProductionApiEnabled() || !getAuthToken()) return false;
  try {
    const response = await fetch(apiUrl(path), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const patchAdminUserStatus = (userId: string, status: string) =>
  mutate(`/api/admin/users/${encodeURIComponent(userId)}`, 'PATCH', { status });

export const patchAdminProperty = (
  propertyId: string,
  payload: { action?: 'approve' | 'reject' | 'disable'; reason?: string; name?: string; tagline?: string; description?: string }
) => mutate(`/api/admin/properties/${encodeURIComponent(propertyId)}`, 'PATCH', payload);

export const patchAdminTicket = (
  ticketId: string,
  payload: { status?: string; assignedTo?: string | null }
) => mutate(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}`, 'PATCH', payload);

export const postAdminTicketReply = (
  ticketId: string,
  body: string,
  authorName?: string
) => mutate(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}`, 'POST', { body, authorName });

export const postAdminLogout = () => mutate('/api/admin/logout', 'POST', {});
