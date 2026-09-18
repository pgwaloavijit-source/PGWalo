import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  MapPin,
  ShieldCheck,
  Utensils,
  Wifi,
  Sparkles,
  ArrowRight,
  Star,
  Building,
  CheckCircle2,
  Clock,
  HeartHandshake,
  CalendarCheck2,
  Building2,
  Compass,
  ChevronRight,
  Crosshair,
} from 'lucide-react';
import { visitedPropertyIds, bookedPropertyIds } from '../../utils/userBookings';
import { ListingImage } from '../common/ListingImage';
import { GenderPreference, PublicSearchCriteria, Property } from '../../types';
import { fetchPublicListings } from '../../services/listings';
import { amenityLabel, normalizeAmenities } from '../../utils/amenities';
import { searchPlaces } from '../../services/geo';
import { mergeProperties, nearbyLocalities, sortByDistance, hasCoords } from '../../utils/locationMatch';

export const LandingPage: React.FC<{
  onExploreClick: (criteria?: PublicSearchCriteria) => void;
  onSelectPG: (pgId: string) => void;
}> = ({ onExploreClick, onSelectPG }) => {
  const { properties, openAuthModal, currentUser, bookingRequests } = useApp();
  const [remoteListings, setRemoteListings] = useState<Property[]>([]);
  const catalog = useMemo(() => mergeProperties(properties, remoteListings), [properties, remoteListings]);
  const visitedIds = useMemo(() => visitedPropertyIds(bookingRequests, currentUser), [bookingRequests, currentUser]);
  const bookedIds = useMemo(() => bookedPropertyIds(bookingRequests, currentUser), [bookingRequests, currentUser]);

  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [moveInDate, setMoveInDate] = useState('');
  const [selectedType, setSelectedType] = useState<GenderPreference | 'All'>('All');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [specificSearch, setSpecificSearch] = useState(false);
  const [expandedAmenities, setExpandedAmenities] = useState<string | null>(null);
  const [cardAmenityLimit, setCardAmenityLimit] = useState(8);
  const locationInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicListings()
      .then((remote) => {
        if (!cancelled && remote.length) setRemoteListings(remote);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateLimit = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setCardAmenityLimit(10);
      else if (window.matchMedia('(min-width: 640px)').matches) setCardAmenityLimit(9);
      else setCardAmenityLimit(8);
    };
    updateLimit();
    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationInputRef.current && !locationInputRef.current.contains(event.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };

    if (showLocationSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLocationSuggestions]);

  const featuredList = useMemo(() => {
    const live = catalog.filter((p) => p.ownerUserId && p.ownerUserId !== 'catalog-seed');
    const rest = catalog.filter((p) => !live.some((l) => l.id === p.id));
    const ranked = sortByDistance([...live, ...rest], userCoords?.lat, userCoords?.lng);
    return ranked.slice(0, 3);
  }, [catalog, userCoords]);

  const nearbyAreas = useMemo(
    () => nearbyLocalities(catalog, userCoords?.lat, userCoords?.lng, 5),
    [catalog, userCoords]
  );

  // Group properties by locality for the area-wise discovery section
  const localities = nearbyAreas.map((area) => ({
    name: area.name,
    city: area.city,
    count: catalog.filter((p) => p.locality === area.name).length || 1,
    techPark: area.km != null ? `${area.km.toFixed(1)} km from you` : `PGs in ${area.city}`,
  }));

  const locationOptions = useMemo(() => {
    const optionMap = new Map<string, { label: string; city: string; type: 'Area' | 'PG'; propertyId?: string }>();

    localities.forEach((loc) => {
      optionMap.set(`${loc.name}-${loc.city}`, {
        label: `${loc.name}, ${loc.city}`,
        city: loc.city,
        type: 'Area',
      });
    });

    catalog.forEach((property) => {
      optionMap.set(`${property.locality}-${property.city}`, {
        label: `${property.locality}, ${property.city}`,
        city: property.city,
        type: 'Area',
      });
      optionMap.set(property.id, {
        label: `${property.name} - ${property.locality}`,
        city: property.city,
        type: 'PG',
        propertyId: property.id,
      });
    });

    return Array.from(optionMap.values());
  }, [localities, catalog]);

  const visibleLocationSuggestions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return locationOptions.slice(0, 6);
    return locationOptions
      .filter((option) => option.label.toLowerCase().includes(query))
      .slice(0, 6);
  }, [locationOptions, locationQuery]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return;

    const query = locationQuery.trim();
    // Dismiss the suggestion panel first: on narrow screens it sits in the flow
    // below the input, and on wide screens it must never sit over the submit area.
    setShowLocationSuggestions(false);
    setLocationError('');

    if (!query) {
      onExploreClick({
        city: selectedCity,
        moveInDate,
        type: selectedType,
        lat: userCoords?.lat,
        lng: userCoords?.lng,
        nearby: true,
      });
      return;
    }

    setSpecificSearch(true);
    setSearching(true);
    // Resolving the typed area to real coordinates is a nice-to-have: it speeds up
    // the geolocation API, but a slow or failed lookup must never swallow the search.
    let place: { city?: string; lat?: number; lng?: number } | undefined;
    try {
      // Bounded: a slow or hanging lookup must never leave the search stuck, so
      // whichever resolves first wins and we navigate on the typed query.
      const places = await Promise.race([
        searchPlaces(query),
        new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 2500)),
      ]);
      place = places[0];
    } catch {
      // Fall back to searching the typed query as-is.
      place = undefined;
    }
    setSearching(false);

    onExploreClick({
      location: query,
      city: place?.city || selectedCity,
      moveInDate,
      type: selectedType,
      lat: place?.lat,
      lng: place?.lng,
      nearby: false,
    });
  };

  const handleAreaPillClick = (areaName: string, cityName: string) => {
    setSpecificSearch(true);
    onExploreClick({ location: areaName, city: cityName, moveInDate, type: selectedType, nearby: false });
  };

  const handleLocationSelect = (label: string, city: string, propertyId?: string) => {
    setLocationQuery(label);
    setSelectedCity(city);
    setShowLocationSuggestions(false);
    setLocationError('');

    // If a specific PG is selected, navigate directly to it
    if (propertyId) {
      onSelectPG(propertyId);
    }
  };

  const applyCoords = (lat: number, lng: number, label?: string) => {
    setUserCoords({ lat, lng });
    setSpecificSearch(false);
    const nearest = sortByDistance(catalog.filter(hasCoords), lat, lng)[0];
    if (label) {
      setLocationQuery(label);
    } else if (nearest) {
      setLocationQuery(`Near ${nearest.locality}, ${nearest.city}`);
      setSelectedCity(nearest.city);
    }
    setLocationError('');
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported in this browser.');
      return;
    }

    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoords(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocationError('Allow location access to find PGs near you.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!navigator.geolocation || userCoords) return;
    navigator.geolocation.getCurrentPosition(
      (position) => applyCoords(position.coords.latitude, position.coords.longitude),
      () => undefined,
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [catalog.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ================= REFINED, EYE-FRIENDLY HERO SECTION ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        {/* Subtle Ambient Radial Lighting for Eye Comfort */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-[90px] pointer-events-none" />
        
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Subtle Verified Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 backdrop-blur-md text-blue-300 text-xs font-semibold mb-6 border border-slate-700/70 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Zero Brokerage • 100% Verified PGs & Co-Living Spaces</span>
          </div>

          {/* Eye-Comfort Display Typography */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Find, Visit & Move into <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-indigo-300">
              Verified PGs
            </span>{' '}
            Near Your Office
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Hygienic 3-time meals, high-speed Wi-Fi, biometric security, and digital stay management. Schedule free visits or request to join with zero brokerage.
          </p>

          {/* Quick Search Card */}
          <div className="mt-8 bg-white rounded-2xl p-4 sm:p-5 shadow-2xl text-slate-800 max-w-4xl mx-auto border border-slate-200/80">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-left">
              {/* Location */}
              <div className="sm:col-span-5" ref={locationInputRef}>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-blue-600" />
                  <input
                    id="hero-search-input"
                    type="text"
                    placeholder="Your area, address, or a different city"
                    value={locationQuery}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onChange={(e) => {
                      setLocationQuery(e.target.value);
                      setSelectedCity(undefined);
                      setShowLocationSuggestions(true);
                    }}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    className="absolute right-2 top-2 p-1 rounded-lg text-blue-600 hover:bg-blue-50"
                    title="Locate me"
                  >
                    <Crosshair className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
                  </button>
                  {showLocationSuggestions && (
                    /* Below `sm` the form stacks into one column, so an absolutely
                       positioned panel would land on top of the Move-In Date, Type
                       and Search PGs controls and swallow their taps. Keep it in the
                       flow there; only float it once the fields sit side by side. */
                    <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden sm:absolute sm:left-0 sm:right-0 sm:top-full sm:z-30 sm:max-h-[340px] sm:overflow-y-auto">
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleLocateMe();
                        }}
                        className="w-full px-3 py-2.5 text-left text-xs font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 border-b border-slate-100"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        {locating ? 'Locating...' : 'Use my current location'}
                      </button>
                      {visibleLocationSuggestions.map((option) => (
                        <button
                          key={`${option.type}-${option.label}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleLocationSelect(option.label, option.city, option.propertyId);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
                        >
                          <span className="text-xs font-semibold text-slate-800 truncate">{option.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{option.type}</span>
                        </button>
                      ))}
                      {visibleLocationSuggestions.length === 0 && (
                        <div className="px-3 py-2.5 text-xs text-slate-500">No matching locations yet</div>
                      )}
                    </div>
                  )}
                </div>
                {locationError && <p className="mt-1 text-[10px] font-semibold text-rose-600">{locationError}</p>}
              </div>

              {/* Move-In Date */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Move-In Date
                </label>
                <div className="relative">
                  <CalendarCheck2 className="absolute left-3 top-3 w-4 h-4 text-blue-600" />
                  <input
                    id="hero-move-in-date"
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* PG Type */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Type
                </label>
                <select
                  id="hero-type-select"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as GenderPreference | 'All')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="All">Any Type</option>
                  <option value="Boys">Boys PG</option>
                  <option value="Girls">Girls PG</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>

              {/* Search Submit Button — lifted above the location suggestions (z-30)
                  and the fixed mobile bottom nav so a stray overlay can never
                  intercept the tap that submits the search. */}
              <div className="sm:col-span-2 flex items-end relative z-40">
                <button
                  id="hero-search-submit-btn"
                  type="submit"
                  disabled={searching}
                  aria-busy={searching}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-70 disabled:cursor-wait text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[42px]"
                >
                  <Search className={`w-3.5 h-3.5 ${searching ? 'animate-pulse' : ''}`} />
                  <span>{searching ? 'Searching…' : 'Search PGs'}</span>
                </button>
              </div>
            </form>

            {/* Quick Area Discovery Chips */}
            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Compass className="w-3 h-3 text-blue-600" />
                {userCoords ? 'Top 5 localities near you' : 'Nearby localities'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(nearbyAreas.length ? nearbyAreas : [
                  { name: 'HSR Layout', city: 'Bengaluru' },
                  { name: 'Koramangala', city: 'Bengaluru' },
                  { name: 'Whitefield', city: 'Bengaluru' },
                  { name: 'Hinjewadi', city: 'Pune' },
                  { name: 'Gachibowli', city: 'Hyderabad' },
                ]).slice(0, 5).map((area) => (
                  <button
                    key={`${area.name}-${area.city}`}
                    type="button"
                    onClick={() => handleAreaPillClick(area.name, area.city)}
                    className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-left"
                  >
                    <p className="text-[11px] font-bold text-slate-800 truncate">{area.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{area.city}{'km' in area && area.km != null ? ` · ${area.km.toFixed(1)} km` : ''}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Key Trust Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-4xl mx-auto pt-6 border-t border-slate-800/80 text-white">
            <div className="p-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">450+</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Verified PGs</p>
            </div>
            <div className="p-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">12,000+</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Happy Residents</p>
            </div>
            <div className="p-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">Zero</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Brokerage Fee</p>
            </div>
            <div className="p-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">4.8 / 5</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Average Resident Score</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STEP 2: FEATURED PGS IN POPULAR LOCALITIES ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
                <Building className="w-4 h-4" />
                <span>Featured Accommodations</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Verified PGs near you
              </h2>
            </div>
            <button
              id="view-all-pgs-btn"
            onClick={() => onExploreClick({ lat: userCoords?.lat, lng: userCoords?.lng, nearby: !specificSearch })}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 group"
            >
              <span>Explore All {catalog.length} Properties</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredList.map((pg) => (
              <div
                key={pg.id}
                className="group rounded-2xl border border-slate-200 hover:border-blue-400 bg-white overflow-hidden shadow-xs hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Image container with tags */}
                  <div className="relative h-48 overflow-hidden bg-slate-100">
                    <ListingImage
                      src={pg.coverImage}
                      alt={pg.name}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs ${
                          pg.gender === 'Girls'
                            ? 'bg-rose-600'
                            : pg.gender === 'Boys'
                            ? 'bg-blue-600'
                            : 'bg-emerald-600'
                        }`}
                      >
                        {pg.gender} PG
                      </span>
                      {pg.verified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-blue-700 backdrop-blur-xs flex items-center gap-1 shadow-xs">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          Verified
                        </span>
                      )}
                      {visitedIds.has(pg.id) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                          Already visited
                        </span>
                      )}
                      {bookedIds.has(pg.id) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                          Applied
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{pg.rating}</span>
                      <span className="text-[10px] text-slate-300">({pg.reviewCount})</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mb-1">
                      <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="truncate">{pg.locality}, {pg.city}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {pg.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {pg.tagline}
                    </p>

                    {/* Amenities pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {normalizeAmenities(pg.amenities || []).slice(0, expandedAmenities === pg.id ? undefined : cardAmenityLimit).map((amenity) => (
                        <span key={amenity} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold">
                          {amenity === 'food' ? <Utensils className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                          {amenityLabel(amenity)}
                        </span>
                      ))}
                      {normalizeAmenities(pg.amenities || []).length > cardAmenityLimit && (
                        <button type="button" onClick={() => setExpandedAmenities(expandedAmenities === pg.id ? null : pg.id)} className="text-[10px] font-bold text-blue-700 hover:text-blue-900">
                          {expandedAmenities === pg.id ? 'Show less' : `+${normalizeAmenities(pg.amenities || []).length - cardAmenityLimit} More`}
                        </button>
                      )}
                      {pg.gateClosingTime && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          <Clock className="w-3 h-3" /> Gate: {pg.gateClosingTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer price & CTA */}
                <div className="p-4 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Starts from</span>
                    <div className="text-sm font-extrabold text-slate-900">
                      ₹{(pg.startingPrice ?? 0).toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-slate-500">/ month</span>
                    </div>
                  </div>
                  <button
                    id={`view-pg-card-btn-${pg.id}`}
                    onClick={() => onSelectPG(pg.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                  >
                    <span>View Room</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= AREA-WISE DISCOVERY HUB ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-blue-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <MapPin className="w-4 h-4" />
              <span>Locality Hubs</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Browse PGs by Area & Tech Park
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Live within 15 minutes of your office with seamless transport connectivity.
            </p>
          </div>
          <button
            onClick={() => onExploreClick()}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>See All Locations</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {localities.map((loc) => (
            <button
              key={loc.name}
              onClick={() => handleAreaPillClick(loc.name, loc.city)}
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition text-left group flex items-start justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {loc.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    {loc.city}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{loc.techPark}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-blue-600">
                  <span>Explore Available PGs</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ================= HOW PGNEST WORKS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-blue-600 text-xs font-bold uppercase tracking-wider">
            Customer-First Experience
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mt-1">
            How PGWalo Works For You
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
            Finding your home away from home should be easy, transparent, and completely free of broker hassles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs relative">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Search & Filter by Area</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Explore verified PGs with transparent photos, real resident reviews, mess food menus, room sharing options, and exact prices.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs relative">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Schedule Free Physical Visit</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select your convenient date and time slot. Receive instant confirmation and caretaker details so you can inspect the campus in person.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs relative">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Zero Brokerage Move-In</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Request to join or book online. Once approved, complete your digital agreement, track meal times, and pay rent smoothly from your phone.
            </p>
          </div>
        </div>
      </section>

      {/* ================= DEDICATED OWNER / VENDOR ONBOARDING SECTION =================
          Strictly keeping owners off the public header while giving them a professional,
          high-converting entry point.
      */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-8 sm:p-12 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-4 border border-blue-400/30">
              <Building2 className="w-3.5 h-3.5" />
              <span>For Property Owners & Co-Living Operators</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              List Your Property on PGWalo & Fill Vacancies 3x Faster
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
              Automate your PG operations with digital room & bed matrices, lead tracking CRM, automated UPI rent collections, electricity sub-meter calculations, and daily mess management.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                id="owner-partner-join-btn"
                onClick={() => openAuthModal('register', 'owner', { intent: 'owner_list', path: 'owner', source: 'landing_cta' })}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm transition shadow-lg flex items-center gap-2 active:scale-98"
              >
                <span>List Your Property</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="owner-partner-login-btn"
                onClick={() => openAuthModal('login')}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm transition border border-white/20"
              >
                <span>Existing Owner Sign In</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
