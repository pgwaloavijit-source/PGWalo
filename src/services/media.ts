import { apiUrl as sharedApiUrl } from './apiBase';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

export async function uploadListingPhoto(blob: Blob, category = 'Bedroom'): Promise<{ url?: string; dataUrl?: string }> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return {};
  const token = getAuthToken();
  const form = new FormData();
  form.append('file', blob, 'room.jpg');
  form.append('category', category);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl('/api/media/upload'), { method: 'POST', headers, body: form });
  if (!response.ok) return {};
  return response.json();
}

/**
 * Residents attach evidence photos to maintenance complaints. Uploaded under
 * `complaints/<userId>/...` in R2 — kept separate from owner listing photos so
 * listing DELETE rules never touch complaint evidence.
 */
export async function uploadComplaintPhoto(blob: Blob): Promise<{ url?: string; dataUrl?: string }> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return {};
  const token = getAuthToken();
  const form = new FormData();
  form.append('file', blob, 'complaint.jpg');
  form.append('category', 'Complaint');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl('/api/media/upload'), { method: 'POST', headers, body: form });
  if (!response.ok) return {};
  return response.json();
}

export async function enhanceListingPhoto(blob: Blob, category = 'Bedroom'): Promise<{ url?: string; dataUrl?: string }> {
  if (!isProductionApiEnabled() && !import.meta.env.PROD) {
    return {};
  }
  const token = getAuthToken();
  const form = new FormData();
  form.append('file', blob, 'room.jpg');
  form.append('category', category);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl('/api/media/enhance'), { method: 'POST', headers, body: form });
  if (!response.ok) return {};
  return response.json();
}
