import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Building2 } from 'lucide-react';
import { OwnerListingStep6 } from '../../../types';

interface Step6OwnerDetailsProps {
  data: OwnerListingStep6;
  onDataChange: (data: OwnerListingStep6) => void;
  onValidationChange: (isValid: boolean) => void;
}

const ROLES = ['Property Owner', 'Authorized Manager', 'Property Operator'];
const CONTACT_METHODS = ['Phone', 'WhatsApp', 'Email'];

const Step6OwnerDetails: React.FC<Step6OwnerDetailsProps> = ({ data, onDataChange, onValidationChange }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!data.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!data.mobileNumber.trim()) newErrors.mobileNumber = 'Mobile number is required';
    if (!/^\d{10}$/.test(data.mobileNumber.replace(/\D/g, ''))) newErrors.mobileNumber = 'Invalid mobile number';
    if (!data.emailAddress.trim()) newErrors.emailAddress = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)) newErrors.emailAddress = 'Invalid email format';

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange(isValid);
    return isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const handleChange = (field: keyof OwnerListingStep6, value: any) => {
    onDataChange({ ...data, [field]: value });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Owner Details</h2>
        <p className="text-slate-600">Provide your contact information for verification and communication.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Enter your full name"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.fullName ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={data.mobileNumber}
                onChange={(e) => handleChange('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.mobileNumber ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.mobileNumber && <p className="mt-1 text-sm text-red-600">{errors.mobileNumber}</p>}
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Number (Optional)</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={data.whatsappNumber || ''}
                onChange={(e) => handleChange('whatsappNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="WhatsApp number (if different from mobile)"
                maxLength={10}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={data.emailAddress}
                onChange={(e) => handleChange('emailAddress', e.target.value)}
                placeholder="your.email@example.com"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.emailAddress ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.emailAddress && <p className="mt-1 text-sm text-red-600">{errors.emailAddress}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Your Role</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={data.role}
                onChange={(e) => handleChange('role', e.target.value as any)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
              >
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preferred Contact Method */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Preferred Contact Method</label>
            <div className="flex gap-3">
              {CONTACT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => handleChange('preferredContact', method as any)}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    data.preferredContact === method
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Privacy Notice:</strong> Your contact information will be used for property verification and communication with potential residents. It will not be displayed publicly on your listing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Step6OwnerDetails;