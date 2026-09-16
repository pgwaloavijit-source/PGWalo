import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Building,
  MapPin,
  BedDouble,
  ShieldCheck,
  Zap,
  Sliders,
  Maximize2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { GenderPreference, RoomSharingType } from '../../types';

interface QualityMetric {
  name: string;
  score: number;
  status: 'optimal' | 'warning' | 'error';
  feedback: string;
}

interface PhotoGuide {
  id: string;
  category: 'Exterior' | 'Common Area' | 'Room' | 'Washroom';
  title: string;
  guideline: string;
  aspectRatio: string;
  sampleImg: string;
  qualityMetrics: QualityMetric[];
  enhancedImg?: string;
  isEnhanced?: boolean;
}

const DEFAULT_GUIDES: PhotoGuide[] = [
  {
    id: 'g-ext',
    category: 'Exterior',
    title: 'Building Facade & Main Entrance',
    guideline: 'Capture the full building entrance from street level in natural daylight. Keep horizontal lines aligned.',
    aspectRatio: '16:9 Landscape',
    sampleImg: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    qualityMetrics: [
      { name: 'Lighting & Exposure', score: 94, status: 'optimal', feedback: 'Natural ambient daylight with balanced contrast' },
      { name: 'Blur & Sharpness', score: 98, status: 'optimal', feedback: 'High edge definition, zero motion blur' },
      { name: 'Perspective & Framing', score: 91, status: 'optimal', feedback: 'Vertical building lines aligned correctly' },
      { name: 'Obstruction Check', score: 88, status: 'optimal', feedback: 'Minor foreground parked bike detected, acceptable' },
    ],
  },
  {
    id: 'g-com',
    category: 'Common Area',
    title: 'Dining Hall & Lounge Space',
    guideline: 'Frame from corner angle to showcase spatial depth, seating capacity, and clean dining tables.',
    aspectRatio: '4:3 Wide',
    sampleImg: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
    qualityMetrics: [
      { name: 'Lighting & Exposure', score: 89, status: 'optimal', feedback: 'Warm interior illumination' },
      { name: 'Blur & Sharpness', score: 95, status: 'optimal', feedback: 'Clean focal plane across furniture' },
      { name: 'Perspective & Framing', score: 92, status: 'optimal', feedback: 'Corner angle maximizes perceived room volume' },
      { name: 'Obstruction Check', score: 96, status: 'optimal', feedback: 'Clear sightlines, clutter-free' },
    ],
  },
  {
    id: 'g-room',
    category: 'Room',
    title: 'Deluxe Bed & Study Setup',
    guideline: 'Include mattress with neat bedsheet, study table, wardrobe, and window lighting.',
    aspectRatio: '4:3 Wide',
    sampleImg: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    qualityMetrics: [
      { name: 'Lighting & Exposure', score: 96, status: 'optimal', feedback: 'Bright natural window light with subtle fill' },
      { name: 'Blur & Sharpness', score: 92, status: 'optimal', feedback: 'Textile texture and woodwork clearly resolved' },
      { name: 'Perspective & Framing', score: 94, status: 'optimal', feedback: 'Wide lens capture showing full bed & workspace' },
      { name: 'Obstruction Check', score: 90, status: 'optimal', feedback: 'Clean bedsheet, personal items tidied away' },
    ],
  },
  {
    id: 'g-bath',
    category: 'Washroom',
    title: 'Attached Western Washroom',
    guideline: 'Capture sanitary fixtures, mirror, geyser, and clean tiled floor in bright white light.',
    aspectRatio: '3:4 Vertical',
    sampleImg: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    qualityMetrics: [
      { name: 'Lighting & Exposure', score: 87, status: 'optimal', feedback: 'Overhead LED lighting verified' },
      { name: 'Blur & Sharpness', score: 94, status: 'optimal', feedback: 'Reflections balanced, no glare spots' },
      { name: 'Perspective & Framing', score: 90, status: 'optimal', feedback: 'Full sanitary unit in vertical field of view' },
      { name: 'Obstruction Check', score: 98, status: 'optimal', feedback: 'Spotless mirrors and clean dry tiles' },
    ],
  },
];

export const AIPropertyOnboardingModal: React.FC = () => {
  const { showAIOnboardingModal, setShowAIOnboardingModal, addProperty, logAuditEvent } = useApp();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form Data
  const [propName, setPropName] = useState('Zenith Elite Co-Living PG');
  const [tagline, setTagline] = useState('Premium high-tech student & executive living near tech parks');
  const [city, setCity] = useState('Bengaluru');
  const [locality, setLocality] = useState('Bellandur Outer Ring Road');
  const [address, setAddress] = useState('Sy 28/2, Green Glen Layout, Bellandur, Bengaluru 560103');
  const [gender, setGender] = useState<GenderPreference>('Unisex');
  const [startingPrice, setStartingPrice] = useState(11500);
  const [deposit, setDeposit] = useState(20000);
  const [singleRent, setSingleRent] = useState(18000);
  const [doubleRent, setDoubleRent] = useState(12500);
  const [tripleRent, setTripleRent] = useState(9500);
  const [foodType, setFoodType] = useState('North & South Indian (3 Meals + Evening Snacks)');
  const [electricityPolicy, setElectricityPolicy] = useState('Sub-meter per room billed @ ₹8.50/unit');
  const [rules, setRules] = useState('Curfew 11:30 PM, Biometric Access, 30 Days Notice Period');

  // Step 2 AI Photo Shoot State
  const [guides, setGuides] = useState<PhotoGuide[]>(DEFAULT_GUIDES);
  const [selectedGuideIndex, setSelectedGuideIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [showFramingOverlay, setShowFramingOverlay] = useState(true);
  const [enhancementActive, setEnhancementActive] = useState(true);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  // Generated AI Content
  const [aiHeadline, setAiHeadline] = useState('Ultra-Modern Tech-Savvy Co-Living at Bellandur Tech Corridor');
  const [aiDescription, setAiDescription] = useState(
    'Experience seamless living with ergonomically furnished single and shared suites, 300 Mbps fiber internet, home-style buffet dining, and 24x7 security. Designed for tech professionals and students seeking quiet comfort within 5 minutes of Ecospace and Prestige Tech Park.'
  );
  const [aiHighlights, setAiHighlights] = useState([
    'Walkable distance to Bellandur Ecospace & RMZ Ecoworld',
    '300 Mbps Dedicate Leased Line Wi-Fi + Power Inverter Backup',
    'Nutritious 3-time buffet food with live roti counter',
    'Digital Sub-metering for 100% transparent electricity billing',
  ]);

  if (!showAIOnboardingModal) return null;

  const currentGuide = guides[selectedGuideIndex];

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      logAuditEvent('AI Photo Quality Analyzed', currentGuide.title, 'Quality score 94% - passed all framing thresholds');
    }, 900);
  };

  const handleGenerateAIContent = () => {
    setIsGeneratingContent(true);
    setTimeout(() => {
      setAiHeadline(`${propName} — Premium Urban Living in ${locality}`);
      setAiDescription(
        `Discover high-grade co-living at ${propName}, strategically located in ${locality}, ${city}. Featuring hygienic culinary dining (${foodType}), high-speed wireless mesh connectivity, and transparent sub-metered electricity. Ideal for professionals working in nearby commercial campuses.`
      );
      setAiHighlights([
        `Prime location in ${locality}, near key transit & IT corridors`,
        `Flexible room options from ₹${tripleRent}/mo (Triple) to ₹${singleRent}/mo (Single)`,
        `Transparent electricity billing: ${electricityPolicy}`,
        `Comprehensive security: Biometric gate access & 24/7 CCTV surveillance`,
      ]);
      setIsGeneratingContent(false);
      logAuditEvent('AI Listing Content Generated', propName, 'Generated headline, description, and highlights');
    }, 800);
  };

  const handleCompleteOnboarding = () => {
    addProperty({
      name: propName,
      tagline: aiHeadline || tagline,
      gender,
      city,
      locality,
      address,
      lat: 12.926,
      lng: 77.676,
      coverImage: guides[0].sampleImg,
      galleryImages: guides.map((g) => g.sampleImg),
      startingPrice: Math.min(singleRent, doubleRent, tripleRent),
      rating: 4.9,
      reviewCount: 1,
      rooms: [
        {
          id: `room-${Date.now()}-single`,
          type: 'Single',
          rentPerMonth: singleRent,
          deposit,
          availableBeds: 2,
          totalBeds: 6,
          hasAttachedBath: true,
          hasAC: true,
          hasBalcony: true,
        },
        {
          id: `room-${Date.now()}-double`,
          type: 'Double',
          rentPerMonth: doubleRent,
          deposit: Math.round(deposit * 0.75),
          availableBeds: 4,
          totalBeds: 12,
          hasAttachedBath: true,
          hasAC: true,
          hasBalcony: false,
        },
        {
          id: `room-${Date.now()}-triple`,
          type: 'Triple',
          rentPerMonth: tripleRent,
          deposit: Math.round(deposit * 0.6),
          availableBeds: 3,
          totalBeds: 9,
          hasAttachedBath: true,
          hasAC: false,
          hasBalcony: false,
        },
      ],
      amenities: ['wifi', 'ac', 'food', 'laundry', 'power_backup', 'cctv', 'attached_bath'],
      rules: rules.split(',').map((r) => r.trim()),
      gateClosingTime: '11:30 PM',
      ownerName: 'Rajesh Sharma',
      ownerPhone: '+91 98450 12345',
      foodIncluded: true,
      foodType,
      noticePeriodDays: 30,
      reviews: [],
    });

    logAuditEvent('Property Onboarded via AI Shoot', propName, `Added with 27 beds across 3 sharing types in ${locality}`);
    setShowAIOnboardingModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-blue-200 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">AI Property Onboarding & Photo Shoot</h2>
              <p className="text-xs text-blue-200">
                {step === 1 ? 'Step 1: Property Master Data & Specifications' : 'Step 2: AI Framing Guides, Quality Audit & Listing Generator'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAIOnboardingModal(false)}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 1 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              Property Architecture & Pricing
            </button>
            <span className="text-slate-400">/</span>
            <button
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              AI Photo Shoot & Content Engine
            </button>
          </div>
          <span className="text-slate-500 hidden sm:inline">All photos undergo real-time computer vision quality check</span>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto">
          {step === 1 ? (
            /* STEP 1: Property Details */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    PG / Hostel Name *
                  </label>
                  <input
                    type="text"
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Blue Haven Luxury Living PG"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Gender Demographic *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as GenderPreference)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="Boys">Boys PG</option>
                    <option value="Girls">Girls PG</option>
                    <option value="Unisex">Unisex / Co-Living Space</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    City & Locality *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="City (e.g. Bengaluru)"
                    />
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Locality (e.g. HSR Sector 3)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Physical Address & GPS Landmarks *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="Plot / Survey number, street, landmark, pincode"
                  />
                </div>
              </div>

              {/* Room Pricing & Bed Tiers */}
              <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-blue-600" />
                  Room Sharing Tiers & Monthly Tariffs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Single Private Room</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-700">₹</span>
                      <input
                        type="number"
                        value={singleRent}
                        onChange={(e) => setSingleRent(Number(e.target.value))}
                        className="w-full font-bold text-slate-900 text-sm border-b border-slate-300 focus:border-blue-600 focus:outline-hidden py-0.5"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Double Sharing Bed</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-700">₹</span>
                      <input
                        type="number"
                        value={doubleRent}
                        onChange={(e) => setDoubleRent(Number(e.target.value))}
                        className="w-full font-bold text-slate-900 text-sm border-b border-slate-300 focus:border-blue-600 focus:outline-hidden py-0.5"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Triple Sharing Bed</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-700">₹</span>
                      <input
                        type="number"
                        value={tripleRent}
                        onChange={(e) => setTripleRent(Number(e.target.value))}
                        className="w-full font-bold text-slate-900 text-sm border-b border-slate-300 focus:border-blue-600 focus:outline-hidden py-0.5"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Standard Security Deposit</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-700">₹</span>
                      <input
                        type="number"
                        value={deposit}
                        onChange={(e) => setDeposit(Number(e.target.value))}
                        className="w-full font-bold text-slate-900 text-sm border-b border-slate-300 focus:border-blue-600 focus:outline-hidden py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Food & Operational Policies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Food & Meal Plan Model
                  </label>
                  <input
                    type="text"
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. 3 Meals + Tea (Veg & Non-Veg weekends)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Electricity Policy & Metering
                  </label>
                  <input
                    type="text"
                    value={electricityPolicy}
                    onChange={(e) => setElectricityPolicy(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Sub-meter per room @ ₹8.50/unit"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: AI Photo Shoot & Quality Inspection */
            <div className="space-y-6">
              {/* Category Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-1">
                {guides.map((g, idx) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGuideIndex(idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedGuideIndex === idx
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {g.category}: {g.title}
                  </button>
                ))}
              </div>

              {/* Main Photo Shoot Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Viewfinder Preview with AI Framing Guide */}
                <div className="lg:col-span-7">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-4/3 border-2 border-slate-800 group shadow-lg">
                    <img
                      src={currentGuide.sampleImg}
                      alt={currentGuide.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        enhancementActive ? 'brightness-105 contrast-105 saturate-105' : ''
                      }`}
                    />

                    {/* Real-time Framing Grid Overlay */}
                    {showFramingOverlay && (
                      <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full border border-blue-400/60 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          </div>
                        </div>
                        <div className="border-b border-white/20"></div>
                        <div className="border-r border-white/20"></div>
                        <div className="border-r border-white/20"></div>
                        <div></div>
                      </div>
                    )}

                    {/* Scanning Simulation Animation */}
                    {isScanning && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-[bounce_1.5s_infinite]"></div>
                    )}

                    {/* Viewfinder Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/15">
                        <Camera className="w-3 h-3 text-emerald-400" />
                        Framing Guide: {currentGuide.aspectRatio}
                      </span>
                      {enhancementActive && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-blue-300/30">
                          <Sparkles className="w-3 h-3" />
                          AI Enhanced
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                      <div className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 max-w-sm truncate">
                        {currentGuide.guideline}
                      </div>
                      <button
                        onClick={handleSimulateScan}
                        disabled={isScanning}
                        className="px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
                      >
                        <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin text-blue-600' : ''}`} />
                        {isScanning ? 'Auditing...' : 'Re-Scan Frame'}
                      </button>
                    </div>
                  </div>

                  {/* Viewfinder Controls */}
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-600">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showFramingOverlay}
                        onChange={(e) => setShowFramingOverlay(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Show Rule-of-Thirds Grid
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enhancementActive}
                        onChange={(e) => setEnhancementActive(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Auto-Color & Sharpness Enhancement
                    </label>
                  </div>
                </div>

                {/* AI Quality Audit Card & Metrics */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        AI Quality Audit ({currentGuide.category})
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Score: 94 / 100
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {currentGuide.qualityMetrics.map((m, i) => (
                        <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="text-slate-700">{m.name}</span>
                            <span className="text-emerald-700">{m.score}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${m.score}%` }}
                            ></div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{m.feedback}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Content Engine */}
                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        AI Listing Content Generator
                      </span>
                      <button
                        onClick={handleGenerateAIContent}
                        disabled={isGeneratingContent}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingContent ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block">AI Headline:</span>
                        <p className="text-xs font-bold text-slate-900 bg-white p-2 rounded-lg border border-blue-100">
                          {aiHeadline}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block">AI Description:</span>
                        <p className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-blue-100 leading-relaxed">
                          {aiDescription}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block mb-1">Key Selling Highlights:</span>
                        <ul className="space-y-1">
                          {aiHighlights.map((hl, idx) => (
                            <li key={idx} className="text-[11px] text-slate-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {hl}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          {step === 1 ? (
            <button
              onClick={() => setShowAIOnboardingModal(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Details
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all hover:translate-x-0.5"
            >
              Next: AI Photo Shoot
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCompleteOnboarding}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all hover:scale-102"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publish & Onboard Property
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
