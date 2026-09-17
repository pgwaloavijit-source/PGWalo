import { apiUrl as sharedApiUrl } from './apiBase';
import { BookingRequest } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchInquiries(filters?: {
  ownerUserId?: string;
  email?: string;
  phone?: string;
  propertyId?: string;
}): Promise<BookingRequest[]> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return [];
  const params = new URLSearchParams();
  if (filters?.ownerUserId) params.set('ownerUserId', filters.ownerUserId);
  if (filters?.email) params.set('email', filters.email);
  if (filters?.phone) params.set('phone', filters.phone);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);
  const qs = params.toString();
  const response = await fetch(apiUrl(`/api/inquiries${qs ? `?${qs}` : ''}`), { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function publishInquiry(request: BookingRequest): Promise<boolean> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return false;
  const response = await fetch(apiUrl('/api/inquiries'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  return response.ok;
}

export async function patchInquiry(id: string, patch: Partial<BookingRequest>): Promise<boolean> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return false;
  const response = await fetch(apiUrl('/api/inquiries'), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ id, ...patch }),
  });
  return response.ok;
}

export function mergeBookings(local: BookingRequest[], remote: BookingRequest[]) {
  const map = new Map<string, BookingRequest>();
  const key = (item: BookingRequest) => item.referenceId || item.id;
  local.forEach((item) => map.set(key(item), item));
  remote.forEach((item) => {
    const k = key(item);
    map.set(k, map.has(k) ? { ...map.get(k)!, ...item } : item);
  });
  return Array.from(map.values());
}
