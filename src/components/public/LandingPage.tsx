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
import { GenderPreference, PublicSearchCriteria } from '../../types';

export const LandingPage: React.FC<{
  onExploreClick: (criteria?: PublicSearchCriteria) => void;
  onSelectPG: (pgId: string) => void;
}> = ({ onExploreClick, onSelectPG }) => {
  const { properties, openAuthModal } = useApp();

  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [moveInDate, setMoveInDate] = useState('');
  const [selectedType, setSelectedType] = useState<GenderPreference | 'All'>('All');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locationInputRef = useRef<HTMLDivElement>(null);

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

  const featuredList = properties.slice(0, 3);

  // Group properties by locality for the area-wise discovery section
  const localities = [
    { name: 'HSR Layout', city: 'Bengaluru', count: properties.filter(p => p.locality.includes('HSR')).length || 2, techPark: 'Near Ecospace & Outer Ring Road' },
    { name: 'Koramangala', city: 'Bengaluru', count: properties.filter(p => p.locality.includes('Koramangala')).length || 1, techPark: 'Near Sony World & Forum' },
    { name: 'Whitefield', city: 'Bengaluru', count: properties.filter(p => p.locality.includes('Whitefield')).length || 1, techPark: 'Near ITPL & Prestige Tech Cloud' },
    { name: 'Hinjewadi', city: 'Pune', count: properties.filter(p => p.locality.includes('Hinjewadi') || p.city === 'Pune').length || 1, techPark: 'Near Rajiv Gandhi Infotech Park' },
    { name: 'Gachibowli', city: 'Hyderabad', count: properties.filter(p => p.locality.includes('Gachibowli') || p.city === 'Hyderabad').length || 1, techPark: 'Near DLF Cybercity & Financial District' },
    { name: 'Cyber City', city: 'Delhi NCR', count: properties.filter(p => p.locality.includes('Cyber') || p.city.includes('Delhi')).length || 1, techPark: 'Near DLF Phase 2 & 3' },
  ];

  const locationOptions = useMemo(() => {
    const optionMap = new Map<string, { label: string; city: string; type: 'Area' | 'PG'; propertyId?: string }>();

    localities.forEach((loc) => {
      optionMap.set(`${loc.name}-${loc.city}`, {
        label: `${loc.name}, ${loc.city}`,
        city: loc.city,
        type: 'Area',
      });
    });

    properties.forEach((property) => {
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
  }, [localities, properties]);

  const visibleLocationSuggestions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return locationOptions.slice(0, 6);
    return locationOptions
      .filter((option) => option.label.toLowerCase().includes(query))
      .slice(0, 6);
  }, [locationOptions, locationQuery]);

  const getDistanceInKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    const earthRadiusKm = 6371;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((fromLat * Math.PI) / 180) *
        Math.cos((toLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExploreClick({
      location: locationQuery,
      city: selectedCity,
      moveInDate,
      type: selectedType,
    });
  };

  const handleAreaPillClick = (areaName: string, cityName: string) => {
    onExploreClick({ location: areaName, city: cityName, moveInDate, type: selectedType });
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

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported in this browser.');
      return;
    }

    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestProperty = properties
          .filter((property) => Number.isFinite(property.lat) && Number.isFinite(property.lng))
          .map((property) => ({
            property,
            distance: getDistanceInKm(
              position.coords.latitude,
              position.coords.longitude,
              property.lat,
              property.lng
            ),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.property;

        if (nearestProperty) {
          handleLocationSelect(`${nearestProperty.locality}, ${nearestProperty.city}`, nearestProperty.city);
        } else {
          setLocationError('Could not find a nearby listed PG.');
        }
        setLocating(false);
      },
      () => {
        setLocationError('Allow location access to find PGs near you.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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
                    placeholder="Search area, city, tech park, or PG"
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
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-30">
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

              {/* Search Submit Button */}
              <div className="sm:col-span-2 flex items-end">
                <button
                  id="hero-search-submit-btn"
                  type="submit"
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[42px]"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search PGs</span>
                </button>
              </div>
            </form>

            {/* Quick Area Discovery Chips */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Compass className="w-3 h-3 text-blue-600" />
                Popular Areas:
              </span>
              {['HSR Layout', 'Koramangala', 'Whitefield', 'Hinjewadi', 'Gachibowli', 'Cyber City'].map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => {
                    const matched = localities.find(l => l.name === area);
                    handleAreaPillClick(area, matched?.city || 'Bengaluru');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition"
                >
                  {area}
                </button>
              ))}
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
                Verified PGs in Top Tech Corridors
              </h2>
            </div>
            <button
              id="view-all-pgs-btn"
              onClick={() => onExploreClick()}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 group"
            >
              <span>Explore All {properties.length} Properties</span>
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
                    <img
                      src={pg.coverImage}
                      alt={pg.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold">
                        <Utensils className="w-3 h-3" /> Food Inc.
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold">
                        <Wifi className="w-3 h-3" /> 300 Mbps
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        <Clock className="w-3 h-3" /> Gate: {pg.gateClosingTime}
                      </span>
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
                onClick={() => openAuthModal('register', 'owner')}
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
