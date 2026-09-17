import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ComboField } from '../common/ComboField';
import { PincodeInput } from '../common/PincodeInput';
import { UserAvatar } from '../common/UserAvatar';
import { isProductionApiEnabled } from '../../services/productionApi';
import { fetchMeWithWorkers, saveProfileWithWorkers } from '../../services/auth';
import {
  BLOOD_GROUP_OPTIONS,
  CITY_OPTIONS,
  FOOD_OPTIONS,
  GENDER_OPTIONS,
  STATE_OPTIONS,
  LANGUAGE_OPTIONS,
  MARITAL_OPTIONS,
  ORGANIZATION_OPTIONS,
  PROFESSION_OPTIONS,
  RELATION_OPTIONS,
  VEHICLE_OPTIONS,
} from '../../data/profileOptions';

async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process photo');
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export const AccountDetailsPage: React.FC = () => {
  const { currentUser, updateUserProfile, applyApiSession } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [occupation, setOccupation] = useState(currentUser?.occupation || '');
  const [organization, setOrganization] = useState(currentUser?.organization || '');
  const [gender, setGender] = useState(currentUser?.gender || '');
  const [foodPreference, setFoodPreference] = useState(currentUser?.foodPreference || '');
  const [bloodGroup, setBloodGroup] = useState(currentUser?.bloodGroup || '');
  const [vehicleType, setVehicleType] = useState(currentUser?.vehicleType || '');
  const [maritalStatus, setMaritalStatus] = useState(currentUser?.maritalStatus || '');
  const [preferredLanguage, setPreferredLanguage] = useState(currentUser?.preferredLanguage || '');
  const [emergencyRelation, setEmergencyRelation] = useState(currentUser?.emergencyContactRelation || '');
  const [address, setAddress] = useState(currentUser?.permanentAddress || '');
  const [pincode, setPincode] = useState((currentUser as any)?.pincode || '');
  const [stateName, setStateName] = useState((currentUser as any)?.state || '');

  useEffect(() => {
    if (!currentUser) return;
    setAvatar(currentUser.avatar || '');
    setCity(currentUser.city || '');
    setOccupation(currentUser.occupation || '');
    setOrganization(currentUser.organization || '');
    setGender(currentUser.gender || '');
    setFoodPreference(currentUser.foodPreference || '');
    setBloodGroup(currentUser.bloodGroup || '');
    setVehicleType(currentUser.vehicleType || '');
    setMaritalStatus(currentUser.maritalStatus || '');
    setPreferredLanguage(currentUser.preferredLanguage || '');
    setEmergencyRelation(currentUser.emergencyContactRelation || '');
    setAddress(currentUser.permanentAddress || '');
  }, [currentUser]);

  useEffect(() => {
    if (!isProductionApiEnabled()) return;
    fetchMeWithWorkers().then((res) => {
      if (res?.success && res.user) {
        applyApiSession({ ...res.user, isProfileCompleted: true });
      }
    }).catch(() => undefined);
  }, []);

  if (!currentUser) return null;

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    const data = await compressPhoto(file);
    setAvatar(data);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    const extras = {
      avatar,
      city,
      occupation,
      organization,
      gender: (gender || undefined) as 'Male' | 'Female' | 'Other' | undefined,
      foodPreference,
      bloodGroup,
      vehicleType,
      maritalStatus,
      preferredLanguage,
      emergencyContactRelation: emergencyRelation,
      permanentAddress: address.trim(),
      pincode: pincode.trim(),
      state: stateName.trim(),
    };
    try {
      if (isProductionApiEnabled()) {
        const res = await saveProfileWithWorkers({
          ...extras,
          extrasOnly: true,
          age: currentUser.age,
          permanentAddress: currentUser.permanentAddress,
          emergencyContactName: currentUser.emergencyContactName,
          emergencyContactPhone: currentUser.emergencyContactPhone,
        });
        if (!res.success) {
          setNotice(res.error || 'Could not save details.');
          return;
        }
        if (res.user) applyApiSession({ ...res.user, ...extras, isProfileCompleted: true });
        else updateUserProfile(extras);
      } else {
        updateUserProfile(extras);
      }
      setNotice('Your account details were saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Account</p>
        <h1 className="text-2xl font-black text-slate-900 mt-1">Your details</h1>
        <p className="text-sm text-slate-500 mt-1">
          KYC fields stay filled. Add lifestyle preferences from the lists — or type your own if it is missing.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 sm:p-8 flex items-center gap-4 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative group">
            <UserAvatar name={currentUser.name} src={avatar} sizeClass="w-20 h-20 text-xl" className="rounded-2xl" />
            <span className="absolute inset-0 rounded-2xl bg-slate-900/40 opacity-0 group-hover:opacity-100 grid place-items-center text-white transition">
              <Camera className="w-5 h-5" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          <div>
            <p className="text-lg font-black text-slate-900">{currentUser.name}</p>
            <p className="text-sm text-slate-500">{currentUser.phone || 'No mobile on file'}</p>
            <p className="text-xs text-slate-400">{currentUser.email}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs font-bold text-blue-600"
            >
              Change photo
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 rounded-2xl bg-slate-50 border border-slate-100 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs text-slate-600">
              Identity from KYC is locked for safety.
              {currentUser.aadhaarLast4 ? ` Aadhaar ending ${currentUser.aadhaarLast4}.` : ''} Age {currentUser.age || '—'}.
              Emergency: {currentUser.emergencyContactName || '—'} ({currentUser.emergencyContactPhone || '—'}).
            </p>
          </div>

          <ComboField label="City" value={city} onChange={setCity} options={CITY_OPTIONS} />
          <ComboField label="Profession" value={occupation} onChange={setOccupation} options={PROFESSION_OPTIONS} />
          <ComboField label="Company or college" value={organization} onChange={setOrganization} options={ORGANIZATION_OPTIONS} />
          <ComboField label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} />
          <ComboField label="Food preference" value={foodPreference} onChange={setFoodPreference} options={FOOD_OPTIONS} />
          <ComboField label="Blood group" value={bloodGroup} onChange={setBloodGroup} options={BLOOD_GROUP_OPTIONS} />
          <ComboField label="Vehicle" value={vehicleType} onChange={setVehicleType} options={VEHICLE_OPTIONS} />
          <ComboField label="Marital status" value={maritalStatus} onChange={setMaritalStatus} options={MARITAL_OPTIONS} />
          <ComboField label="Preferred language" value={preferredLanguage} onChange={setPreferredLanguage} options={LANGUAGE_OPTIONS} />
          <ComboField label="Emergency relation" value={emergencyRelation} onChange={setEmergencyRelation} options={RELATION_OPTIONS} />

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Permanent address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House / street, area — filled from KYC"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 min-h-[72px] text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <PincodeInput
            value={pincode}
            onPincodeChange={setPincode}
            onResolved={({ city: resolvedCity, state: resolvedState }) => {
              if (resolvedCity && !city) setCity(resolvedCity);
              setStateName(resolvedState || stateName);
            }}
          />
          <ComboField label="State" value={stateName} onChange={setStateName} options={STATE_OPTIONS} />
        </div>

        {notice && (
          <p className="px-6 sm:px-8 pb-2 text-sm text-emerald-700 font-medium">{notice}</p>
        )}

        <div className="px-6 sm:px-8 pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save additional details'}
          </button>
        </div>
      </div>
    </div>
  );
};
