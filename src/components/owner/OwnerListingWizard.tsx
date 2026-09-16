import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { LocationPicker } from '../common/LocationPicker';
import { ListingImage } from '../common/ListingImage';
import { normalizeListingPhoto } from '../../utils/photoEnhance';
import { uploadListingPhoto } from '../../services/media';
import { searchPlaces } from '../../services/geo';
import { useApp } from '../../context/AppContext';
import {
  OwnerListingData,
  OwnerListingStep1,
  OwnerListingStep2,
  OwnerListingStep3,
  OwnerListingStep4,
  OwnerListingStep5,
  OwnerListingStep6,
  RoomDetail,
  SharingCapacity,
} from '../../types';

interface OwnerListingWizardProps {
  onComplete?: (listingData: OwnerListingData) => void;
  onCancel?: () => void;
  initialData?: Partial<OwnerListingData>;
}

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad'];
const GENDERS: OwnerListingStep1['genderOccupancy'][] = ['Boys', 'Girls', 'Unisex / Co-ed'];

const QUICK_AMENITIES = [
  { id: 'wifi', name: 'Wi-Fi', group: 'property' as const },
  { id: 'cctv', name: 'CCTV', group: 'property' as const },
  { id: 'power-backup', name: 'Power backup', group: 'property' as const },
  { id: 'food', name: 'Food', group: 'food' as const },
  { id: 'AC', name: 'AC', group: 'room' as const },
  { id: 'Attached Bathroom', name: 'Attached bath', group: 'room' as const },
  { id: 'wardrobe', name: 'Wardrobe', group: 'room' as const },
  { id: 'parking', name: 'Parking', group: 'property' as const },
];

const ROOM_TEMPLATES: { sharing: SharingCapacity; beds: number; rent: number; label: string }[] = [
  { sharing: 'Single', beds: 1, rent: 14000, label: 'Single' },
  { sharing: 'Double', beds: 2, rent: 9500, label: 'Double' },
  { sharing: 'Triple', beds: 3, rent: 8000, label: 'Triple' },
];

function makeBeds(count: number, rent: number) {
  const names = ['A', 'B', 'C', 'D'];
  return Array.from({ length: count }, (_, i) => ({
    bedId: `bed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    bedName: `Bed ${names[i] || i + 1}`,
    status: 'Available' as const,
    monthlyRent: rent,
    securityDeposit: rent,
  }));
}

function makeRoom(sharing: SharingCapacity, beds: number, rent: number, roomNumber: string): RoomDetail {
  return {
    roomNumber,
    floor: '1st Floor',
    roomType: sharing === 'Single' ? 'Private' : 'Shared',
    sharingCapacity: sharing,
    numberOfBeds: beds,
    beds: makeBeds(beds, rent),
  };
}

const OwnerListingWizard: React.FC<OwnerListingWizardProps> = ({ onComplete, onCancel, initialData }) => {
  const { currentUser } = useApp();
  const [step, setStep] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [step1, setStep1] = useState<OwnerListingStep1>(initialData?.step1 || getEmptyStep1());
  const [step2, setStep2] = useState<OwnerListingStep2>(
    initialData?.step2 || { rooms: [makeRoom('Double', 2, 9500, '101')] }
  );
  const [step3, setStep3] = useState<OwnerListingStep3>(initialData?.step3 || getEmptyStep3());
  const [step4, setStep4] = useState<OwnerListingStep4>(initialData?.step4 || { photos: [] });
  const [enhancingPhotos, setEnhancingPhotos] = useState(false);
  const [step5] = useState<OwnerListingStep5>(initialData?.step5 || getEmptyStep5());
  const [step6, setStep6] = useState<OwnerListingStep6>(
    initialData?.step6 || {
      fullName: currentUser?.name || '',
      mobileNumber: (currentUser?.phone || '').replace(/\D/g, '').slice(-10),
      whatsappNumber: currentUser?.phone || '',
      emailAddress: currentUser?.email || '',
      role: 'Property Owner',
      preferredContact: 'Phone',
    }
  );

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const buildListing = useCallback(
    (status: OwnerListingData['listingStatus']): OwnerListingData => ({
      step1,
      step2,
      step3,
      step4,
      step5,
      step6,
      step7: getEmptyStep7(),
      step8: getEmptyStep8(),
      currentStep: step,
      listingStatus: status,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [step1, step2, step3, step4, step5, step6, step, initialData?.createdAt]
  );

  const step1Valid = Boolean(step1.propertyName.trim() && step1.city && step1.locality.trim() && step1.fullAddress.trim());
  const step2Valid = step2.rooms.length > 0 && step2.rooms.every((r) => r.roomNumber.trim() && r.beds.every((b) => b.monthlyRent > 0));
  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : true;
  const startingRent = Math.min(...step2.rooms.flatMap((r) => r.beds.map((b) => b.monthlyRent)).concat([9500]));

  const addTemplate = (sharing: SharingCapacity, beds: number, rent: number) => {
    const nextNum = String(101 + step2.rooms.length);
    setStep2({ rooms: [...step2.rooms, makeRoom(sharing, beds, rent, nextNum)] });
  };

  const updateRoom = (index: number, patch: Partial<RoomDetail>) => {
    setStep2({
      rooms: step2.rooms.map((room, i) => {
        if (i !== index) return room;
        const next = { ...room, ...patch };
        if (patch.numberOfBeds && patch.numberOfBeds !== room.numberOfBeds) {
          next.beds = makeBeds(patch.numberOfBeds, room.beds[0]?.monthlyRent || 8000);
        }
        return next;
      }),
    });
  };

  const updateRent = (index: number, rent: number) => {
    setStep2({
      rooms: step2.rooms.map((room, i) =>
        i === index
          ? { ...room, beds: room.beds.map((b) => ({ ...b, monthlyRent: rent, securityDeposit: rent })) }
          : room
      ),
    });
  };

  const toggleAmenity = (id: string, group: 'room' | 'property' | 'food') => {
    if (group === 'food') {
      setStep3({ ...step3, foodAvailable: !step3.foodAvailable });
      return;
    }
    const key = group === 'room' ? 'roomAmenities' : 'propertyAmenities';
    const list = step3[key];
    const exists = list.find((a) => a.id === id);
    const next = exists
      ? list.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
      : [...list, { id, name: id, selected: true }];
    setStep3({ ...step3, [key]: next });
  };

  const isAmenityOn = (id: string, group: 'room' | 'property' | 'food') => {
    if (group === 'food') return step3.foodAvailable;
    const list = group === 'room' ? step3.roomAmenities : step3.propertyAmenities;
    return Boolean(list.find((a) => a.id === id)?.selected);
  };

  const onPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    setEnhancingPhotos(true);
    void Promise.all(
      Array.from(files).slice(0, 8).map(async (file) => {
        const normalized = await normalizeListingPhoto(file);
        let url = normalized.dataUrl;
        let enhanced = false;
        try {
          const res = await uploadListingPhoto(normalized.blob, 'Bedroom');
          if (res.url) url = res.url;
          else if (res.dataUrl) url = res.dataUrl;
          enhanced = Boolean(res.url || res.dataUrl);
        } catch {
          /* keep local normalized crop */
        }
        return {
          id: `photo-${Date.now()}-${file.name}`,
          url,
          originalUrl: normalized.dataUrl,
          enhanced,
          category: 'Bedroom' as const,
          qualityScore: enhanced ? 92 : 84,
          uploadDate: new Date().toISOString(),
        };
      })
    ).then((items) => {
      setStep4((prev) => ({
        photos: [...prev.photos, ...items].slice(0, 12).map((p, i) => ({
          ...p,
          category: i === 0 ? 'Exterior' : p.category,
        })),
      }));
      setEnhancingPhotos(false);
    });
  };

  const publish = async () => {
    if (!step1Valid || !step2Valid) {
      setStep(!step1Valid ? 1 : 2);
      return;
    }
    setPublishing(true);
    let nextStep1 = step1;
    if (!step1.mapLocation) {
      const places = await searchPlaces(`${step1.fullAddress} ${step1.locality} ${step1.city} India`);
      if (places[0]) {
        nextStep1 = {
          ...step1,
          mapLocation: { lat: places[0].lat, lng: places[0].lng },
          nearbyLandmark: places[0].displayName,
        };
        setStep1(nextStep1);
      }
    }
    onComplete?.({
      ...buildListing('Published'),
      step1: nextStep1,
    });
  };

  const titles = ['Property', 'Rooms', 'Extras', 'Publish'];

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden overscroll-none flex sm:items-center sm:justify-center sm:p-5 lg:p-8"
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (step < 4 && canContinue) setStep(step + 1);
        else if (step === 4 && !publishing && step1Valid && step2Valid) publish();
      }}
    >
      <button
        type="button"
        aria-label="Close listing"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] hidden sm:block"
        onClick={onCancel}
      />

      <div className="relative flex flex-col w-full h-dvh max-h-dvh sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-[28px] shadow-2xl overflow-hidden">
        <header className="shrink-0 px-4 sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900 truncate">{step1.propertyName.trim() || 'List a new PG'}</p>
            <p className="text-[11px] text-slate-500">
              Step {step} of 4 · {titles[step - 1]}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 px-4 sm:px-5 py-2.5">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] font-bold text-center">
            {titles.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => i + 1 < step && setStep(i + 1)}
                className={i + 1 === step ? 'text-blue-700' : i + 1 < step ? 'text-emerald-600' : 'text-slate-400'}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
          <div className="space-y-4 pb-4">
              {step === 1 && (
                <>
                  <p className="text-xs text-slate-500">Only the essentials. You can add more later.</p>
                  <Field label="PG name" required>
                    <input
                      autoFocus
                      value={step1.propertyName}
                      onChange={(e) => setStep1({ ...step1, propertyName: e.target.value })}
                      placeholder="e.g. Blue Nest PG, HSR"
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" required>
                      <select
                        value={step1.city}
                        onChange={(e) => setStep1({ ...step1, city: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select</option>
                        {CITIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">For</span>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      {GENDERS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setStep1({ ...step1, genderOccupancy: g })}
                          className={`px-2 py-2 rounded-xl text-[11px] font-bold border ${
                            step1.genderOccupancy === g
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {g === 'Unisex / Co-ed' ? 'Unisex' : g}
                        </button>
                      ))}
                    </div>
                  </div>
                  </div>
                  <Field label="Locality" required>
                    <input
                      value={step1.locality}
                      onChange={(e) => setStep1({ ...step1, locality: e.target.value })}
                      placeholder="HSR Layout, Koramangala…"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Full address" required>
                    <textarea
                      rows={2}
                      value={step1.fullAddress}
                      onChange={(e) => setStep1({ ...step1, fullAddress: e.target.value })}
                      placeholder="Street, landmark, pincode"
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                  <LocationPicker
                    city={step1.city}
                    locality={step1.locality}
                    address={step1.fullAddress}
                    lat={step1.mapLocation?.lat}
                    lng={step1.mapLocation?.lng}
                    onPicked={(place) => {
                      setStep1({
                        ...step1,
                        locality: place.locality || step1.locality,
                        city: place.city && CITIES.includes(place.city) ? place.city : step1.city,
                        fullAddress: place.address || step1.fullAddress,
                        nearbyLandmark: place.displayName,
                        mapLocation: { lat: place.lat, lng: place.lng },
                        pincode: step1.pincode,
                      });
                    }}
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <p className="text-xs text-slate-500">Tap a type to add a room. Edit rent if needed.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ROOM_TEMPLATES.map((t) => (
                      <button
                        key={t.sharing}
                        type="button"
                        onClick={() => addTemplate(t.sharing, t.beds, t.rent)}
                        className="rounded-2xl border border-blue-100 bg-blue-50 px-2 py-3 text-center hover:bg-blue-100"
                      >
                        <Home className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                        <p className="text-xs font-black text-slate-900">+ {t.label}</p>
                        <p className="text-[10px] text-slate-500">₹{t.rent.toLocaleString()}/bed</p>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {step2.rooms.map((room, i) => (
                      <div key={`${room.roomNumber}-${i}`} className="rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <input
                            value={room.roomNumber}
                            onChange={(e) => updateRoom(i, { roomNumber: e.target.value })}
                            className="w-full text-sm font-bold text-slate-900 bg-transparent outline-none"
                          />
                          <p className="text-[11px] text-slate-500">
                            {room.sharingCapacity} · {room.numberOfBeds} bed{room.numberOfBeds === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="text-right">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">₹ / bed / mo</label>
                          <input
                            type="number"
                            value={room.beds[0]?.monthlyRent || 0}
                            onChange={(e) => updateRent(i, Number(e.target.value) || 0)}
                            className="w-24 text-right text-sm font-black text-blue-700 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200"
                          />
                        </div>
                        {step2.rooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setStep2({ rooms: step2.rooms.filter((_, idx) => idx !== i) })}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Remove room"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <p className="text-xs text-slate-500">Optional — skip anytime. Common amenities are pre-ticked.</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_AMENITIES.map((a) => {
                      const on = isAmenityOn(a.id, a.group);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAmenity(a.id, a.group)}
                          className={`px-3 py-2 rounded-full text-xs font-bold border transition ${
                            on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {on && <Check className="w-3 h-3 inline mr-1" />}
                          {a.name}
                        </button>
                      );
                    })}
                    {step3.foodAvailable && <Utensils className="w-4 h-4 text-blue-600 self-center" />}
                  </div>
                  <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center cursor-pointer hover:border-blue-400">
                    <Camera className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <p className="text-xs font-bold text-slate-700">Add room photos</p>
                    <p className="text-[10px] text-slate-400">
                      {enhancingPhotos ? 'Enhancing for a consistent look…' : `${step4.photos.length} added · AI-normalized 4:3`}
                    </p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPhotos(e.target.files)} />
                  </label>
                  {step4.photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {step4.photos.map((p) => (
                        <div key={p.id} className="relative">
                          <ListingImage src={p.url} alt="" className="h-16 w-full rounded-xl" />
                          {p.enhanced && (
                            <span className="absolute bottom-1 left-1 px-1 rounded bg-blue-600 text-white text-[8px] font-bold">AI</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                    <p className="text-sm font-black text-slate-900">{step1.propertyName || 'Untitled PG'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {step1.locality}
                      {step1.city ? `, ${step1.city}` : ''} · {step1.genderOccupancy}
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      {step2.rooms.length} room type{step2.rooms.length === 1 ? '' : 's'} · from ₹
                      {startingRent.toLocaleString()}/mo
                    </p>
                  </div>
                  <Field label="Your name on the listing">
                    <input
                      value={step6.fullName}
                      onChange={(e) => setStep6({ ...step6, fullName: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone">
                      <input
                        value={step6.mobileNumber}
                        onChange={(e) => setStep6({ ...step6, mobileNumber: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        value={step6.emailAddress}
                        onChange={(e) => setStep6({ ...step6, emailAddress: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Goes live on PGWalo as soon as you publish. KYC can be completed later.
                  </p>
                </>
              )}
            </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 bg-white">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="h-11 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button type="button" onClick={onCancel} className="h-11 px-4 rounded-xl text-slate-500 text-sm font-bold">
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
              className="ml-auto h-11 px-5 rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-sm font-bold flex items-center gap-1 shadow-md"
            >
              Continue {step === 3 ? 'or skip extras' : ''} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={publishing || !step1Valid || !step2Valid}
              onClick={publish}
              className="ml-auto h-11 px-5 rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-sm font-bold shadow-md"
            >
              {publishing ? 'Publishing…' : 'Publish listing'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
    <div className="mt-1">{children}</div>
  </label>
);

function getEmptyStep1(): OwnerListingStep1 {
  return {
    propertyName: '',
    city: 'Bengaluru',
    genderOccupancy: 'Unisex / Co-ed',
    locality: '',
    propertyType: 'PG',
    propertyDescription: '',
    fullAddress: '',
    pincode: '',
    nearbyLandmark: '',
  };
}

function getEmptyStep3(): OwnerListingStep3 {
  return {
    roomAmenities: [
      { id: 'AC', name: 'AC', selected: false },
      { id: 'Attached Bathroom', name: 'Attached Bathroom', selected: true },
    ],
    propertyAmenities: [
      { id: 'wifi', name: 'Wi-Fi', selected: true },
      { id: 'cctv', name: 'CCTV', selected: true },
      { id: 'power-backup', name: 'Power backup', selected: true },
      { id: 'parking', name: 'Parking', selected: false },
      { id: 'wardrobe', name: 'Wardrobe', selected: false },
    ],
    foodAvailable: true,
    foodOptions: [
      { id: 'breakfast', name: 'Breakfast', selected: true },
      { id: 'lunch', name: 'Lunch', selected: true },
      { id: 'dinner', name: 'Dinner', selected: true },
    ],
    otherServices: [],
  };
}

function getEmptyStep5(): OwnerListingStep5 {
  return {
    checkInTime: '10:00 AM',
    curfewTime: '11:00 PM',
    smokingAllowed: false,
    alcoholAllowed: false,
    visitorsAllowed: 'Restricted',
    petsAllowed: false,
    cookingAllowed: false,
    additionalRules: '',
    minimumStay: '1 Month',
    noticePeriod: '30 Days',
  };
}

function getEmptyStep7() {
  return {
    governmentId: {} as OwnerListingData['step7']['governmentId'],
    ownershipProof: {} as OwnerListingData['step7']['ownershipProof'],
    propertyDocuments: [],
    verificationStatus: 'Pending' as const,
  };
}

function getEmptyStep8() {
  return {
    qualityScore: {
      overall: 0,
      details: { propertyDetails: 0, photos: 0, amenities: 0, pricing: 0, location: 0 },
      missingItems: [],
    },
    previewData: null,
  };
}

export default OwnerListingWizard;
export { OwnerListingWizard };
