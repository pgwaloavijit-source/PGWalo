export interface PinLocation {
  pincode: string;
  city: string;
  state: string;
  country: string;
}

const PIN_CACHE_KEY = 'pgwalo_pin_locations';

const PIN_FALLBACKS: Record<string, PinLocation> = {
  '201301': { pincode: '201301', city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
  '560102': { pincode: '560102', city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  '560068': { pincode: '560068', city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  '110001': { pincode: '110001', city: 'New Delhi', state: 'Delhi', country: 'India' },
  '400001': { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  '411001': { pincode: '411001', city: 'Pune', state: 'Maharashtra', country: 'India' },
  '500081': { pincode: '500081', city: 'Hyderabad', state: 'Telangana', country: 'India' },
};

function readCache(): Record<string, PinLocation> {
  try {
    return JSON.parse(localStorage.getItem(PIN_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function rememberPinLocation(location: PinLocation) {
  const cache = readCache();
  cache[location.pincode] = location;
  localStorage.setItem(PIN_CACHE_KEY, JSON.stringify(cache));
}

export function cachedPinLocations(): PinLocation[] {
  return Object.values({ ...PIN_FALLBACKS, ...readCache() });
}

export async function lookupIndianPincode(rawPin: string): Promise<PinLocation | null> {
  const pincode = rawPin.replace(/\D/g, '').slice(0, 6);
  if (pincode.length !== 6) return null;

  const cached = readCache()[pincode] || PIN_FALLBACKS[pincode];
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const json = await res.json();
    const first = json?.[0]?.PostOffice?.[0];
    if (!first) return null;
    const location: PinLocation = {
      pincode,
      city: first.District || first.Block || first.Name || '',
      state: first.State || '',
      country: first.Country || 'India',
    };
    if (location.city && location.state) rememberPinLocation(location);
    return location;
  } catch {
    return null;
  }
}
