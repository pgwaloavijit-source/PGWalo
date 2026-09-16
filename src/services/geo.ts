import { isProductionApiEnabled } from './productionApi';

export interface GeoPlace {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  locality?: string;
  address?: string;
}

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path}`;
};

export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (!isProductionApiEnabled() && !import.meta.env.PROD) return [];
  const response = await fetch(apiUrl(`/api/geo/search?q=${encodeURIComponent(q)}`));
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.places) ? data.places : [];
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  const response = await fetch(apiUrl(`/api/geo/reverse?lat=${lat}&lng=${lng}`));
  if (!response.ok) return null;
  const data = await response.json();
  return data.place || null;
}

export function osmEmbedUrl(lat: number, lng: number) {
  const d = 0.012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmBoundsUrl(points: { lat: number; lng: number }[]) {
  const geo = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));
  if (!geo.length) return '';
  if (geo.length === 1) return osmEmbedUrl(geo[0].lat, geo[0].lng);
  const minLat = Math.min(...geo.map((p) => p.lat));
  const maxLat = Math.max(...geo.map((p) => p.lat));
  const minLng = Math.min(...geo.map((p) => p.lng));
  const maxLng = Math.max(...geo.map((p) => p.lng));
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.01);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.01);
  const marker = geo[0];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng - padLng}%2C${minLat - padLat}%2C${maxLng + padLng}%2C${maxLat + padLat}&layer=mapnik&marker=${marker.lat}%2C${marker.lng}`;
}
