import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Property, GenderPreference, RoomSharingType, PublicSearchCriteria } from '../../types';
import { INITIAL_AMENITIES } from '../../mockData';
import {
  Search,
  MapPin,
  Filter,
  Star,
  ShieldCheck,
  Utensils,
  Wifi,
  Wind,
  Map as MapIcon,
  LayoutGrid,
  ChevronRight,
  SlidersHorizontal,
  X,
  Navigation,
  CalendarCheck2,
} from 'lucide-react';

export const SearchPage: React.FC<{
  onSelectPG: (pgId: string) => void;
  initialCriteria?: PublicSearchCriteria;
}> = ({ onSelectPG, initialCriteria = {} as PublicSearchCriteria }) => {
  const { properties, beds } = useApp();

  const [searchQuery, setSearchQuery] = useState(initialCriteria.location || '');
  const [selectedCity, setSelectedCity] = useState<string>(initialCriteria.city || 'All');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<GenderPreference | 'All'>(initialCriteria.type || 'All');
  const [selectedRoomType, setSelectedRoomType] = useState<RoomSharingType | 'All'>('All');
  const [selectedMoveInDate, setSelectedMoveInDate] = useState(initialCriteria.moveInDate || '');
  const [maxPrice, setMaxPrice] = useState<number>(18000);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc' | 'rating'>('recommended');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [activeHoverPG, setActiveHoverPG] = useState<Property | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Common localities
  const commonAreas = [
    { label: 'All Localities', value: 'All' },
    { label: 'HSR Layout', value: 'HSR Layout' },
    { label: 'Koramangala', value: 'Koramangala' },
    { label: 'Whitefield', value: 'Whitefield' },
    { label: 'Hinjewadi', value: 'Hinjewadi' },
    { label: 'Gachibowli', value: 'Gachibowli' },
    { label: 'Cyber City', value: 'Cyber City' },
  ];

  useEffect(() => {
    setSearchQuery(initialCriteria.location || '');
    setSelectedCity(initialCriteria.city || 'All');
    setSelectedGender(initialCriteria.type || 'All');
    setSelectedMoveInDate(initialCriteria.moveInDate || '');

    // If the location matches a known locality, set the area filter
    if (initialCriteria.location) {
      const matchedArea = commonAreas.find(
        (area) => area.value !== 'All' && initialCriteria.location?.toLowerCase().includes(area.value.toLowerCase())
      );
      setSelectedArea(matchedArea?.value || 'All');
    } else {
      setSelectedArea('All');
    }
  }, [initialCriteria.location, initialCriteria.city, initialCriteria.type, initialCriteria.moveInDate, commonAreas]);

  const hasMoveInAvailability = (property: Property) => {
    if (!selectedMoveInDate) return true;

    const hasRoomInventory = property.rooms.some((room) => {
      const typeMatches = selectedRoomType === 'All' || room.type === selectedRoomType;
      return typeMatches && room.availableBeds > 0;
    });

    if (hasRoomInventory) return true;

    return beds.some((bed) => {
      if (bed.propertyId !== property.id) return false;
      if (selectedRoomType !== 'All' && bed.sharingType !== selectedRoomType) return false;
      if (['Vacant', 'Available', 'Ready'].includes(bed.status)) return true;
      return Boolean(bed.nextAvailableDate && bed.nextAvailableDate <= selectedMoveInDate);
    });
  };

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => {
        // City
        if (selectedCity !== 'All' && p.city.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
        // Area / Locality
        if (selectedArea !== 'All' && !p.locality.toLowerCase().includes(selectedArea.toLowerCase())) {
          return false;
        }
        // Gender
        if (selectedGender !== 'All' && p.gender !== selectedGender) {
          return false;
        }
        // Move-in availability
        if (!hasMoveInAvailability(p)) {
          return false;
        }
        // Price
        if (p.startingPrice > maxPrice) {
          return false;
        }
        // Room type
        if (selectedRoomType !== 'All') {
          const hasType = p.rooms.some((r) => r.type === selectedRoomType);
          if (!hasType) return false;
        }
        // Amenities
        if (selectedAmenities.length > 0) {
          const hasAll = selectedAmenities.every((aId) => p.amenities.includes(aId));
          if (!hasAll) return false;
        }
        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchLoc = p.locality.toLowerCase().includes(q);
          const matchCity = p.city.toLowerCase().includes(q);
          const matchAddress = p.address.toLowerCase().includes(q);
          const matchCombinedLocation = `${p.locality}, ${p.city}`.toLowerCase().includes(q);
          if (!matchName && !matchLoc && !matchCity && !matchAddress && !matchCombinedLocation) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.startingPrice - b.startingPrice;
        if (sortBy === 'price-desc') return b.startingPrice - a.startingPrice;
        if (sortBy === 'rating') return b.rating - a.rating;
        return 0; // recommended
      });
  }, [properties, beds, selectedCity, selectedArea, selectedGender, selectedRoomType, selectedMoveInDate, maxPrice, selectedAmenities, searchQuery, sortBy]);

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCity('All');
    setSelectedArea('All');
    setSelectedGender('All');
    setSelectedRoomType('All');
    setSelectedMoveInDate('');
    setMaxPrice(20000);
    setSelectedAmenities([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header bar with search input */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 w-full lg:max-w-3xl">
            <div className="relative sm:col-span-6">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="search-page-input"
              type="text"
              placeholder="Search location, PG name, or tech park..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            </div>

            <div className="relative sm:col-span-3">
              <CalendarCheck2 className="w-4 h-4 text-blue-600 absolute left-3 top-3" />
              <input
                id="search-move-in-date"
                type="date"
                value={selectedMoveInDate}
                onChange={(e) => setSelectedMoveInDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <select
              id="search-type-select"
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value as GenderPreference | 'All')}
              className="sm:col-span-3 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            >
              <option value="All">Any Type</option>
              <option value="Boys">Boys PG</option>
              <option value="Girls">Girls PG</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
              <button
                id="view-mode-grid-btn"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                id="view-mode-map-btn"
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'map' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map View</span>
              </button>
            </div>

            {/* Mobile Filter Toggle */}
            <button
              id="mobile-filter-open-btn"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            {/* Sort Dropdown */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Sort:</span>
              <select
                id="search-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Area Filter Chips Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <MapPin className="w-3 h-3 text-blue-600" />
            Area:
          </span>
          {commonAreas.map((area) => (
            <button
              key={area.value}
              onClick={() => setSelectedArea(area.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                selectedArea === area.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {area.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Filter Sidebar (Desktop) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Filters</h3>
                </div>
                <button
                  id="reset-filters-btn"
                  onClick={clearAllFilters}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  Clear All
                </button>
              </div>

              {/* City Selection */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select City
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['All', 'Bengaluru', 'Pune', 'Hyderabad', 'Delhi NCR'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCity(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        selectedCity === c
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* PG Type */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  PG Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['All', 'Boys', 'Girls', 'Unisex'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGender(g)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition text-center ${
                        selectedGender === g
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {g === 'All' ? 'Any Type' : `${g} PG`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Move-In Date */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Move-In Date
                </label>
                <input
                  type="date"
                  value={selectedMoveInDate}
                  onChange={(e) => setSelectedMoveInDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Room Sharing Type */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Room Sharing
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['All', 'Single', 'Double', 'Triple'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRoomType(r)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition text-center ${
                        selectedRoomType === r
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'All' ? 'Any Room' : `${r} Sharing`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Budget Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Max Budget</span>
                  <span className="font-extrabold text-blue-600">₹{maxPrice.toLocaleString()} /mo</span>
                </div>
                <input
                  type="range"
                  min="6000"
                  max="20000"
                  step="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>₹6,000</span>
                  <span>₹20,000+</span>
                </div>
              </div>

              {/* Amenities Checklist */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Amenities
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {INITIAL_AMENITIES.slice(0, 8).map((amenity) => (
                    <label
                      key={amenity.id}
                      className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity.id)}
                        onChange={() => toggleAmenity(amenity.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>{amenity.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9">
            {/* Header info bar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">
                  {selectedCity === 'All' ? 'Available PGs in India' : `PGs in ${selectedCity}`}
                </h1>
                <p className="text-xs text-slate-500">
                  Showing {filteredProperties.length} verified accommodation{filteredProperties.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Zero State */}
            {filteredProperties.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto my-8">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No matching PGs found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your budget or clearing filters to see more results.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
                >
                  Reset All Filters
                </button>
              </div>
            )}

            {/* View Mode: Cards Grid */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredProperties.map((pg) => (
                  <div
                    key={pg.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 overflow-hidden shadow-2xs hover:shadow-lg transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* Image header */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={pg.coverImage}
                          alt={pg.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
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
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-blue-700 flex items-center gap-1 shadow-2xs">
                              <ShieldCheck className="w-3 h-3 text-blue-600" />
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
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
                        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-600 transition-colors">
                          {pg.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {pg.tagline}
                        </p>

                        {/* Room options pills */}
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          {pg.rooms.map((room) => (
                            <span
                              key={room.id}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium"
                            >
                              {room.type}: ₹{(room.rentPerMonth ?? 0).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <span className="text-[10px] text-slate-400 block">From</span>
                        <div className="text-sm font-extrabold text-slate-900">
                          ₹{(pg.startingPrice ?? 0).toLocaleString()}{' '}
                          <span className="text-[11px] font-normal text-slate-500">/mo</span>
                        </div>
                      </div>
                      <button
                        id={`explore-pg-btn-${pg.id}`}
                        onClick={() => onSelectPG(pg.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition shadow-2xs flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View Mode: Interactive Visual Map View */}
            {viewMode === 'map' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-blue-50/60 border-b border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Interactive PG Map Explorer</h3>
                      <p className="text-[11px] text-slate-500">
                        Click pins to preview PG details, rent, and distance to key hubs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                      {filteredProperties.length} Pins Loaded
                    </span>
                  </div>
                </div>

                {/* Stylized Vector Map Canvas */}
                <div className="relative h-[480px] bg-slate-100 overflow-hidden p-6 select-none flex items-center justify-center">
                  {/* Subtle Grid Map pattern */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

                  {/* Simulated Road network */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 50 120 Q 250 200 650 160 T 1100 240" stroke="#94a3b8" strokeWidth="6" fill="none" />
                    <path d="M 120 400 Q 300 280 600 320 T 1000 380" stroke="#94a3b8" strokeWidth="5" fill="none" />
                    <path d="M 400 40 L 420 460" stroke="#94a3b8" strokeWidth="6" fill="none" />
                    <path d="M 720 30 L 700 450" stroke="#94a3b8" strokeWidth="4" fill="none" />
                  </svg>

                  {/* Tech Park Landmark Badges */}
                  <div className="absolute top-8 left-12 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <MapPin className="w-3 h-3 text-blue-400" />
                    <span>HSR IT Corridor / Manyata</span>
                  </div>
                  <div className="absolute bottom-8 right-16 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>DLF Cyber City / Hinjewadi Ph-1</span>
                  </div>

                  {/* Interactive Property Map Pins */}
                  {filteredProperties.map((pg, idx) => {
                    // Spread pins nicely across canvas
                    const leftOffsets = ['22%', '48%', '72%', '36%', '60%'];
                    const topOffsets = ['32%', '24%', '55%', '64%', '42%'];
                    const left = leftOffsets[idx % leftOffsets.length];
                    const top = topOffsets[idx % topOffsets.length];
                    const isHovered = activeHoverPG?.id === pg.id;

                    return (
                      <div
                        key={pg.id}
                        style={{ left, top }}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                      >
                        <button
                          onClick={() => setActiveHoverPG(pg)}
                          className={`group relative flex items-center gap-1 px-2.5 py-1.5 rounded-full font-extrabold text-xs shadow-xl transition-all cursor-pointer ${
                            isHovered
                              ? 'bg-slate-900 text-white ring-4 ring-blue-500 scale-110 z-30'
                              : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>₹{(pg.startingPrice / 1000).toFixed(1)}k</span>
                        </button>
                      </div>
                    );
                  })}

                  {/* Selected/Hovered PG Info Card Preview in Map */}
                  {activeHoverPG && (
                    <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 bg-white rounded-2xl p-4 shadow-2xl border border-blue-200 z-30 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                          {activeHoverPG.gender} PG • {activeHoverPG.city}
                        </span>
                        <button
                          onClick={() => setActiveHoverPG(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mt-1">{activeHoverPG.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{activeHoverPG.locality}</p>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block">From</span>
                          <span className="text-sm font-black text-blue-600">
                            ₹{(activeHoverPG.startingPrice ?? 0).toLocaleString()} /mo
                          </span>
                        </div>
                        <button
                          onClick={() => onSelectPG(activeHoverPG.id)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                        >
                          View Full Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Modal */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm">Filter Accommodations</h3>
              <button onClick={() => setMobileFilterOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">City</label>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Bengaluru', 'Pune', 'Hyderabad', 'Delhi NCR'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCity(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      selectedCity === c ? 'bg-blue-600 text-white' : 'bg-slate-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">PG Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['All', 'Boys', 'Girls', 'Unisex'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGender(g)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                      selectedGender === g ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200'
                    }`}
                  >
                    {g === 'All' ? 'Any Type' : `${g} PG`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Move-In Date</label>
              <input
                type="date"
                value={selectedMoveInDate}
                onChange={(e) => setSelectedMoveInDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold">Max Budget</span>
                <span className="font-bold text-blue-600">₹{maxPrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="6000"
                max="20000"
                step="500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              onClick={() => setMobileFilterOpen(false)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Apply Filters ({filteredProperties.length} Results)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
