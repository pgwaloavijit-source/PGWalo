import React, { useState, useEffect } from 'react';
import { MapPin, Building2, Home, Info } from 'lucide-react';
import { OwnerListingStep1, PropertyType, GenderOccupancy } from '../../../types';

interface Step1PropertyDetailsProps {
  data: OwnerListingStep1;
  onDataChange: (data: OwnerListingStep1) => void;
  onValidationChange: (isValid: boolean) => void;
}

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad'];
const PROPERTY_TYPES: PropertyType[] = ['PG', 'Hostel', 'Co-Living', 'Rental Rooms', 'Apartment'];
const GENDER_OPTIONS: GenderOccupancy[] = ['Boys', 'Girls', 'Unisex / Co-ed'];

const Step1PropertyDetails: React.FC<Step1PropertyDetailsProps> = ({ data, onDataChange, onValidationChange }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!data.propertyName.trim()) newErrors.propertyName = 'Property name is required';
    if (!data.city) newErrors.city = 'City is required';
    if (!data.locality.trim()) newErrors.locality = 'Locality is required';
    if (!data.fullAddress.trim()) newErrors.fullAddress = 'Address is required';
    if (!data.pincode.trim()) newErrors.pincode = 'Pincode is required';
    if (!/^\d{6}$/.test(data.pincode)) newErrors.pincode = 'Invalid pincode format';

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange(isValid);
    return isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const handleChange = (field: keyof OwnerListingStep1, value: any) => {
    onDataChange({ ...data, [field]: value });
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Basic Property Details</h2>
        <p className="text-slate-600">Tell us about your property to get started with your listing.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Property Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.propertyName}
                onChange={(e) => handleChange('propertyName', e.target.value)}
                placeholder="Enter the name of your PG / hostel / co-living property"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.propertyName ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.propertyName && <p className="mt-1 text-sm text-red-600">{errors.propertyName}</p>}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={data.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.city ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none cursor-pointer`}
              >
                <option value="">Select city</option>
                {CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
          </div>

          {/* Gender / Occupancy */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Gender / Occupancy <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={data.genderOccupancy}
                onChange={(e) => handleChange('genderOccupancy', e.target.value as GenderOccupancy)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
              >
                {GENDER_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Locality */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Locality <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.locality}
                onChange={(e) => handleChange('locality', e.target.value)}
                placeholder="Enter locality / area"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.locality ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.locality && <p className="mt-1 text-sm text-red-600">{errors.locality}</p>}
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Property Type</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={data.propertyType}
                onChange={(e) => handleChange('propertyType', e.target.value as PropertyType)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
              >
                {PROPERTY_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Property Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Property Description</label>
            <div className="relative">
              <Info className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <textarea
                value={data.propertyDescription}
                onChange={(e) => handleChange('propertyDescription', e.target.value)}
                placeholder="Short description of your property..."
                rows={3}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
              />
            </div>
          </div>

          {/* Full Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Full Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.fullAddress}
                onChange={(e) => handleChange('fullAddress', e.target.value)}
                placeholder="Enter complete address"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.fullAddress ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.fullAddress && <p className="mt-1 text-sm text-red-600">{errors.fullAddress}</p>}
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pincode <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.pincode}
                onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode"
                maxLength={6}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                  errors.pincode ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
              />
            </div>
            {errors.pincode && <p className="mt-1 text-sm text-red-600">{errors.pincode}</p>}
          </div>

          {/* Nearby Landmark */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nearby Landmark</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={data.nearbyLandmark}
                onChange={(e) => handleChange('nearbyLandmark', e.target.value)}
                placeholder="e.g., Near Metro Station, Behind Mall"
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Map Location</p>
              <p className="text-xs text-blue-700">Map integration will be available in the next step</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1PropertyDetails;