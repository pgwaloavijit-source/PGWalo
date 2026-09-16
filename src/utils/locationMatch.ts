import { Property } from '../types';

const CITY_GROUPS = [
  ['bengaluru', 'bangalore', 'blr', 'bengalooru'],
  ['mumbai', 'bombay'],
  ['delhi', 'new delhi', 'ncr', 'delhi ncr'],
  ['gurugram', 'gurgaon'],
  ['hyderabad', 'hyd'],
  ['chennai', 'madras'],
  ['pune', 'puna'],
  ['kolkata', 'calcutta'],
];

export function normalizeCity(city?: string) {
  const value = (city || '').trim().toLowerCase();
  for (const group of CITY_GROUPS) {
    if (group.includes(value)) return group[0];
  }
  return value;
}

export function cityAliases(city?: string) {
  const value = (city || '').trim().toLowerCase();
  const group = CITY_GROUPS.find((g) => g.includes(value) || g.includes(normalizeCity(city)));
  return group ? [...group] : value ? [value] : [];
}

export function citiesMatch(propertyCity: string, selectedCity: string) {
  if (!selectedCity || selectedCity === 'All') return true;
  return normalizeCity(propertyCity) === normalizeCity(selectedCity);
}

export function matchesPlaceQuery(property: Property, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (citiesMatch(property.city, query.trim())) return true;
  const aliases = cityAliases(property.city);
  const hay = [
    property.name,
    property.locality,
    property.city,
    property.address,
    property.placeLabel,
    `${property.locality}, ${property.city}`,
    ...aliases,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part) || aliases.includes(part));
}

export function mergeProperties(local: Property[], remote: Property[]) {
  const map = new Map<string, Property>();
  local.forEach((p) => map.set(p.id, p));
  remote.forEach((p) => {
    const prev = map.get(p.id);
    map.set(p.id, prev ? { ...prev, ...p } : p);
  });
  return Array.from(map.values());
}

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasCoords(property: Pick<Property, 'lat' | 'lng'>) {
  return Number.isFinite(property.lat) && Number.isFinite(property.lng) && (property.lat !== 0 || property.lng !== 0);
}

export function sortByDistance<T extends Pick<Property, 'lat' | 'lng'>>(items: T[], lat?: number, lng?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return items;
  return [...items].sort((a, b) => {
    const da = hasCoords(a) ? distanceKm(lat!, lng!, a.lat, a.lng) : Number.POSITIVE_INFINITY;
    const db = hasCoords(b) ? distanceKm(lat!, lng!, b.lat, b.lng) : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export function nearbyLocalities(items: Property[], lat?: number, lng?: number, limit = 5) {
  const ranked = sortByDistance(items.filter(hasCoords), lat, lng);
  const seen = new Set<string>();
  const out: { name: string; city: string; km?: number }[] = [];
  for (const property of ranked) {
    const key = `${property.locality}|${property.city}`.toLowerCase();
    if (!property.locality || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: property.locality,
      city: property.city,
      km: Number.isFinite(lat) && Number.isFinite(lng) ? distanceKm(lat!, lng!, property.lat, property.lng) : undefined,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function mapPinPercents(items: Property[]) {
  const geo = items.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));
  if (!geo.length) return {} as Record<string, { left: string; top: string }>;
  let minLat = Math.min(...geo.map((p) => p.lat));
  let maxLat = Math.max(...geo.map((p) => p.lat));
  let minLng = Math.min(...geo.map((p) => p.lng));
  let maxLng = Math.max(...geo.map((p) => p.lng));
  if (minLat === maxLat) {
    minLat -= 0.02;
    maxLat += 0.02;
  }
  if (minLng === maxLng) {
    minLng -= 0.02;
    maxLng += 0.02;
  }
  const pins: Record<string, { left: string; top: string }> = {};
  geo.forEach((p) => {
    pins[p.id] = {
      left: `${((p.lng - minLng) / (maxLng - minLng)) * 78 + 11}%`,
      top: `${((maxLat - p.lat) / (maxLat - minLat)) * 78 + 11}%`,
    };
  });
  return pins;
}
