import { apiUrl as sharedApiUrl } from './apiBase';
import { Property } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

export async function fetchPublicListings(filters?: { city?: string; location?: string; limit?: number }): Promise<Property[]> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return [];
  const params = new URLSearchParams();
  if (filters?.city && filters.city !== 'All') params.set('city', filters.city);
  if (filters?.location) params.set('location', filters.location);
  if (filters?.limit) params.set('limit', String(Math.min(Math.max(filters.limit, 1), 1000)));
  const qs = params.toString();
  const headers: Record<string, string> = {};
  // Sending the owner's token lets the worker include their own listings that
  // are still waiting for a publishing payment (never shown to anyone else).
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl(`/api/listings${qs ? `?${qs}` : ''}`), { headers });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Publish or update a listing. Returns the row the server stored — which is
 * where the PGWalo number and the prefixed display name come from — so the
 * caller can render the authoritative record instead of its own draft.
 */
export async function publishListing(property: Property): Promise<Property | null> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return null;
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl('/api/listings'), {
    method: 'POST',
    headers,
    body: JSON.stringify(property),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const stored = (data as { property?: Property } | null)?.property;
  return stored && stored.id ? stored : null;
}
