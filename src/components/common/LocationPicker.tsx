import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { GeoPlace, osmEmbedUrl, reverseGeocode, searchPlaces } from '../../services/geo';

interface LocationPickerProps {
  city?: string;
  locality?: string;
  address?: string;
  lat?: number;
  lng?: number;
  onPicked: (place: GeoPlace) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  city,
  locality,
  address,
  lat,
  lng,
  onPicked,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await searchPlaces(`${query} ${city || ''} India`.trim()));
      } finally {
        setBusy(false);
      }
    }, 320);
    return () => window.clearTimeout(timer.current);
  }, [query, city]);

  const pick = (place: GeoPlace) => {
    onPicked(place);
    setQuery(place.displayName);
    setResults([]);
  };

  const useDevice = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (place) pick(place);
        else onPicked({ lat: pos.coords.latitude, lng: pos.coords.longitude, displayName: 'Current location' });
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const tagged = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search street, landmark, or area"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={useDevice}
          className="shrink-0 px-3 rounded-xl border border-slate-200 text-[11px] font-bold text-blue-700 flex items-center gap-1"
        >
          <Navigation className="w-3.5 h-3.5" />
          Me
        </button>
      </div>
      {busy && <p className="text-[10px] text-slate-400">Finding pin…</p>}
      {results.length > 0 && (
        <ul className="rounded-xl border border-slate-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
          {results.map((r) => (
            <li key={`${r.lat}-${r.lng}-${r.displayName}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50"
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tagged && (
        <iframe
          title="Property map"
          className="w-full h-40 rounded-xl border border-slate-200"
          src={osmEmbedUrl(lat, lng)}
        />
      )}
      <p className="text-[10px] text-slate-400">
        Pin is stored as coordinates only. Map tiles are OpenStreetMap
        {locality || address ? ` · ${locality || address}${city ? `, ${city}` : ''}` : ''}.
      </p>
    </div>
  );
};
