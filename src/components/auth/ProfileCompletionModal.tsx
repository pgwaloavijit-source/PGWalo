import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isProductionApiEnabled } from '../../services/productionApi';
import { saveProfileWithWorkers } from '../../services/auth';
import { isValidAadhaar, isValidIndianPhone } from '../../utils/kyc';
import { isPlatformAdmin } from '../../utils/platformAdmin';
import { ComboField } from '../common/ComboField';
import {
  AGE_OPTIONS,
  CITY_OPTIONS,
  GENDER_OPTIONS,
  ORGANIZATION_OPTIONS,
  PROFESSION_OPTIONS,
  RELATION_OPTIONS,
  STATE_OPTIONS,
} from '../../data/profileOptions';
import { PincodeInput } from '../common/PincodeInput';

export const ProfileCompletionModal: React.FC = () => {
  const {
    currentUser,
    profileModalOpen,
    setProfileModalOpen,
    updateUserProfile,
    pendingAction,
    applyApiSession,
  } = useApp();

  const isOwner = currentUser?.role === 'owner';
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [organization, setOrganization] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setAge(currentUser.age ? String(currentUser.age) : '');
    setGender(currentUser.gender || '');
    setAddress(currentUser.permanentAddress || '');
    setPincode((currentUser as any).pincode || '');
    setState((currentUser as any).state || '');
    setCity(currentUser.city || '');
    setOccupation(currentUser.occupation || '');
    setOrganization(currentUser.organization || '');
    setEmergencyName(currentUser.emergencyContactName || '');
    setEmergencyPhone(currentUser.emergencyContactPhone || '');
    setEmergencyRelation(currentUser.emergencyContactRelation || '');
    setAltPhone(currentUser.alternatePhone || '');
  }, [currentUser, profileModalOpen]);

  if (!profileModalOpen || !currentUser || isPlatformAdmin(currentUser.role)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAge = parseInt(age, 10);
    if (!parsedAge || parsedAge < 16 || parsedAge > 99) {
      setError('Pick a valid age.');
      return;
    }
    if (!address.trim()) {
      setError('Permanent address is required.');
      return;
    }
    if (!emergencyName.trim() || !isValidIndianPhone(emergencyPhone)) {
      setError('Enter a valid emergency contact name and mobile.');
      return;
    }
    if (!isValidAadhaar(aadhaar)) {
      setError('Enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!isOwner && !occupation.trim()) {
      setError('Tell us your profession. Pick from the list or type it.');
      return;
    }

    const promoteToResident = pendingAction?.type === 'booking' && currentUser.role !== 'owner';
    setSaving(true);
    try {
      const payload = {
        age: parsedAge,
        gender: gender || undefined,
        occupation: occupation.trim(),
        organization: organization.trim(),
        permanentAddress: address.trim(),
        pincode: pincode.trim(),
        state: state.trim(),
        city: city.trim(),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone,
        emergencyContactRelation: emergencyRelation.trim(),
        alternatePhone: altPhone || undefined,
        aadhaar,
        promoteToResident,
      };
      if (isProductionApiEnabled()) {
        const res = await saveProfileWithWorkers(payload);
        if (!res.success || !res.user) {
          setError(res.error || 'Could not save profile.');
          return;
        }
        applyApiSession({ ...res.user, ...payload, isProfileCompleted: true });
      } else {
        updateUserProfile({
          ...payload,
          aadhaarLast4: aadhaar.replace(/\D/g, '').slice(-4),
          role: promoteToResident ? 'resident' : currentUser.role,
          isProfileCompleted: true,
        });
      }
      setProfileModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-linear-to-br from-blue-600 to-indigo-600 px-5 py-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
            {isOwner ? 'Owner verification' : 'Quick KYC'}
          </p>
          <h2 className="text-xl font-black mt-1">
            {isOwner ? 'Verify you as the property owner' : 'Almost there — confirm who you are'}
          </h2>
          <p className="text-xs text-blue-100 mt-1">
            Signed in as {currentUser.phone || currentUser.email}. Pick from suggestions or type your own.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <ComboField label="Age" value={age} onChange={setAge} options={AGE_OPTIONS} required />
            <ComboField label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Permanent address <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder="House / street, area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 min-h-[72px] text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              required
            />
          </div>

          <PincodeInput
            label="Pincode"
            required
            value={pincode}
            onPincodeChange={setPincode}
            onResolved={({ city: resolvedCity, state: resolvedState }) => {
              setCity(resolvedCity || city);
              setState(resolvedState || state);
            }}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <ComboField label="City" value={city} onChange={setCity} options={CITY_OPTIONS} placeholder="Bengaluru, Pune…" />
            <ComboField label="State" value={state} onChange={setState} options={STATE_OPTIONS} placeholder="Karnataka…" />
          </div>

          {!isOwner && (
            <>
              <ComboField
                label="Profession"
                value={occupation}
                onChange={setOccupation}
                options={PROFESSION_OPTIONS}
                required
                hint="Select from the list or type if yours is missing."
              />
              <ComboField
                label="Company or college"
                value={organization}
                onChange={setOrganization}
                options={ORGANIZATION_OPTIONS}
              />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Alternate mobile
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Optional 10-digit number"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm"
                />
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/70">
            <p className="text-xs font-bold text-slate-700">Emergency contact</p>
            <input
              placeholder="Full name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm"
              required
            />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Mobile"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm"
              required
            />
            <ComboField label="Relation" value={emergencyRelation} onChange={setEmergencyRelation} options={RELATION_OPTIONS} />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Aadhaar number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="12 digits"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 tracking-[0.3em] font-semibold"
              required
            />
            <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              We store only a hash and the last 4 digits.
            </p>
          </div>
        </div>

        <div className="px-5 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </form>
    </div>
  );
};
