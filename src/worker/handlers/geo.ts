import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';

interface GeoPlace {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  locality?: string;
  address?: string;
}

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=120' },
  }));
}

function clientKey(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  return `geo-rl:${ip}`;
}

async function rateLimit(env: Env, request: Request) {
  if (!env.CACHE) return true;
  const key = clientKey(request);
  const n = Number((await env.CACHE.get(key)) || '0');
  if (n > 40) return false;
  await env.CACHE.put(key, String(n + 1), { expirationTtl: 60 });
  return true;
}

async function cacheGet(env: Env, key: string): Promise<string | null> {
  if (!env.CACHE) return null;
  return env.CACHE.get(key);
}

async function cachePut(env: Env, key: string, value: string) {
  if (!env.CACHE) return;
  await env.CACHE.put(key, value, { expirationTtl: 60 * 60 * 24 * 7 });
}

function fromPhoton(feature: {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, string>;
}): GeoPlace | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const p = feature.properties || {};
  const locality = p.district || p.suburb || p.locality || p.name;
  const city = p.city || p.town || p.county;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  return {
    lng: coords[0],
    lat: coords[1],
    displayName: [street || p.name, locality, city, p.state].filter(Boolean).join(', '),
    city,
    locality,
    address: street || p.name,
  };
}

async function searchPhoton(q: string): Promise<GeoPlace[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PGWalo/1.0 (listings@pgwalo.com)' } });
  if (!res.ok) return [];
  const data = await res.json() as { features?: Parameters<typeof fromPhoton>[0][] };
  return (data.features || []).map(fromPhoton).filter((p): p is GeoPlace => Boolean(p));
}

async function reversePhoton(lat: number, lng: number): Promise<GeoPlace | null> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PGWalo/1.0 (listings@pgwalo.com)' } });
  if (!res.ok) return null;
  const data = await res.json() as { features?: Parameters<typeof fromPhoton>[0][] };
  return data.features?.[0] ? fromPhoton(data.features[0]) : null;
}

async function searchGoogle(q: string, key: string): Promise<GeoPlace[]> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=in&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as {
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      address_components: Array<{ long_name: string; types: string[] }>;
    }>;
  };
  return (data.results || []).slice(0, 6).map((r) => {
    const pick = (type: string) => r.address_components.find((c) => c.types.includes(type))?.long_name;
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      displayName: r.formatted_address,
      city: pick('locality') || pick('administrative_area_level_2'),
      locality: pick('sublocality') || pick('neighborhood') || pick('sublocality_level_1'),
      address: r.formatted_address,
    };
  });
}

export async function geoHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!(await rateLimit(env, request))) return json({ error: 'Too many location lookups' }, 429);

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/geo/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    if (q.length < 3) return json({ places: [] });
    const cacheKey = `geo:s:${q.toLowerCase()}`;
    const cached = await cacheGet(env, cacheKey);
    if (cached) return json(JSON.parse(cached));

    let places: GeoPlace[] = [];
    if (env.GOOGLE_MAPS_SERVER_KEY) {
      places = await searchGoogle(q, env.GOOGLE_MAPS_SERVER_KEY);
    }
    if (!places.length) places = await searchPhoton(q);
    const payload = { places };
    await cachePut(env, cacheKey, JSON.stringify(payload));
    return json(payload);
  }

  if (path === '/api/geo/reverse') {
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'Invalid coordinates' }, 400);
    const cacheKey = `geo:r:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    const cached = await cacheGet(env, cacheKey);
    if (cached) return json(JSON.parse(cached));
    const place = await reversePhoton(lat, lng);
    const payload = { place };
    await cachePut(env, cacheKey, JSON.stringify(payload));
    return json(payload);
  }

  return json({ error: 'Unknown geo endpoint' }, 404);
}
