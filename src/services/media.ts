import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path}`;
};

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
