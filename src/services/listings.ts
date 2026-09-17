import { apiUrl as sharedApiUrl } from './apiBase';
import { Property } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

export async function fetchPublicListings(filters?: { city?: string; location?: string }): Promise<Property[]> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return [];
  const params = new URLSearchParams();
  if (filters?.city && filters.city !== 'All') params.set('city', filters.city);
  if (filters?.location) params.set('location', filters.location);
  const qs = params.toString();
  const response = await fetch(apiUrl(`/api/listings${qs ? `?${qs}` : ''}`));
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function publishListing(property: Property): Promise<boolean> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return false;
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl('/api/listings'), {
    method: 'POST',
    headers,
    body: JSON.stringify(property),
  });
  return response.ok;
}
