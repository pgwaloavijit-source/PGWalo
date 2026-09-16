import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  X,
  User,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HeartPulse,
  Home,
  Users,
} from 'lucide-react';

export const ProfileCompletionModal: React.FC = () => {
  const {
    currentUser,
    profileModalOpen,
    setProfileModalOpen,
    updateUserProfile,
    setRole,
  } = useApp();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [selectedRole, setSelectedRole] = useState<UserRole>('resident');
  const [occupation, setOccupation] = useState('Working Professional');
  const [organization, setOrganization] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Parent');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever currentUser or modal open changes
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setAge(currentUser.age ? String(currentUser.age) : '');
      setPhone(currentUser.phone && currentUser.phone !== '+91 98765 43210' ? currentUser.phone : '');
      if (currentUser.gender) setGender(currentUser.gender);
      if (currentUser.role && currentUser.role !== 'public') setSelectedRole(currentUser.role);
      if (currentUser.occupation) setOccupation(currentUser.occupation);
      if (currentUser.organization) setOrganization(currentUser.organization);
      if (currentUser.city) setCity(currentUser.city);
      if (currentUser.emergencyContactName) setEmergencyContactName(currentUser.emergencyContactName);
      if (currentUser.emergencyContactPhone) setEmergencyContactPhone(currentUser.emergencyContactPhone);
      if (currentUser.emergencyContactRelation) setEmergencyContactRelation(currentUser.emergencyContactRelation);
    }
  }, [currentUser, profileModalOpen]);

  if (!profileModalOpen || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validations
    if (!name.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 16 || parsedAge > 99) {
      setErrorMessage('Please provide a valid age between 16 and 99 years.');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (emergencyContactPhone.trim() && emergencyContactPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Emergency contact number must be at least 10 digits.');
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      setIsSaving(false);
      const res = updateUserProfile({
        name: name.trim(),
        age: parsedAge,
        phone: cleanPhone,
        gender,
        role: selectedRole,
        occupation,
        organization: organization.trim(),
        city: city.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        emergencyContactRelation,
        isProfileCompleted: true,
      });

      if (res.success) {
        setSuccessMessage('Profile saved successfully! Redirecting...');
        setTimeout(() => {
          setSuccessMessage(null);
          setRole(selectedRole);
          setProfileModalOpen(false);
        }, 1000);
      } else {
        setErrorMessage(res.message || 'Failed to update profile. Please try again.');
      }
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-6 relative">
          {currentUser.isProfileCompleted && (
            <button
              id="profile-modal-close-btn"
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition focus:outline-hidden"
              aria-label="Close profile setup"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" />
              {currentUser.isProfileCompleted ? 'Account Settings' : 'Member Onboarding'}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {currentUser.isProfileCompleted ? 'Update Your Profile' : 'Complete Your Profile'}
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1">
            {currentUser.isProfileCompleted
              ? 'Manage your personal details and preferences.'
              : 'Please enter your name, age, phone number, and preferences to set up your account.'}
          </p>
        </div>

        {/* Feedback Messages */}
        <div className="px-6 pt-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 mb-3 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 mb-3 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Section: Basic Information */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Personal Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="profile-fullname-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Avijit Biswas"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Age (Years) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="profile-age-input"
                    type="number"
                    min={16}
                    max={99}
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 23"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="profile-phone-input"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Gender Selection */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                        gender === g
                          ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Account Type / Role */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              I am using PGNest as
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedRole('resident')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  selectedRole === 'resident'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  {selectedRole === 'resident' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Resident / Tenant</p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Looking for or staying in a PG</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('owner')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  selectedRole === 'owner'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  {selectedRole === 'owner' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">PG Owner / Host</p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">List & manage properties</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  selectedRole === 'staff'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  {selectedRole === 'staff' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Campus Staff</p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Warden, housekeeping, ops</p>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Occupation & City */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              Work & Location
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Occupation</label>
                <select
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                >
                  <option value="Working Professional">Working Professional</option>
                  <option value="College Student">College Student</option>
                  <option value="Job Seeker / Intern">Job Seeker / Intern</option>
                  <option value="Business Owner / Freelancer">Business Owner / Freelancer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company or University</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. Infosys, TCS, Delhi Univ"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">City / Hometown</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru, Karnataka"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Emergency Contact */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              Emergency Contact (House Safety)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="e.g. S. K. Biswas"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="e.g. +91 98000 11223"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Relationship</label>
                <select
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 bg-white"
                >
                  <option value="Parent">Parent</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Friend">Friend</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            {currentUser.isProfileCompleted && (
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
              >
                Cancel
              </button>
            )}

            <button
              id="save-profile-submit-btn"
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Details...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Profile & Continue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
