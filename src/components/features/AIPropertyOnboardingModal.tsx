import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PincodeInput } from '../common/PincodeInput';
import { searchPlaces, GeoPlace } from '../../services/geo';
import { enhanceListingPhoto, uploadListingPhoto } from '../../services/media';
import {
  X,
  Camera,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  BedDouble,
  ShieldCheck,
  RefreshCw,
  MapPin,
  ImagePlus,
  Trash2,
  Wand2,
} from 'lucide-react';
import { GenderPreference, RoomOption } from '../../types';

interface Shot {
  id: string;
  category: 'Exterior' | 'Common Area' | 'Room' | 'Washroom';
  title: string;
  guideline: string;
  /** Remote URL (uploaded) or data URL while processing. */
  imageUrl?: string;
  metrics?: QualityMetric[];
}

interface QualityMetric {
  name: string;
  score: number;
  status: 'optimal' | 'warning' | 'error';
  feedback: string;
}

const SHOT_GUIDES: Omit<Shot, 'id' | 'imageUrl' | 'metrics'>[] = [
  {
    category: 'Exterior',
    title: 'Building Facade & Main Entrance',
    guideline: 'Capture the full entrance from street level in daylight. Keep vertical lines straight.',
  },
  {
    category: 'Common Area',
    title: 'Dining Hall or Lounge',
    guideline: 'Shoot from a corner so the room feels deep, clean tables visible.',
  },
  {
    category: 'Room',
    title: 'Bed & Study Setup',
    guideline: 'Include the mattress, study table, wardrobe and window light.',
  },
  {
    category: 'Washroom',
    title: 'Attached Washroom',
    guideline: 'Fixtures, mirror, geyser and tiled floor in bright light.',
  },
];

/** Client-side image quality analysis — real pixel math, runs instantly. */
async function analyzePhoto(file: File): Promise<QualityMetric[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });

    const w = 128;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Exposure: mean luminance + histogram spread.
    let sum = 0;
    const luma = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
      luma[i] = l;
      sum += l;
    }
    const mean = sum / (w * h);
    const exposure = 100 - Math.min(100, Math.abs(mean - 128) * 0.55);

    // Sharpness: mean Laplacian magnitude.
    let lapSum = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w];
        lapSum += Math.abs(lap);
      }
    }
    const sharpness = Math.min(100, Math.round((lapSum / (w * h)) * 12));

    // Colourfulness: mean channel deviation (a washed-out photo scores low).
    let sat = 0;
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      sat += Math.max(r, g, b) - Math.min(r, g, b);
    }
    const colour = Math.min(100, Math.round((sat / (w * h)) * 3.2));

    // Framing: reward resolution in the megapixel ballpark, penalise extremes.
    const mp = (img.naturalWidth * img.naturalHeight) / 1_000_000;
    const framing = Math.max(40, Math.min(100, Math.round(60 + 40 * Math.tanh(mp / 4))));

    const grade = (score: number): QualityMetric['status'] =>
      score >= 80 ? 'optimal' : score >= 60 ? 'warning' : 'error';
    const feedbackFor = (name: string, score: number): string => {
      if (name === 'Lighting & Exposure') return score >= 80 ? 'Balanced exposure across the frame' : score >= 60 ? 'Slightly dark or bright — shoot in daylight' : 'Poor lighting — retake near a window';
      if (name === 'Blur & Sharpness') return score >= 80 ? 'Edges are crisp and in focus' : score >= 60 ? 'A little soft — hold the phone steady' : 'Too blurry — retake with a steady hand';
      if (name === 'Colour & Contrast') return score >= 80 ? 'Rich, natural colours' : score >= 60 ? 'A bit flat — the enhancer can lift it' : 'Washed out — enable AI enhancement';
      return score >= 80 ? 'Resolution is plenty for listing display' : score >= 60 ? 'Low resolution — consider a retake' : 'Too small — use the main camera';
    };
    return [
      { name: 'Lighting & Exposure', score: Math.round(exposure), status: grade(exposure), feedback: feedbackFor('Lighting & Exposure', exposure) },
      { name: 'Blur & Sharpness', score: sharpness, status: grade(sharpness), feedback: feedbackFor('Blur & Sharpness', sharpness) },
      { name: 'Colour & Contrast', score: colour, status: grade(colour), feedback: feedbackFor('Colour & Contrast', colour) },
      { name: 'Resolution & Framing', score: framing, status: grade(framing), feedback: feedbackFor('Resolution', framing) },
    ];
  } catch {
    return [
      { name: 'Analysis', score: 70, status: 'warning', feedback: 'Photo accepted — automatic analysis unavailable' },
    ];
  } finally {
    URL.revokeObjectURL(url);
  }
}

const avgScore = (metrics?: QualityMetric[]): number =>
  metrics?.length ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0;

export const AIPropertyOnboardingModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { addProperty, logAuditEvent, currentUser } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — starts empty; the owner's own property, not a demo.
  const [propName, setPropName] = useState('');
  const [tagline, setTagline] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [countryName, setCountryName] = useState('India');
  const [pincode, setPincode] = useState('');
  const [locality, setLocality] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<GenderPreference>('Unisex');
  const [singleRent, setSingleRent] = useState<number | ''>('');
  const [doubleRent, setDoubleRent] = useState<number | ''>('');
  const [tripleRent, setTripleRent] = useState<number | ''>('');
  const [deposit, setDeposit] = useState<number | ''>('');
  const [foodType, setFoodType] = useState('');
  const [rules, setRules] = useState('');

  // Step 2 — real photo capture + analysis + AI copy.
  const [shots, setShots] = useState<Shot[]>(
    SHOT_GUIDES.map((g, i) => ({ id: `shot-${i}`, ...g }))
  );
  const [activeShotId, setActiveShotId] = useState(shots[0].id);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [aiHeadline, setAiHeadline] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiHighlights, setAiHighlights] = useState<string[]>([]);
  const [aiSource, setAiSource] = useState<'ai' | 'template'>('template');

  const activeShot = shots.find((s) => s.id === activeShotId) || shots[0];
  const shotsWithPhotos = shots.filter((s) => s.imageUrl).length;
  const overallScore = useMemo(
    () => Math.round(shots.filter((s) => s.metrics).reduce((sum, s) => sum + avgScore(s.metrics), 0) / Math.max(1, shots.filter((s) => s.metrics).length)),
    [shots]
  );

  const close = () => (onClose ? onClose() : undefined);

  const handleLocationPicked = (place: GeoPlace) => {
    if (place.city) setCity(place.city);
    if (place.address && !address) setAddress(place.address);
    if (place.locality && !locality) setLocality(place.locality);
  };

  const validateStep1 = (): string | null => {
    if (!propName.trim()) return 'Give your PG a name.';
    if (!city.trim()) return 'City is required — pick a pincode or type it.';
    if (!locality.trim()) return 'Locality is required.';
    const rents = [singleRent, doubleRent, tripleRent].filter((r) => r !== '');
    if (!rents.length) return 'Enter a monthly rent for at least one sharing type.';
    if (rents.some((r) => Number(r) < 1000)) return 'Rent looks too low — enter a monthly amount in ₹.';
    return null;
  };

  const goToShoot = () => {
    const problem = validateStep1();
    setError(problem);
    if (!problem) setStep(2);
  };

  const pickPhoto = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeShot) return;
    if (!file.type.startsWith('image/')) {
      setError('Please pick an image file.');
      return;
    }
    setError(null);
    setAnalyzingId(activeShot.id);
    const metrics = await analyzePhoto(file);
    // Store as a data URL first; the enhancer/upload swaps in a hosted URL.
    const reader = new FileReader();
    reader.onload = () => {
      setShots((prev) =>
        prev.map((s) =>
          s.id === activeShot.id
            ? { ...s, imageUrl: String(reader.result), metrics }
            : s
        )
      );
      setAnalyzingId(null);
      logAuditEvent('AI Photo Quality Analyzed', activeShot.title, `Score ${avgScore(metrics)}% — ${metrics.filter((m) => m.status === 'optimal').length}/${metrics.length} checks optimal`);
    };
    reader.readAsDataURL(file);
  };

  const handleEnhance = async () => {
    if (!activeShot?.imageUrl || enhancingId) return;
    setEnhancingId(activeShot.id);
    try {
      const blob = await (await fetch(activeShot.imageUrl)).blob();
      const result = await enhanceListingPhoto(blob, activeShot.category);
      if (result.url || result.dataUrl) {
        setShots((prev) =>
          prev.map((s) => (s.id === activeShot.id ? { ...s, imageUrl: result.url || result.dataUrl } : s))
        );
        logAuditEvent('AI Photo Enhanced', activeShot.title, 'Colour, brightness and sharpness lifted');
      } else {
        setError('Enhancement is unavailable right now — the photo is kept as captured.');
      }
    } catch {
      setError('Enhancement failed — the photo is kept as captured.');
    } finally {
      setEnhancingId(null);
    }
  };

  const generateAiCopy = async () => {
    if (isGeneratingContent) return;
    setIsGeneratingContent(true);
    setError(null);
    const rents = [singleRent, doubleRent, tripleRent].filter((r) => r !== '').map(Number);
    const baseData = {
      propertyName: propName,
      city,
      locality,
      foodType,
      gender,
      minRent: rents.length ? Math.min(...rents) : undefined,
      maxRent: rents.length ? Math.max(...rents) : undefined,
      shotCategories: shots.filter((s) => s.imageUrl).map((s) => s.category),
    };
    let generated = false;
    try {
      const { getAuthToken, isProductionApiEnabled } = await import('../../services/productionApi');
      const { apiUrl } = await import('../../services/apiBase');
      if (isProductionApiEnabled() && getAuthToken()) {
        const res = await fetch(apiUrl('/api/ai/listing-copy'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ property: baseData }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.headline && data.description) {
            setAiHeadline(String(data.headline));
            setAiDescription(String(data.description));
            setAiHighlights(Array.isArray(data.highlights) ? data.highlights.map(String).slice(0, 6) : []);
            setAiSource('ai');
            generated = true;
          }
        }
      }
    } catch {
      /* fall through to the local template */
    }
    if (!generated) {
      const minRent = baseData.minRent ? `₹${baseData.minRent.toLocaleString('en-IN')}` : 'affordable';
      const food = foodType ? ` Includes ${foodType}.` : '';
      setAiHeadline(`${propName} — Comfortable co-living in ${locality}, ${city}`);
      setAiDescription(
        `Stay at ${propName}, a ${gender === 'Unisex' ? 'co-living' : gender.toLowerCase()} PG in ${locality}, ${city}. Well-ventilated rooms, regular cleaning and a safe, friendly community.${food} Rents start at ${minRent}/month with transparent billing and a simple move-in process. Book a visit or reserve your bed online in minutes.`
      );
      setAiHighlights([
        `Prime location in ${locality}, ${city}`,
        baseData.minRent ? `Plans from ₹${baseData.minRent.toLocaleString('en-IN')}/month (all-inclusive)` : 'Flexible plans for every budget',
        foodType ? `Food: ${foodType}` : 'Meals available',
        'Verified listing with online visits & instant booking',
      ]);
      setAiSource('template');
    }
    setIsGeneratingContent(false);
    logAuditEvent('AI Listing Content Generated', propName, generated ? 'Generated by Workers AI' : 'Generated from the structured template');
  };

  const handleComplete = async () => {
    const problem = validateStep1();
    if (problem) {
      setError(problem);
      setStep(1);
      return;
    }
    const photoShots = shots.filter((s) => s.imageUrl);
    const cover = photoShots.find((s) => s.category === 'Exterior')?.imageUrl || photoShots[0]?.imageUrl;
    const rents = [singleRent, doubleRent, tripleRent].filter((r) => r !== '').map(Number);
    const mkRoom = (type: RoomOption['type'], rent: number, ac: boolean): RoomOption | null =>
      rent
        ? {
            id: `room-${Date.now()}-${type.toLowerCase()}`,
            type,
            rentPerMonth: rent,
            deposit: deposit === '' ? Math.round(rent * 1.5) : Number(deposit),
            availableBeds: type === 'Single' ? 1 : type === 'Double' ? 2 : 3,
            totalBeds: type === 'Single' ? 1 : type === 'Double' ? 2 : 3,
            hasAttachedBath: photoShots.some((s) => s.category === 'Washroom'),
            hasAC: ac,
            hasBalcony: false,
          }
        : null;
    const rooms = [
      mkRoom('Single', Number(singleRent), true),
      mkRoom('Double', Number(doubleRent), true),
      mkRoom('Triple', Number(tripleRent), false),
    ].filter((r): r is RoomOption => r !== null);

    addProperty({
      name: propName.trim(),
      tagline: (aiHeadline || tagline || `${propName} in ${locality}, ${city}`).trim(),
      gender,
      city: city.trim(),
      state: stateName.trim() || undefined,
      country: countryName.trim() || 'India',
      pincode: pincode.trim() || undefined,
      locality: locality.trim(),
      address: address.trim() || `${locality.trim()}, ${city.trim()}`,
      lat: 0,
      lng: 0,
      coverImage: cover || '',
      galleryImages: photoShots.map((s) => s.imageUrl!).filter(Boolean),
      startingPrice: rents.length ? Math.min(...rents) : 0,
      rating: 0,
      reviewCount: 0,
      rooms,
      amenities: ['wifi', ...(foodType ? ['three_time_food'] : []), ...(photoShots.some((s) => s.category === 'Washroom') ? ['attached_bath'] : [])],
      rules: rules ? rules.split(',').map((r) => r.trim()).filter(Boolean) : [],
      gateClosingTime: '',
      ownerName: currentUser?.name || 'Owner',
      ownerPhone: currentUser?.phone || '',
      foodIncluded: Boolean(foodType),
      foodType: foodType || undefined,
      noticePeriodDays: 30,
      reviews: [],
    });

    logAuditEvent('Property Onboarded via AI Shoot', propName, `Added with ${shotsWithPhotos} guided photos${aiSource === 'ai' ? ' and AI-generated listing copy' : ''}`);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-blue-800 to-indigo-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">AI Property Onboarding & Photo Shoot</h2>
              <p className="text-xs text-blue-200">
                {step === 1 ? 'Step 1: Property details & pricing' : 'Step 2: Guided photo shoot, AI quality audit & listing copy'}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${step === 1 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              Property & Pricing
            </button>
            <span className="text-slate-400">/</span>
            <button
              onClick={() => (validateStep1() ? setError(validateStep1()) : setStep(2))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${step === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              Photo Shoot & Content
            </button>
          </div>
          <span className="text-slate-500 hidden sm:inline">Every photo gets a real quality score before you publish</span>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <X className="w-4 h-4" /> {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">PG / Hostel Name *</label>
                  <input
                    type="text"
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Blue Haven Luxury Living PG"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tagline (optional)</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="One line that sells your PG"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Gender Demographic *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as GenderPreference)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="Boys">Boys PG</option>
                    <option value="Girls">Girls PG</option>
                    <option value="Unisex">Unisex / Co-Living</option>
                  </select>
                </div>

                <PincodeInput
                  label="Property Pincode"
                  value={pincode}
                  onPincodeChange={setPincode}
                  onResolved={({ city: resolvedCity, state: resolvedState, country: resolvedCountry }) => {
                    if (resolvedCity) setCity(resolvedCity);
                    if (resolvedState) setStateName(resolvedState);
                    if (resolvedCountry) setCountryName(resolvedCountry);
                  }}
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">City & Locality *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      aria-label="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="City (e.g. Bengaluru)"
                    />
                    <input
                      type="text"
                      aria-label="Locality"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Locality (e.g. HSR Sector 3)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">State</label>
                    <input
                      type="text"
                      aria-label="State"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="e.g. Karnataka"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Country</label>
                    <input
                      type="text"
                      aria-label="Country"
                      value={countryName}
                      onChange={(e) => setCountryName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="India"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="Plot / street, landmark"
                  />
                  {city.length > 2 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const places = await searchPlaces([locality, city, pincode].filter(Boolean).join(' '));
                        const hit = places[0];
                        if (hit) handleLocationPicked(hit);
                        else setError('Could not verify the location on the map — you can continue, it can be fixed later.');
                      }}
                      className="mt-1.5 text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> Verify location on map
                    </button>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-blue-600" />
                  Room Sharing Tiers & Monthly Tariffs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Single Private Room', value: singleRent, set: setSingleRent },
                    { label: 'Double Sharing Bed', value: doubleRent, set: setDoubleRent },
                    { label: 'Triple Sharing Bed', value: tripleRent, set: setTripleRent },
                    { label: 'Security Deposit', value: deposit, set: setDeposit },
                  ].map((f) => (
                    <div key={f.label} className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 block mb-1">{f.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-700">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={f.value}
                          onChange={(e) => f.set(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full font-bold text-slate-900 text-sm border-b border-slate-300 focus:border-blue-600 focus:outline-hidden py-0.5"
                          placeholder="—"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Food & Meal Plan</label>
                  <input
                    type="text"
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. 3 Meals + Evening Snacks (leave blank if none)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">House Rules (comma separated)</label>
                  <input
                    type="text"
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Curfew 11:30 PM, 30 days notice period"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Shot tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {shots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveShotId(s.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      activeShotId === s.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span className="truncate">{s.category}</span>
                    {s.imageUrl && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>

              {/* Stage + audit */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-4/3 border-2 border-slate-800 shadow-lg">
                    {activeShot.imageUrl ? (
                      <img src={activeShot.imageUrl} alt={activeShot.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                        <Camera className="w-10 h-10 text-slate-600" />
                        <p className="text-sm font-bold text-slate-300">{activeShot.title}</p>
                        <p className="text-xs max-w-xs">{activeShot.guideline}</p>
                      </div>
                    )}
                    {analyzingId === activeShot.id && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse" />
                    )}
                    {activeShot.metrics && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/15 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Score {avgScore(activeShot.metrics)}/100
                      </span>
                    )}
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelected} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={pickPhoto}
                      disabled={analyzingId === activeShot.id}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-60"
                    >
                      <ImagePlus className="w-4 h-4" />
                      {activeShot.imageUrl ? 'Replace photo' : shotsWithPhotos === 0 ? 'Take / upload photo' : 'Add photo'}
                    </button>
                    {activeShot.imageUrl && (
                      <button
                        onClick={handleEnhance}
                        disabled={enhancingId === activeShot.id}
                        className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Wand2 className={`w-4 h-4 ${enhancingId === activeShot.id ? 'animate-pulse' : ''}`} />
                        {enhancingId === activeShot.id ? 'Enhancing…' : 'AI Enhance'}
                      </button>
                    )}
                    {activeShot.imageUrl && (
                      <button
                        onClick={() => setShots((prev) => prev.map((s) => (s.id === activeShot.id ? { ...s, imageUrl: undefined, metrics: undefined } : s)))}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                    <span className="text-xs text-slate-500 ml-auto">
                      {shotsWithPhotos}/{shots.length} photos · {shotsWithPhotos ? `avg score ${overallScore}/100` : 'no photos yet'}
                    </span>
                  </div>
                </div>

                {/* Quality audit */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        AI Quality Audit
                      </span>
                      {activeShot.metrics && (
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${avgScore(activeShot.metrics) >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : avgScore(activeShot.metrics) >= 60 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                          {avgScore(activeShot.metrics)} / 100
                        </span>
                      )}
                    </div>
                    {activeShot.metrics ? (
                      activeShot.metrics.map((m, i) => (
                        <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="text-slate-700">{m.name}</span>
                            <span className={m.status === 'optimal' ? 'text-emerald-700' : m.status === 'warning' ? 'text-amber-700' : 'text-red-700'}>{m.score}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${m.status === 'optimal' ? 'bg-emerald-500' : m.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.score}%` }} />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{m.feedback}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Take or upload the photo above — lighting, sharpness, colour and framing are scored instantly on this device.
                      </p>
                    )}
                  </div>

                  {/* AI content */}
                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        AI Listing Copy
                      </span>
                      <button
                        onClick={generateAiCopy}
                        disabled={isGeneratingContent}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingContent ? 'animate-spin' : ''}`} />
                        {aiHeadline ? 'Regenerate' : 'Generate'}
                      </button>
                    </div>
                    {aiHeadline ? (
                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block">Headline {aiSource === 'ai' ? '(Workers AI)' : '(smart template)'}:</span>
                          <p className="text-xs font-bold text-slate-900 bg-white p-2 rounded-lg border border-blue-100">{aiHeadline}</p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block">Description:</span>
                          <p className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-blue-100 leading-relaxed">{aiDescription}</p>
                        </div>
                        {aiHighlights.length > 0 && (
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 block mb-1">Highlights:</span>
                            <ul className="space-y-1">
                              {aiHighlights.map((hl, idx) => (
                                <li key={idx} className="text-[11px] text-slate-800 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {hl}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Generate a headline, description and highlights from your property details — used verbatim on the published listing.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          {step === 1 ? (
            <button onClick={close} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors">
              Cancel
            </button>
          ) : (
            <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to details
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={goToShoot}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all"
            >
              Next: Photo Shoot <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Onboard Property{shotsWithPhotos ? ` (${shotsWithPhotos} photos)` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
